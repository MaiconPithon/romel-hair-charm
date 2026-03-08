import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppointments } from "@/hooks/useAppointments";
import { useServices } from "@/hooks/useServices";
import { useScheduleConfig } from "@/hooks/useScheduleConfig";
import { useBlockedSlots } from "@/hooks/useBlockedSlots";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LogOut, Plus, Trash2, Edit2, Home, CalendarIcon, Star, DollarSign, MessageCircle, Key, Clock, Settings, Palette, Users, Zap, Filter, AlertTriangle, FileText, ClipboardList, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const Admin = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filterDate, setFilterDate] = useState("");
  const [planReportMonth, setPlanReportMonth] = useState(format(new Date(), "yyyy-MM"));
  const { data: allAppointments, refetch: refetchAppts } = useAppointments(filterDate || undefined);
  const { data: todayAppointments } = useAppointments(format(new Date(), "yyyy-MM-dd"));
  const { data: services, refetch: refetchServices } = useServices(false);
  const { data: schedule, refetch: refetchSchedule } = useScheduleConfig();
  const { data: blockedSlots, refetch: refetchBlocked } = useBlockedSlots();
  const { data: settings, refetch: refetchSettings } = useBusinessSettings();
  const { data: avaliacoes } = useAvaliacoes();

  // Team state
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState("");

  // Auth check
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/admin/login"); return; }
      const { data: hasRole } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" as const });
      if (!hasRole) { navigate("/admin/login"); }
    };
    check();
  }, [navigate]);

  // Load team
  const loadTeam = async () => {
    setLoadingTeam(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("manage-team", {
        body: { action: "list" },
      });
      if (res.data?.users) setTeamMembers(res.data.users);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTeam(false);
    }
  };

  useEffect(() => { loadTeam(); }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  // Stats
  const todayCount = todayAppointments?.length || 0;
  // Revenue excludes 'plano' payment method (subscription services don't count as cash revenue)
  const todayRevenue = todayAppointments?.filter(a => ["finalizado", "confirmado"].includes(a.status) && a.payment_method !== "plano").reduce((sum, a) => sum + Number(a.total_price), 0) || 0;
  const todayPlanCount = todayAppointments?.filter(a => a.payment_method === "plano").length || 0;

  const now = new Date();
  const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
  const monthRevenue = allAppointments?.filter(a => ["finalizado", "confirmado"].includes(a.status) && a.payment_method !== "plano" && a.appointment_date >= monthStart).reduce((sum, a) => sum + Number(a.total_price), 0) || 0;
  const totalRevenue = allAppointments?.filter(a => ["finalizado", "confirmado"].includes(a.status) && a.payment_method !== "plano").reduce((sum, a) => sum + Number(a.total_price), 0) || 0;
  const avgRating = avaliacoes?.length ? (avaliacoes.reduce((sum, a) => sum + a.stars, 0) / avaliacoes.length).toFixed(0) : "0";

  // Cancellation alerts: appointments cancelled today
  const cancelledToday = todayAppointments?.filter(a => a.status === "cancelado") || [];

  // Plan report filtered by month
  const planAppointments = allAppointments?.filter(a => a.payment_method === "plano" && a.appointment_date.startsWith(planReportMonth)) || [];

  // Appointment actions
  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar status: " + error.message);
      return;
    }
    refetchAppts();
    toast.success("Status atualizado!");
  };

  // Toggle payment_method between 'plano' and the previous method (null/dinheiro)
  const togglePlanPayment = async (id: string, isCurrentlyPlano: boolean) => {
    const { error } = await supabase
      .from("appointments")
      .update({ payment_method: isCurrentlyPlano ? null : "plano" })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao marcar como plano: " + error.message);
      return;
    }
    refetchAppts();
    toast.success(isCurrentlyPlano ? "Plano removido." : "Marcado como Plano!");
  };

  const deleteAppointment = async (id: string) => {
    await supabase.from("appointments").delete().eq("id", id);
    refetchAppts();
    toast.success("Agendamento removido.");
  };

  // Edit appointment dialog
  const [editDialog, setEditDialog] = useState(false);
  const [editAppt, setEditAppt] = useState<any>(null);
  const [editServiceIds, setEditServiceIds] = useState<string[]>([]);
  const [customServiceName, setCustomServiceName] = useState("");
  const [customServicePrice, setCustomServicePrice] = useState("");
  const [customServices, setCustomServices] = useState<{ name: string; price: number }[]>([]);

  const openEditAppt = (a: any) => {
    setEditAppt(a);
    setEditServiceIds(a.service_ids || []);
    setCustomServices([]);
    setEditDialog(true);
  };

  const addCustomService = () => {
    if (!customServiceName || !customServicePrice) return;
    setCustomServices(prev => [...prev, { name: customServiceName, price: parseFloat(customServicePrice) }]);
    setCustomServiceName("");
    setCustomServicePrice("");
  };

  const saveEditAppt = async () => {
    if (!editAppt) return;
    const catalogServices = services?.filter(s => editServiceIds.includes(s.id)) || [];
    const allNames = [...catalogServices.map(s => s.name), ...customServices.map(s => s.name)];
    const totalPrice = catalogServices.reduce((sum, s) => sum + Number(s.price), 0) + customServices.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = catalogServices.reduce((sum, s) => sum + s.duration, 0);

    await supabase.from("appointments").update({
      service_ids: editServiceIds,
      service_names: allNames,
      total_price: totalPrice,
      total_duration: totalDuration,
    }).eq("id", editAppt.id);

    setEditDialog(false);
    refetchAppts();
    toast.success("Agendamento atualizado!");
  };

  const editNewTotal = (() => {
    const catalogTotal = services?.filter(s => editServiceIds.includes(s.id)).reduce((sum, s) => sum + Number(s.price), 0) || 0;
    const customTotal = customServices.reduce((sum, s) => sum + s.price, 0);
    return catalogTotal + customTotal;
  })();

  // Service management
  const [serviceDialog, setServiceDialog] = useState(false);
  const [editService, setEditService] = useState<any>(null);
  const [sName, setSName] = useState("");
  const [sPrice, setSPrice] = useState("");
  const [sDuration, setSDuration] = useState("30");

  const openNewService = () => { setEditService(null); setSName(""); setSPrice(""); setSDuration("30"); setServiceDialog(true); };
  const openEditService = (s: any) => { setEditService(s); setSName(s.name); setSPrice(String(s.price)); setSDuration(String(s.duration)); setServiceDialog(true); };

  const saveService = async () => {
    const payload = { name: sName, price: parseFloat(sPrice), duration: parseInt(sDuration) };
    if (editService) {
      await supabase.from("services").update(payload).eq("id", editService.id);
    } else {
      await supabase.from("services").insert(payload);
    }
    setServiceDialog(false);
    refetchServices();
    toast.success("Serviço salvo!");
  };

  const toggleService = async (id: string, active: boolean) => {
    await supabase.from("services").update({ active: !active }).eq("id", id);
    refetchServices();
  };

  const updateServiceField = async (id: string, field: string, value: any) => {
    await supabase.from("services").update({ [field]: value }).eq("id", id);
    refetchServices();
  };

  // Schedule config
  const updateSchedule = async (id: string, updates: any) => {
    await supabase.from("schedule_config").update(updates).eq("id", id);
    refetchSchedule();
    toast.success("Horário atualizado!");
  };

  // Blocked slots
  const [blockDate, setBlockDate] = useState<Date | undefined>();

  const addBlock = async (date: Date) => {
    const ds = format(date, "yyyy-MM-dd");
    // Toggle: if already blocked, remove it
    const existing = blockedSlots?.find(b => b.blocked_date === ds && b.all_day);
    if (existing) {
      await supabase.from("blocked_slots").delete().eq("id", existing.id);
    } else {
      await supabase.from("blocked_slots").insert({
        blocked_date: ds,
        all_day: true,
        reason: "Bloqueado pelo admin",
      });
    }
    refetchBlocked();
  };

  const isDateBlocked = (date: Date) => {
    const ds = format(date, "yyyy-MM-dd");
    return blockedSlots?.some(b => b.blocked_date === ds && b.all_day) || false;
  };

  // Business settings
  const [settingsLocal, setSettingsLocal] = useState<Record<string, string>>({});
  useEffect(() => { if (settings) setSettingsLocal(settings); }, [settings]);

  const saveSetting = async (key: string, value?: string) => {
    const val = value ?? settingsLocal[key] ?? "";
    await supabase.from("business_settings").upsert({ key, value: val }, { onConflict: "key" });
    refetchSettings();
    toast.success("Configuração salva!");
  };

  // Quick sale
  const [qsName, setQsName] = useState("");
  const [qsServiceIds, setQsServiceIds] = useState<string[]>([]);
  const [qsCustomName, setQsCustomName] = useState("");
  const [qsCustomPrice, setQsCustomPrice] = useState("");
  const [qsCustomServices, setQsCustomServices] = useState<{ name: string; price: number }[]>([]);
  const [qsPaymentStatus, setQsPaymentStatus] = useState("pago");
  const [qsDate, setQsDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [qsHour, setQsHour] = useState(format(new Date(), "HH"));
  const [qsMinute, setQsMinute] = useState("00");
  const [qsSearch, setQsSearch] = useState("");

  const qsTotalPrice = (() => {
    const catalog = services?.filter(s => qsServiceIds.includes(s.id)).reduce((sum, s) => sum + Number(s.price), 0) || 0;
    const custom = qsCustomServices.reduce((sum, s) => sum + s.price, 0);
    return catalog + custom;
  })();

  const handleQuickSale = async () => {
    const catalogChosen = services?.filter((s) => qsServiceIds.includes(s.id)) || [];
    const allNames = [...catalogChosen.map(s => s.name), ...qsCustomServices.map(s => s.name)];
    const totalDuration = catalogChosen.reduce((sum, s) => sum + s.duration, 0);
    const quickSalePaymentMethod =
      qsPaymentStatus === "plano" ? "plano" :
      qsPaymentStatus === "pago" ? "Dinheiro" :
      null;

    await supabase.from("appointments").insert({
      client_name: qsName || "Venda Rápida",
      client_phone: "N/A",
      service_ids: qsServiceIds,
      service_names: allNames,
      appointment_date: qsDate,
      appointment_time: `${qsHour}:${qsMinute}:00`,
      status: qsPaymentStatus === "pago" ? "finalizado" : qsPaymentStatus === "plano" ? "finalizado" : "pendente",
      payment_method: quickSalePaymentMethod,
      total_price: qsTotalPrice,
      total_duration: totalDuration,
    });
    setQsName(""); setQsServiceIds([]); setQsCustomServices([]);
    refetchAppts();
    toast.success("Atendimento finalizado!");
  };

  // Team actions
  const createTeamMember = async () => {
    if (!newEmail || !newPassword) return;
    try {
      const res = await supabase.functions.invoke("manage-team", {
        body: { action: "create", email: newEmail, password: newPassword },
      });
      if (res.data?.error) throw new Error(res.data.error);
      setNewEmail(""); setNewPassword("");
      loadTeam();
      toast.success("Barbeiro cadastrado!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao cadastrar");
    }
  };

  const deleteTeamMember = async (userId: string) => {
    try {
      await supabase.functions.invoke("manage-team", {
        body: { action: "delete", user_id: userId },
      });
      loadTeam();
      toast.success("Barbeiro removido!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover");
    }
  };

  const updateTeamPassword = async () => {
    if (!passwordDialog || !newPwd) return;
    try {
      await supabase.functions.invoke("manage-team", {
        body: { action: "update-password", user_id: passwordDialog, password: newPwd },
      });
      setPasswordDialog(null); setNewPwd("");
      toast.success("Senha atualizada!");
    } catch (e: any) {
      toast.error(e.message || "Erro");
    }
  };

  const businessName = settings?.business_name || "Barbearia do Romel";
  const primaryColor = settings?.primary_color || "#d1b122";

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-2xl font-black text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>Painel Admin</h1>
          <p className="text-xs text-muted-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>{businessName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="outline" size="sm" className="gap-2"><Home className="h-4 w-4" />Página Inicial</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2"><LogOut className="h-4 w-4" />Sair</Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-4">
        <Tabs defaultValue="appointments">
          <TabsList className="mb-6 w-full flex-wrap justify-start bg-card border border-border">
            <TabsTrigger value="appointments" className="relative">
              Agendamentos
              {cancelledToday.length > 0 && (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{cancelledToday.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="quicksale">Encaixe</TabsTrigger>
            <TabsTrigger value="schedule">Agenda</TabsTrigger>
            <TabsTrigger value="services">Serviços</TabsTrigger>
            <TabsTrigger value="plans"><FileText className="h-3.5 w-3.5 mr-1" />Planos</TabsTrigger>
            <TabsTrigger value="team">Equipe</TabsTrigger>
            <TabsTrigger value="appearance">Aparência</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
          </TabsList>

          {/* ===== APPOINTMENTS TAB ===== */}
          <TabsContent value="appointments">
            {/* Cancellation Alert Banner */}
            {cancelledToday.length > 0 && (
              <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <h3 className="font-bold text-red-400">⚠️ {cancelledToday.length} horário(s) cancelado(s) hoje — slots livres para encaixe!</h3>
                </div>
                <div className="space-y-1">
                  {cancelledToday.map(a => (
                    <div key={a.id} className="flex items-center gap-3 text-sm text-red-300">
                      <span className="font-mono bg-red-900/40 px-2 py-0.5 rounded">{a.appointment_time.substring(0, 5)}</span>
                      <span>{a.client_name}</span>
                      <span className="text-red-400/70">— {a.service_names?.join(", ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1"><CalendarIcon className="h-4 w-4" style={{ color: primaryColor }} /></div>
                <p className="text-2xl font-bold">{todayCount}</p>
                <p className="text-xs text-muted-foreground">Agendamentos hoje</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1"><DollarSign className="h-4 w-4" style={{ color: primaryColor }} /></div>
                <p className="text-2xl font-bold" style={{ color: primaryColor }}>R$ {todayRevenue.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Faturamento hoje</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1"><DollarSign className="h-4 w-4" style={{ color: primaryColor }} /></div>
                <p className="text-2xl font-bold">R$ {monthRevenue.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Este mês</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1"><ClipboardList className="h-4 w-4" style={{ color: primaryColor }} /></div>
                <p className="text-2xl font-bold" style={{ color: primaryColor }}>{todayPlanCount}</p>
                <p className="text-xs text-muted-foreground">Serviços por Assinatura</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1"><Star className="h-4 w-4 text-yellow-500 fill-yellow-500" /></div>
                <p className="text-2xl font-bold">{avgRating}</p>
                <p className="text-xs text-muted-foreground">Média ({avaliacoes?.length || 0} aval.)</p>
              </div>
            </div>

            {/* Appointments section */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>Agendamentos</h2>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-auto bg-muted text-foreground border-border"
                    placeholder="Filtrar por data"
                  />
                  {filterDate && (
                    <Button variant="ghost" size="sm" onClick={() => setFilterDate("")}>Limpar</Button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Pgto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allAppointments?.map((a) => (
                      <TableRow key={a.id} className={cn(a.status === "cancelado" && "opacity-40")}>
                        <TableCell>{a.appointment_date.split("-").reverse().join("/").substring(0, 5)}</TableCell>
                        <TableCell>{a.appointment_time.substring(0, 5)}</TableCell>
                        <TableCell className={cn(a.status === "cancelado" && "line-through text-muted-foreground")}>{a.client_name}</TableCell>
                        <TableCell className="text-xs">{a.client_phone}</TableCell>
                        <TableCell>
                          <span className={cn("text-sm", a.status === "cancelado" && "line-through text-muted-foreground")}>{a.service_names?.join(" + ")}</span>
                          <br /><span className="text-xs text-muted-foreground">{a.total_duration > 0 ? a.total_duration : a.service_names?.reduce((sum, name) => { const n = name.toLowerCase(); if (n.includes("corte")) return sum + 45; if (n.includes("barba")) return sum + 30; if (n.includes("sobrancelha") || n.includes("pigment")) return sum + 15; return sum + 30; }, 0)} min</span>
                        </TableCell>
                        <TableCell className="font-medium" style={{ color: a.status === "cancelado" ? "#6b7280" : primaryColor }}>R$ {Number(a.total_price).toFixed(2)}</TableCell>
                        <TableCell className="text-xs capitalize">{a.payment_method || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <select
                              value={a.status}
                              onChange={(e) => updateStatus(a.id, e.target.value)}
                              className={cn(
                                "rounded-full px-2 py-1 text-xs font-medium border-0 cursor-pointer",
                                a.status === "confirmado" ? "bg-blue-500/20 text-blue-400" :
                                  a.status === "finalizado" ? "bg-green-500/20 text-green-400" :
                                    a.status === "cancelado" ? "bg-red-500/20 text-red-400" :
                                      "bg-yellow-500/20 text-yellow-400"
                              )}
                            >
                              <option value="pendente">pendente</option>
                              <option value="confirmado">confirmado</option>
                              <option value="finalizado">finalizado</option>
                              <option value="cancelado">cancelado</option>
                            </select>
                            {/* Plano toggle badge — uses payment_method, not status */}
                            <button
                              onClick={() => togglePlanPayment(a.id, a.payment_method === "plano")}
                              title={a.payment_method === "plano" ? "Clique para remover tag Plano" : "Clique para marcar como Plano"}
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold border transition-all cursor-pointer",
                                a.payment_method === "plano"
                                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                  : "bg-transparent text-muted-foreground/40 border-border hover:border-purple-500/40 hover:text-purple-400"
                              )}
                            >
                              📋 Plano
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {a.client_phone && a.client_phone !== "N/A" && (
                              <a
                                href={a.status !== "cancelado" ? `https://wa.me/${a.client_phone}?text=${encodeURIComponent(`Lembrete de agendamento Olá, ${a.client_name}! Passando para confirmar seu agendamento de 💇🏽‍♂️ ${a.service_names?.join(", ")} hoje às ${a.appointment_time.substring(0, 5)}⌚ -> 💈 𝕭𝖆𝖗𝖇𝖊𝖆𝖗𝖎𝖆 𝕯𝖔 𝕽𝖔𝖒𝖊𝖑💈. Te aguardamos!`)}` : undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={a.status === "cancelado" ? (e) => e.preventDefault() : undefined}
                              >
                                <Button size="icon" variant="ghost" className="h-8 w-8" disabled={a.status === "cancelado"}>
                                  <MessageCircle className="h-4 w-4" style={{ color: a.status === "cancelado" ? "#6b7280" : primaryColor }} />
                                </Button>
                              </a>
                            )}
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditAppt(a)}><Edit2 className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteAppointment(a.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!allAppointments || allAppointments.length === 0) && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum agendamento encontrado.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* ===== QUICK SALE TAB ===== */}
          <TabsContent value="quicksale">
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Nome do Cliente */}
              <div className="rounded-lg border border-border bg-card p-5">
                <label className="text-sm font-medium text-yellow-500 mb-2 block">Nome do Cliente</label>
                <Input value={qsName} onChange={(e) => setQsName(e.target.value)} placeholder="Ex: João Silva" className="bg-background" />
              </div>

              {/* Data e Hora + Status */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                <label className="text-sm font-medium text-red-500 mb-2 block">Data e Hora do Atendimento</label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={qsDate}
                      onChange={(e) => setQsDate(e.target.value)}
                      className="bg-background w-auto"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <select value={qsHour} onChange={(e) => setQsHour(e.target.value)} className="rounded border border-border bg-background px-2 py-2 text-sm">
                      {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span>:</span>
                    <select value={qsMinute} onChange={(e) => setQsMinute(e.target.value)} className="rounded border border-border bg-background px-2 py-2 text-sm">
                      {["00", "15", "30", "45"].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-2">
                  <label className="text-sm font-medium mb-1 block">Status do Pagamento</label>
                  <Select value={qsPaymentStatus} onValueChange={setQsPaymentStatus}>
                    <SelectTrigger className="w-44 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark">
                      <SelectItem value="pago">✅ Pago</SelectItem>
                      <SelectItem value="pendente">⏳ Pendente</SelectItem>
                      <SelectItem value="fiado">📝 Fiado</SelectItem>
                      <SelectItem value="plano">📋 Plano (Assinatura)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Buscar Serviço */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                <label className="text-sm font-medium text-red-500">Buscar Serviço do Catálogo</label>
                <div className="relative">
                  <Input
                    value={qsSearch}
                    onChange={(e) => setQsSearch(e.target.value)}
                    placeholder="Buscar serviço..."
                    className="bg-background pl-8"
                  />
                  <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {services?.filter(s => s.active && s.name.toLowerCase().includes(qsSearch.toLowerCase())).map(s => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={qsServiceIds.includes(s.id)}
                        onCheckedChange={(c) => setQsServiceIds(prev => c ? [...prev, s.id] : prev.filter(id => id !== s.id))}
                      />
                      <span className="flex-1">{s.name}</span>
                      <span className="text-sm font-medium" style={{ color: primaryColor }}>R$ {Number(s.price).toFixed(2)}</span>
                    </label>
                  ))}
                </div>
                <div className="border-t border-border pt-3 mt-3">
                  <label className="text-sm font-medium mb-2 block">Serviço Adicional (livre)</label>
                  <div className="flex gap-2">
                    <Input value={qsCustomName} onChange={(e) => setQsCustomName(e.target.value)} placeholder="Nome do serviço" className="bg-background flex-1" />
                    <Input value={qsCustomPrice} onChange={(e) => setQsCustomPrice(e.target.value)} placeholder="Valor" type="number" className="bg-background w-24" />
                    <Button size="icon" variant="outline" onClick={() => { if (qsCustomName && qsCustomPrice) { setQsCustomServices(prev => [...prev, { name: qsCustomName, price: parseFloat(qsCustomPrice) }]); setQsCustomName(""); setQsCustomPrice(""); } }}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {qsCustomServices.map((s, i) => (
                    <div key={i} className="flex items-center justify-between mt-2 text-sm">
                      <span>{s.name}</span>
                      <div className="flex items-center gap-2">
                        <span style={{ color: primaryColor }}>R$ {s.price.toFixed(2)}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setQsCustomServices(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3 text-red-400" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Carrinho */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h4 className="text-sm font-medium flex items-center gap-2 mb-3">🛒 Carrinho de Serviços</h4>
                {qsServiceIds.length === 0 && qsCustomServices.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-4">Nenhum serviço adicionado.</p>
                ) : (
                  <div className="space-y-2">
                    {services?.filter(s => qsServiceIds.includes(s.id)).map(s => (
                      <div key={s.id} className="flex items-center justify-between text-sm">
                        <span>{s.name}</span>
                        <span style={{ color: primaryColor }}>R$ {Number(s.price).toFixed(2)}</span>
                      </div>
                    ))}
                    {qsCustomServices.map((s, i) => (
                      <div key={`c${i}`} className="flex items-center justify-between text-sm">
                        <span>{s.name}</span>
                        <span style={{ color: primaryColor }}>R$ {s.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-border mt-4 pt-4 flex items-center justify-between text-lg font-bold">
                  <span>Total a Pagar</span>
                  <span style={{ color: primaryColor }}>R$ {qsTotalPrice.toFixed(2)}</span>
                </div>
              </div>

              <Button onClick={handleQuickSale} disabled={qsServiceIds.length === 0 && qsCustomServices.length === 0} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-6 text-base">
                <Zap className="mr-2 h-5 w-5" /> FINALIZAR ATENDIMENTO
              </Button>
            </div>
          </TabsContent>

          {/* ===== SCHEDULE TAB ===== */}
          <TabsContent value="schedule">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Work shifts */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <Settings className="h-5 w-5" /> Turnos de Trabalho
                </h3>
                <div className="space-y-4">
                  {schedule?.map((c) => (
                    <div key={c.id} className={cn("rounded-lg border border-border p-4", c.is_open ? "bg-background" : "bg-muted/20")}>
                      <div className="flex items-center gap-3 mb-2">
                        <Switch checked={c.is_open} onCheckedChange={(v) => updateSchedule(c.id, { is_open: v })} />
                        <span className="font-medium w-20">{DAY_NAMES[c.day_of_week]}</span>
                        {!c.is_open && <span className="text-muted-foreground text-sm">Fechado</span>}
                      </div>
                      {c.is_open && (
                        <div className="ml-12 space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Input className="w-24 bg-card" type="time" value={c.open_time.substring(0, 5)} onChange={(e) => updateSchedule(c.id, { open_time: e.target.value })} />
                            <span className="text-muted-foreground">até</span>
                            <Input className="w-24 bg-card" type="time" value={c.close_time.substring(0, 5)} onChange={(e) => updateSchedule(c.id, { close_time: e.target.value })} />
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-red-400 text-xs">Pausa:</span>
                            <Input className="w-24 bg-card" type="time" value={c.lunch_start?.substring(0, 5) || ""} placeholder="--:--" onChange={(e) => updateSchedule(c.id, { lunch_start: e.target.value || null })} />
                            <span className="text-muted-foreground">até</span>
                            <Input className="w-24 bg-card" type="time" value={c.lunch_end?.substring(0, 5) || ""} placeholder="--:--" onChange={(e) => updateSchedule(c.id, { lunch_end: e.target.value || null })} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Block dates */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-lg font-bold text-primary mb-2 flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  🚫 Bloquear Data
                </h3>
                <p className="text-sm text-muted-foreground mb-4">Bloqueie datas para imprevistos, feriados ou folgas.</p>
                <Calendar
                  mode="single"
                  selected={blockDate}
                  onSelect={(date) => { if (date) { addBlock(date); setBlockDate(undefined); } }}
                  locale={ptBR}
                  modifiers={{ blocked: (date) => isDateBlocked(date) }}
                  modifiersStyles={{ blocked: { backgroundColor: 'hsl(0, 62%, 30%)', color: 'white', borderRadius: '0.375rem' } }}
                  className="pointer-events-auto"
                />
                {blockedSlots && blockedSlots.length > 0 && (
                  <div className="mt-4 space-y-1">
                    {blockedSlots.map(b => (
                      <div key={b.id} className="flex items-center justify-between text-sm">
                        <span>{b.blocked_date} {b.reason && `— ${b.reason}`}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { supabase.from("blocked_slots").delete().eq("id", b.id).then(() => refetchBlocked()); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ===== SERVICES TAB ===== */}
          <TabsContent value="services">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-primary flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                    <Clock className="h-5 w-5" /> Serviços, Duração e Intervalo
                  </h3>
                  <p className="text-sm text-muted-foreground">Defina o tempo de cada serviço e o intervalo (buffer) entre atendimentos.</p>
                </div>
                <Button onClick={openNewService} className="gap-2"><Plus className="h-4 w-4" />Novo Serviço</Button>
              </div>
              <div className="space-y-3">
                {services?.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-background p-4">
                    <div className="flex-1 min-w-[150px]">
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-sm" style={{ color: primaryColor }}>R$ {Number(s.price).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Duração:</span>
                      <select
                        value={s.duration}
                        onChange={(e) => updateServiceField(s.id, "duration", parseInt(e.target.value))}
                        className="rounded border border-border bg-card px-2 py-1 text-sm" style={{ color: primaryColor }}
                      >
                        {[15, 30, 45, 60, 90, 120].map(v => <option key={v} value={v}>{v} min</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Intervalo:</span>
                      <select
                        value={(s as any).interval_minutes || 0}
                        onChange={(e) => updateServiceField(s.id, "interval_minutes", parseInt(e.target.value))}
                        className="rounded border border-border bg-card px-2 py-1 text-sm" style={{ color: primaryColor }}
                      >
                        {[0, 5, 10, 15, 30].map(v => <option key={v} value={v}>{v} min</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={s.active} onCheckedChange={() => toggleService(s.id, s.active)} />
                      <span className="text-xs text-muted-foreground">Ativo</span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => openEditService(s)}><Edit2 className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={async () => { await supabase.from("services").delete().eq("id", s.id); refetchServices(); toast.success("Serviço excluído!"); }}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ===== PLANS REPORT TAB ===== */}
          <TabsContent value="plans">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-primary flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                    <FileText className="h-5 w-5" /> Relatório de Planos (Assinaturas)
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">Atendimentos realizados por clientes com plano/assinatura (não contabilizados no caixa).</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-muted-foreground">Filtrar por mês:</label>
                  <input
                    type="month"
                    value={planReportMonth}
                    onChange={(e) => setPlanReportMonth(e.target.value)}
                    className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      const win = window.open('', '_blank');
                      if (!win) return;
                      const monthLabel = planReportMonth;
                      const rows = planAppointments.map(a =>
                        `<tr><td>${a.appointment_date.split('-').reverse().join('/')}</td><td>${a.appointment_time.substring(0, 5)}</td><td>${a.client_name}</td><td>${a.client_phone}</td><td>${a.service_names?.join(' + ')}</td><td>R$ ${Number(a.total_price).toFixed(2)}</td></tr>`
                      ).join('');
                      const total = planAppointments.reduce((s, a) => s + Number(a.total_price), 0).toFixed(2);
                      win.document.write(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Relatório de Planos - ${monthLabel}</title><style>body{font-family:Arial,sans-serif;padding:30px;color:#111}h1{font-size:22px;margin-bottom:4px}p{color:#666;margin:0 0 20px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#222;color:#fff;padding:8px 12px;text-align:left}td{border-bottom:1px solid #ddd;padding:8px 12px}.total{font-weight:bold;margin-top:16px;font-size:14px}.badge{background:#dbeafe;color:#1d4ed8;border-radius:9999px;padding:2px 8px;font-size:11px;font-weight:600}</style></head><body><h1>📊 Relatório Mensal de Planos</h1><p>Período: ${monthLabel} &mdash; ${planAppointments.length} atendimento(s)</p><table><tr><th>Data</th><th>Hora</th><th>Cliente</th><th>Telefone</th><th>Serviço</th><th>Valor de Tabela</th></tr>${rows}</table><p class='total'>Total de referência: R$ ${total} <span class='badge'>Não entra no caixa</span></p></body></html>`);
                      win.document.close();
                      win.print();
                    }}
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir / PDF
                  </Button>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <div className="rounded-lg border border-border bg-background p-4 text-center">
                  <p className="text-3xl font-black" style={{ color: primaryColor }}>{planAppointments.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Atendimentos de plano no período</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4 text-center">
                  <p className="text-3xl font-black text-muted-foreground">R$ 0,00</p>
                  <p className="text-xs text-muted-foreground mt-1">Impacto no caixa (nenhum)</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4 text-center">
                  <p className="text-3xl font-black text-amber-400">R$ {planAppointments.reduce((sum, a) => sum + Number(a.total_price), 0).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Valor de tabela (referência)</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead>Nome do Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Serviço Realizado</TableHead>
                      <TableHead>Valor de Tabela</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {planAppointments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.appointment_date.split("-").reverse().join("/")}</TableCell>
                        <TableCell>{a.appointment_time.substring(0, 5)}</TableCell>
                        <TableCell className="font-medium">{a.client_name}</TableCell>
                        <TableCell className="text-xs">{a.client_phone}</TableCell>
                        <TableCell><span className="text-sm">{a.service_names?.join(" + ")}</span></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground line-through text-sm">R$ {Number(a.total_price).toFixed(2)}</span>
                            <span className="ml-2 rounded-full bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 font-medium">Plano</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {planAppointments.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        Nenhum atendimento de plano encontrado para este período.
                      </TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* ===== TEAM TAB ===== */}
          <TabsContent value="team">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-lg font-bold text-primary mb-2 flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <Users className="h-5 w-5" /> Cadastrar Barbeiro
                </h3>
                <p className="text-sm text-muted-foreground mb-4">Cadastre um novo barbeiro que terá acesso ao painel administrativo.</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Email do barbeiro</label>
                    <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="barbeiro@email.com" className="bg-background" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Senha provisória (mín. 6 caracteres)</label>
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-background" />
                  </div>
                  <Button onClick={createTeamMember} disabled={!newEmail || newPassword.length < 6} className="gap-2 bg-green-600 hover:bg-green-700">
                    <Users className="h-4 w-4" /> Criar Conta de Barbeiro
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <Settings className="h-5 w-5" /> Barbeiros Cadastrados
                </h3>
                {teamMembers.length === 0 && <p className="text-muted-foreground text-center py-4">Nenhum barbeiro cadastrado.</p>}
                <div className="space-y-3">
                  {teamMembers.map(m => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
                      <div>
                        <p className="font-medium">{m.email}</p>
                        <p className="text-xs" style={{ color: primaryColor }}>Criado em {m.created_at ? format(new Date(m.created_at), "dd/MM/yyyy") : "—"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => { setPasswordDialog(m.id); setNewPwd(""); }}>
                          <Key className="h-3 w-3" /> Senha
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteTeamMember(m.id)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="appearance">
            <div className="space-y-6">
              {/* Colors */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <Palette className="h-5 w-5" /> Cores do Site
                </h3>
                <p className="text-sm text-muted-foreground mb-4">As cores serão aplicadas em todo o site (landing, agendamento, painel).</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Cor Principal (botões, destaques)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settingsLocal.primary_color || "#d1b122"}
                        onChange={(e) => setSettingsLocal(prev => ({ ...prev, primary_color: e.target.value }))}
                        className="h-10 w-14 rounded border border-border cursor-pointer"
                      />
                      <span className="text-sm text-muted-foreground">{settingsLocal.primary_color || "#d1b122"}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Cor de Fundo</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settingsLocal.bg_color || "#000000"}
                        onChange={(e) => setSettingsLocal(prev => ({ ...prev, bg_color: e.target.value }))}
                        className="h-10 w-14 rounded border border-border cursor-pointer"
                      />
                      <span className="text-sm text-muted-foreground">{settingsLocal.bg_color || "#000000"}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Cor de Informações (telefone, horário, local)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settingsLocal.info_color || "#d1b122"}
                        onChange={(e) => setSettingsLocal(prev => ({ ...prev, info_color: e.target.value }))}
                        className="h-10 w-14 rounded border border-border cursor-pointer"
                      />
                      <span className="text-sm text-muted-foreground">{settingsLocal.info_color || "#d1b122"}</span>
                    </div>
                  </div>
                </div>
                <Button className="mt-4" onClick={() => { saveSetting("primary_color"); saveSetting("bg_color"); saveSetting("info_color"); }}>Salvar Cores</Button>
              </div>

              {/* Background Image */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-lg font-bold text-primary mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                  🖼️ Imagem de Fundo
                </h3>
                <p className="text-sm text-muted-foreground mb-4">Imagem exibida na página inicial do site.</p>
                {settingsLocal.background_url && (
                  <div className="mb-4 rounded-lg overflow-hidden border border-border">
                    <img src={settingsLocal.background_url} alt="Fundo atual" className="w-full h-40 object-cover" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("type", "background");
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-asset`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${session?.access_token}` },
                        body: formData,
                      });
                      const json = await res.json();
                      if (json?.url) {
                        setSettingsLocal(prev => ({ ...prev, background_url: json.url }));
                        qc.invalidateQueries({ queryKey: ["business_settings"] });
                        toast.success("Imagem de fundo atualizada!");
                      } else {
                        throw new Error(json?.error || "Erro ao enviar");
                      }
                    } catch (err: any) {
                      toast.error(err.message || "Erro ao enviar imagem.");
                    }
                  }}
                  className="text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:font-medium file:cursor-pointer"
                />
              </div>

              {/* Logo */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-lg font-bold text-primary mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                  ✂️ Logo
                </h3>
                <p className="text-sm text-muted-foreground mb-4">Logo exibida no site.</p>
                {settingsLocal.logo_url && (
                  <div className="mb-4">
                    <img src={settingsLocal.logo_url} alt="Logo atual" className="h-24 object-contain rounded" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("type", "logo");
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-asset`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${session?.access_token}` },
                        body: formData,
                      });
                      const json = await res.json();
                      if (json?.url) {
                        setSettingsLocal(prev => ({ ...prev, logo_url: json.url }));
                        qc.invalidateQueries({ queryKey: ["business_settings"] });
                        toast.success("Logo atualizada!");
                      } else {
                        throw new Error(json?.error || "Erro ao enviar");
                      }
                    } catch (err: any) {
                      toast.error(err.message || "Erro ao enviar logo.");
                    }
                  }}
                  className="text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:font-medium file:cursor-pointer"
                />
              </div>

              {/* Typography */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-lg font-bold text-primary mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                  T Tipografia
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Fonte do Site</label>
                    <select
                      value={settingsLocal.font || "Poppins"}
                      onChange={(e) => setSettingsLocal(prev => ({ ...prev, font: e.target.value }))}
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                    >
                      {["Inter", "Poppins", "Playfair Display", "Roboto", "Open Sans", "Montserrat"].map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-xs text-muted-foreground mb-2">Pré-visualização:</p>
                    <p className="text-lg font-bold text-primary" style={{ fontFamily: settingsLocal.font || 'Poppins' }}>Título de Exemplo</p>
                    <p className="text-sm" style={{ fontFamily: settingsLocal.font || 'Poppins' }}>Texto do corpo com a fonte selecionada.</p>
                  </div>
                </div>
                <Button className="mt-4 w-full" onClick={() => saveSetting("font")}>Salvar Tipografia</Button>
              </div>
            </div>
          </TabsContent>

          {/* ===== CONFIG TAB ===== */}
          <TabsContent value="config">
            <div className="max-w-2xl mx-auto">
              <div className="rounded-lg border border-border bg-card p-5 space-y-6">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <Settings className="h-5 w-5" /> Configurações Globais
                </h3>
                <p className="text-sm text-muted-foreground">Altere o nome do estabelecimento e configurações de agendamento.</p>

                <div>
                  <label className="text-sm font-semibold mb-1 block">Nome do Estabelecimento</label>
                  <Input value={settingsLocal.business_name || ""} onChange={(e) => setSettingsLocal(prev => ({ ...prev, business_name: e.target.value }))} className="bg-background" />
                  <Button className="mt-2 bg-green-600 hover:bg-green-700 gap-2" size="sm" onClick={() => saveSetting("business_name")}>
                    <Settings className="h-3 w-3" /> Salvar Nome
                  </Button>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-1 block">WhatsApp</label>
                  <Input value={settingsLocal.whatsapp || ""} onChange={(e) => setSettingsLocal(prev => ({ ...prev, whatsapp: e.target.value }))} placeholder="5571999999999" className="bg-background" />
                  <Button className="mt-2" size="sm" onClick={() => saveSetting("whatsapp")}>Salvar</Button>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-1 block">Chave PIX</label>
                  <Input value={settingsLocal.pix_key || ""} onChange={(e) => setSettingsLocal(prev => ({ ...prev, pix_key: e.target.value }))} className="bg-background" />
                  <Button className="mt-2" size="sm" onClick={() => saveSetting("pix_key")}>Salvar</Button>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-1 block">Endereço</label>
                  <Input value={settingsLocal.address || ""} onChange={(e) => setSettingsLocal(prev => ({ ...prev, address: e.target.value }))} className="bg-background" />
                  <Button className="mt-2" size="sm" onClick={() => saveSetting("address")}>Salvar</Button>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-1 block">Intervalo entre agendamentos (minutos)</label>
                  <p className="text-xs text-muted-foreground mb-2">Buffer de tempo entre um atendimento e outro. Padrão: 45 min.</p>
                  <div className="flex items-center gap-2">
                    <select
                      value={settingsLocal.buffer_minutes || "45"}
                      onChange={(e) => setSettingsLocal(prev => ({ ...prev, buffer_minutes: e.target.value }))}
                      className="rounded border border-border bg-background px-3 py-2 text-sm"
                    >
                      {[15, 30, 45, 60, 90].map(v => <option key={v} value={String(v)}>{v} min</option>)}
                    </select>
                    <Button size="sm" onClick={() => saveSetting("buffer_minutes")}>Salvar</Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-1 block">Antecedência mínima para cancelamento</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Clientes só podem cancelar/reagendar com esta antecedência. Uma margem de 5 minutos é sempre concedida (para quem percebe o erro logo após agendar).
                  </p>
                  <div className="flex items-center gap-2">
                    <select
                      value={settingsLocal.cancel_minutes_limit || "120"}
                      onChange={(e) => setSettingsLocal(prev => ({ ...prev, cancel_minutes_limit: e.target.value }))}
                      className="rounded border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="15">15 minutos</option>
                      <option value="30">30 minutos</option>
                      <option value="60">1 hora</option>
                      <option value="120">2 horas (padrão)</option>
                      <option value="240">4 horas</option>
                      <option value="720">12 horas</option>
                      <option value="1440">24 horas</option>
                    </select>
                    <Button size="sm" onClick={() => saveSetting("cancel_minutes_limit")}>Salvar</Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Appointment Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="dark max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>Editar Serviços</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Serviços do catálogo</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {services?.filter(s => s.active).map(s => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={editServiceIds.includes(s.id)}
                      onCheckedChange={(c) => setEditServiceIds(prev => c ? [...prev, s.id] : prev.filter(id => id !== s.id))}
                    />
                    <span className="flex-1">{s.name}</span>
                    <span className="text-sm" style={{ color: primaryColor }}>R$ {Number(s.price).toFixed(2)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Serviço customizado</label>
              <div className="flex gap-2">
                <Input value={customServiceName} onChange={(e) => setCustomServiceName(e.target.value)} placeholder="Nome do serviço" className="flex-1 bg-zinc-800 text-white border-border" style={{ color: 'white' }} />
                <Input value={customServicePrice} onChange={(e) => setCustomServicePrice(e.target.value)} placeholder="Valor" type="number" className="w-24 bg-zinc-800 text-white border-border" style={{ color: 'white' }} />
                <Button size="icon" variant="outline" onClick={addCustomService}><Plus className="h-4 w-4" /></Button>
              </div>
              {customServices.map((s, i) => (
                <div key={i} className="flex items-center justify-between mt-2 text-sm border border-border rounded p-2">
                  <span>{s.name}</span>
                  <div className="flex items-center gap-2">
                    <span style={{ color: primaryColor }}>R$ {s.price.toFixed(2)}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCustomServices(prev => prev.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {editAppt && (
              <div className="rounded border border-border bg-background p-3 text-sm">
                <p className="text-muted-foreground">Descrição:</p>
                <p className="font-medium">
                  {[
                    ...services?.filter(s => editServiceIds.includes(s.id)).map(s => s.name) || [],
                    ...customServices.map(s => s.name)
                  ].join(" + ")}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between text-lg font-bold">
              <span>Novo Total:</span>
              <span style={{ color: primaryColor }}>R$ {editNewTotal.toFixed(2)}</span>
            </div>

            <Button onClick={saveEditAppt} className="w-full text-black" style={{ backgroundColor: primaryColor }}>Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={!!passwordDialog} onOpenChange={() => setPasswordDialog(null)}>
        <DialogContent className="dark">
          <DialogHeader><DialogTitle>Alterar Senha</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Nova senha (mín. 6 caracteres)" />
            <Button onClick={updateTeamPassword} disabled={newPwd.length < 6} className="w-full">Salvar Senha</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Service Dialog */}
      <Dialog open={serviceDialog} onOpenChange={setServiceDialog}>
        <DialogContent className="dark">
          <DialogHeader><DialogTitle>{editService ? "Editar Serviço" : "Novo Serviço"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome</label>
              <Input placeholder="Ex: Corte Degradê" value={sName} onChange={(e) => setSName(e.target.value)} className="bg-zinc-800 text-white border-border focus:border-yellow-500" style={{ color: 'white' }} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Preço (R$)</label>
              <Input placeholder="Ex: 45.00" type="number" value={sPrice} onChange={(e) => setSPrice(e.target.value)} className="bg-zinc-800 text-white border-border focus:border-yellow-500" style={{ color: 'white' }} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Duração (minutos)</label>
              <Input placeholder="Ex: 45" type="number" value={sDuration} onChange={(e) => setSDuration(e.target.value)} className="bg-zinc-800 text-white border-border focus:border-yellow-500" style={{ color: 'white' }} />
            </div>
            <Button onClick={saveService} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
