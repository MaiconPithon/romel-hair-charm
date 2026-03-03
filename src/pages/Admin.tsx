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
import { LogOut, Plus, Trash2, Edit2, Home, CalendarIcon, Star, DollarSign, MessageCircle, Key, Clock, Settings, Palette, Users, Zap, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const Admin = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filterDate, setFilterDate] = useState("");
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
  const todayRevenue = todayAppointments?.filter(a => a.status === "finalizado").reduce((sum, a) => sum + Number(a.total_price), 0) || 0;
  
  const now = new Date();
  const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
  const monthRevenue = allAppointments?.filter(a => a.status === "finalizado" && a.appointment_date >= monthStart).reduce((sum, a) => sum + Number(a.total_price), 0) || 0;
  const totalRevenue = allAppointments?.filter(a => a.status === "finalizado").reduce((sum, a) => sum + Number(a.total_price), 0) || 0;
  const avgRating = avaliacoes?.length ? (avaliacoes.reduce((sum, a) => sum + a.stars, 0) / avaliacoes.length).toFixed(0) : "0";

  // Appointment actions
  const updateStatus = async (id: string, status: string) => {
    await supabase.from("appointments").update({ status }).eq("id", id);
    refetchAppts();
    toast.success("Status atualizado!");
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
  const [customServices, setCustomServices] = useState<{name: string; price: number}[]>([]);

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
  const [qsCustomServices, setQsCustomServices] = useState<{name: string; price: number}[]>([]);
  const [qsPaymentStatus, setQsPaymentStatus] = useState("pago");

  const qsTotalPrice = (() => {
    const catalog = services?.filter(s => qsServiceIds.includes(s.id)).reduce((sum, s) => sum + Number(s.price), 0) || 0;
    const custom = qsCustomServices.reduce((sum, s) => sum + s.price, 0);
    return catalog + custom;
  })();

  const handleQuickSale = async () => {
    const catalogChosen = services?.filter((s) => qsServiceIds.includes(s.id)) || [];
    const allNames = [...catalogChosen.map(s => s.name), ...qsCustomServices.map(s => s.name)];
    const totalDuration = catalogChosen.reduce((sum, s) => sum + s.duration, 0);
    await supabase.from("appointments").insert({
      client_name: qsName || "Venda Rápida",
      client_phone: "N/A",
      service_ids: qsServiceIds,
      service_names: allNames,
      appointment_date: format(new Date(), "yyyy-MM-dd"),
      appointment_time: format(new Date(), "HH:mm:ss"),
      status: "finalizado",
      payment_method: "dinheiro",
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
            <TabsTrigger value="appointments">Agendamentos</TabsTrigger>
            <TabsTrigger value="quicksale">Venda</TabsTrigger>
            <TabsTrigger value="schedule">Agenda</TabsTrigger>
            <TabsTrigger value="services">Serviços</TabsTrigger>
            <TabsTrigger value="team">Equipe</TabsTrigger>
            <TabsTrigger value="appearance">Aparência</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
          </TabsList>

          {/* ===== APPOINTMENTS TAB ===== */}
          <TabsContent value="appointments">
            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1"><CalendarIcon className="h-4 w-4 text-green-500" /></div>
                <p className="text-2xl font-bold">{todayCount}</p>
                <p className="text-xs text-muted-foreground">Agendamentos hoje</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1"><DollarSign className="h-4 w-4 text-green-500" /></div>
                <p className="text-2xl font-bold text-green-500">R$ {todayRevenue.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Faturamento hoje</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1"><DollarSign className="h-4 w-4 text-green-500" /></div>
                <p className="text-2xl font-bold">R$ {monthRevenue.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Este mês</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1"><DollarSign className="h-4 w-4 text-green-500" /></div>
                <p className="text-2xl font-bold">R$ {totalRevenue.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total geral</p>
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
                    className="w-auto bg-background"
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
                      <TableRow key={a.id}>
                        <TableCell>{a.appointment_date.split("-").reverse().join("/").substring(0, 5)}</TableCell>
                        <TableCell>{a.appointment_time.substring(0, 5)}</TableCell>
                        <TableCell>{a.client_name}</TableCell>
                        <TableCell className="text-xs">{a.client_phone}</TableCell>
                        <TableCell>
                          <span className="text-sm">{a.service_names?.join(" + ")}</span>
                          <br /><span className="text-xs text-muted-foreground">{a.total_duration} min</span>
                        </TableCell>
                        <TableCell className="text-green-500 font-medium">R$ {Number(a.total_price).toFixed(2)}</TableCell>
                        <TableCell className="text-xs capitalize">{a.payment_method || "—"}</TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {a.client_phone && a.client_phone !== "N/A" && (
                              <a href={`https://wa.me/${a.client_phone}`} target="_blank" rel="noopener noreferrer">
                                <Button size="icon" variant="ghost" className="h-8 w-8"><MessageCircle className="h-4 w-4 text-green-500" /></Button>
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
              <div className="rounded-lg border border-border bg-card p-5">
                <label className="text-sm font-medium mb-2 block">Nome do Cliente</label>
                <Input value={qsName} onChange={(e) => setQsName(e.target.value)} placeholder="Ex: João Silva" className="bg-background" />
              </div>

              <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                <label className="text-sm font-medium">Buscar Serviço do Catálogo</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {services?.filter(s => s.active).map(s => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={qsServiceIds.includes(s.id)}
                        onCheckedChange={(c) => setQsServiceIds(prev => c ? [...prev, s.id] : prev.filter(id => id !== s.id))}
                      />
                      <span className="flex-1">{s.name}</span>
                      <span className="text-green-500 text-sm font-medium">R$ {Number(s.price).toFixed(2)}</span>
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
                        <span className="text-green-500">R$ {s.price.toFixed(2)}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setQsCustomServices(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3 text-red-400" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>Total a Pagar</span>
                  <span className="text-green-500">R$ {qsTotalPrice.toFixed(2)}</span>
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
                      <p className="text-sm text-green-500">R$ {Number(s.price).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Duração:</span>
                      <select
                        value={s.duration}
                        onChange={(e) => updateServiceField(s.id, "duration", parseInt(e.target.value))}
                        className="rounded border border-border bg-card px-2 py-1 text-sm text-green-500"
                      >
                        {[15,30,45,60,90,120].map(v => <option key={v} value={v}>{v} min</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Intervalo:</span>
                      <select
                        value={(s as any).interval_minutes || 0}
                        onChange={(e) => updateServiceField(s.id, "interval_minutes", parseInt(e.target.value))}
                        className="rounded border border-border bg-card px-2 py-1 text-sm text-green-500"
                      >
                        {[0,5,10,15,30].map(v => <option key={v} value={v}>{v} min</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={s.active} onCheckedChange={() => toggleService(s.id, s.active)} />
                      <span className="text-xs text-muted-foreground">Ativo</span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => openEditService(s)}><Edit2 className="h-4 w-4" /></Button>
                  </div>
                ))}
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
                        <p className="text-xs text-green-500">Criado em {m.created_at ? format(new Date(m.created_at), "dd/MM/yyyy") : "—"}</p>
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

          {/* ===== APPEARANCE TAB ===== */}
          <TabsContent value="appearance">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <Palette className="h-5 w-5" /> Cores
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Cor Principal</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settingsLocal.primary_color || "#166434"}
                        onChange={(e) => setSettingsLocal(prev => ({ ...prev, primary_color: e.target.value }))}
                        className="h-10 w-14 rounded border border-border cursor-pointer"
                      />
                      <span className="text-sm text-muted-foreground">{settingsLocal.primary_color || "#166434"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Botões, destaques e acentos.</p>
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
                    <p className="text-xs text-muted-foreground mt-1">Fundo geral do site.</p>
                  </div>
                </div>
                <Button className="mt-4 w-full" onClick={() => { saveSetting("primary_color"); saveSetting("bg_color"); }}>Salvar Aparência</Button>
              </div>

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
                    <span className="text-green-500 text-sm">R$ {Number(s.price).toFixed(2)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Serviço customizado</label>
              <div className="flex gap-2">
                <Input value={customServiceName} onChange={(e) => setCustomServiceName(e.target.value)} placeholder="Nome do serviço" className="flex-1" />
                <Input value={customServicePrice} onChange={(e) => setCustomServicePrice(e.target.value)} placeholder="Valor" type="number" className="w-24" />
                <Button size="icon" variant="outline" onClick={addCustomService}><Plus className="h-4 w-4" /></Button>
              </div>
              {customServices.map((s, i) => (
                <div key={i} className="flex items-center justify-between mt-2 text-sm border border-border rounded p-2">
                  <span>{s.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-green-500">R$ {s.price.toFixed(2)}</span>
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
              <span className="text-green-500">R$ {editNewTotal.toFixed(2)}</span>
            </div>

            <Button onClick={saveEditAppt} className="w-full bg-green-600 hover:bg-green-700">Salvar Alterações</Button>
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
          <div className="space-y-3">
            <Input placeholder="Nome" value={sName} onChange={(e) => setSName(e.target.value)} />
            <Input placeholder="Preço" type="number" value={sPrice} onChange={(e) => setSPrice(e.target.value)} />
            <Input placeholder="Duração (min)" type="number" value={sDuration} onChange={(e) => setSDuration(e.target.value)} />
            <Button onClick={saveService} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
