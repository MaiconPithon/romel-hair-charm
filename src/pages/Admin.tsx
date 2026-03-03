import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppointments } from "@/hooks/useAppointments";
import { useServices } from "@/hooks/useServices";
import { useScheduleConfig } from "@/hooks/useScheduleConfig";
import { useBlockedSlots } from "@/hooks/useBlockedSlots";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { LogOut, Plus, Trash2, Edit2 } from "lucide-react";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const Admin = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filterDate, setFilterDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const { data: appointments, refetch: refetchAppts } = useAppointments(filterDate);
  const { data: services, refetch: refetchServices } = useServices(false);
  const { data: schedule, refetch: refetchSchedule } = useScheduleConfig();
  const { data: blockedSlots, refetch: refetchBlocked } = useBlockedSlots();
  const { data: settings, refetch: refetchSettings } = useBusinessSettings();

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

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

  // Service management
  const [serviceDialog, setServiceDialog] = useState(false);
  const [editService, setEditService] = useState<any>(null);
  const [sName, setSName] = useState("");
  const [sPrice, setSPrice] = useState("");
  const [sDuration, setSDuration] = useState("");

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

  const deleteService = async (id: string) => {
    await supabase.from("services").delete().eq("id", id);
    refetchServices();
    toast.success("Serviço removido.");
  };

  // Schedule config
  const updateSchedule = async (id: string, updates: any) => {
    await supabase.from("schedule_config").update(updates).eq("id", id);
    refetchSchedule();
    toast.success("Horário atualizado!");
  };

  // Blocked slots
  const [blockDate, setBlockDate] = useState("");
  const [blockTime, setBlockTime] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockAllDay, setBlockAllDay] = useState(false);

  const addBlock = async () => {
    if (!blockDate) return;
    await supabase.from("blocked_slots").insert({
      blocked_date: blockDate,
      blocked_time: blockAllDay ? null : (blockTime ? blockTime + ":00" : null),
      reason: blockReason || null,
      all_day: blockAllDay,
    });
    setBlockDate(""); setBlockTime(""); setBlockReason(""); setBlockAllDay(false);
    refetchBlocked();
    toast.success("Bloqueio adicionado!");
  };

  const deleteBlock = async (id: string) => {
    await supabase.from("blocked_slots").delete().eq("id", id);
    refetchBlocked();
  };

  // Business settings
  const [settingsLocal, setSettingsLocal] = useState<Record<string, string>>({});
  useEffect(() => { if (settings) setSettingsLocal(settings); }, [settings]);

  const saveSetting = async (key: string) => {
    await supabase.from("business_settings").update({ value: settingsLocal[key] || "" }).eq("key", key);
    refetchSettings();
    toast.success("Configuração salva!");
  };

  // Quick sale
  const [qsName, setQsName] = useState("");
  const [qsPhone, setQsPhone] = useState("");
  const [qsServiceIds, setQsServiceIds] = useState<string[]>([]);

  const handleQuickSale = async () => {
    const chosen = services?.filter((s) => qsServiceIds.includes(s.id)) || [];
    const totalPrice = chosen.reduce((sum, s) => sum + Number(s.price), 0);
    const totalDuration = chosen.reduce((sum, s) => sum + s.duration, 0);
    await supabase.from("appointments").insert({
      client_name: qsName || "Venda Rápida",
      client_phone: qsPhone || "N/A",
      service_ids: qsServiceIds,
      service_names: chosen.map((s) => s.name),
      appointment_date: format(new Date(), "yyyy-MM-dd"),
      appointment_time: format(new Date(), "HH:mm:ss"),
      status: "finalizado",
      payment_method: "dinheiro",
      total_price: totalPrice,
      total_duration: totalDuration,
    });
    setQsName(""); setQsPhone(""); setQsServiceIds([]);
    refetchAppts();
    toast.success("Venda registrada!");
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-xl font-bold">Painel Admin</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />Sair</Button>
      </header>

      <div className="mx-auto max-w-5xl p-4">
        <Tabs defaultValue="appointments">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="appointments">Agendamentos</TabsTrigger>
            <TabsTrigger value="services">Serviços</TabsTrigger>
            <TabsTrigger value="schedule">Horários</TabsTrigger>
            <TabsTrigger value="blocks">Bloqueios</TabsTrigger>
            <TabsTrigger value="quicksale">Venda Rápida</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          {/* Appointments */}
          <TabsContent value="appointments">
            <div className="mb-4 flex items-center gap-3">
              <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-auto" />
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviços</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments?.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.appointment_time.substring(0, 5)}</TableCell>
                      <TableCell>{a.client_name}<br /><span className="text-xs text-muted-foreground">{a.client_phone}</span></TableCell>
                      <TableCell className="text-xs">{a.service_names?.join(", ")}</TableCell>
                      <TableCell>R$ {Number(a.total_price).toFixed(2)}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.status === "confirmado" ? "bg-blue-500/20 text-blue-400" : a.status === "finalizado" ? "bg-green-500/20 text-green-400" : a.status === "cancelado" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                          {a.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {a.status === "pendente" && <Button size="sm" variant="outline" onClick={() => updateStatus(a.id, "confirmado")}>Confirmar</Button>}
                          {a.status === "confirmado" && <Button size="sm" variant="outline" onClick={() => updateStatus(a.id, "finalizado")}>Finalizar</Button>}
                          {a.status !== "cancelado" && a.status !== "finalizado" && <Button size="sm" variant="ghost" onClick={() => updateStatus(a.id, "cancelado")}>Cancelar</Button>}
                          <Button size="sm" variant="ghost" onClick={() => deleteAppointment(a.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!appointments || appointments.length === 0) && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum agendamento</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Services */}
          <TabsContent value="services">
            <Button className="mb-4" onClick={openNewService}><Plus className="mr-2 h-4 w-4" />Novo Serviço</Button>
            <div className="space-y-2">
              {services?.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <Switch checked={s.active} onCheckedChange={() => toggleService(s.id, s.active)} />
                  <div className="flex-1">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">R$ {Number(s.price).toFixed(2)} · {s.duration} min</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => openEditService(s)}><Edit2 className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteService(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
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
          </TabsContent>

          {/* Schedule */}
          <TabsContent value="schedule">
            <div className="space-y-3">
              {schedule?.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <div className="w-24 font-medium">{DAY_NAMES[c.day_of_week]}</div>
                  <Switch checked={c.is_open} onCheckedChange={(v) => updateSchedule(c.id, { is_open: v })} />
                  {c.is_open && (
                    <>
                      <Input className="w-24" type="time" value={c.open_time.substring(0, 5)} onChange={(e) => updateSchedule(c.id, { open_time: e.target.value })} />
                      <span className="text-muted-foreground">até</span>
                      <Input className="w-24" type="time" value={c.close_time.substring(0, 5)} onChange={(e) => updateSchedule(c.id, { close_time: e.target.value })} />
                      <span className="text-xs text-muted-foreground">Almoço:</span>
                      <Input className="w-24" type="time" value={c.lunch_start?.substring(0, 5) || ""} onChange={(e) => updateSchedule(c.id, { lunch_start: e.target.value || null })} />
                      <Input className="w-24" type="time" value={c.lunch_end?.substring(0, 5) || ""} onChange={(e) => updateSchedule(c.id, { lunch_end: e.target.value || null })} />
                    </>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Blocks */}
          <TabsContent value="blocks">
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Data</label>
                <Input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} className="w-auto" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={blockAllDay} onCheckedChange={setBlockAllDay} />
                <span className="text-sm">Dia inteiro</span>
              </div>
              {!blockAllDay && (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Hora</label>
                  <Input type="time" value={blockTime} onChange={(e) => setBlockTime(e.target.value)} className="w-auto" />
                </div>
              )}
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">Motivo</label>
                <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Motivo (opcional)" />
              </div>
              <Button onClick={addBlock}>Bloquear</Button>
            </div>
            <div className="space-y-2">
              {blockedSlots?.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                  <div>
                    <span className="font-medium">{b.blocked_date}</span>
                    {b.all_day ? <span className="ml-2 text-xs text-muted-foreground">Dia inteiro</span> : b.blocked_time && <span className="ml-2 text-xs text-muted-foreground">{b.blocked_time.substring(0, 5)}</span>}
                    {b.reason && <span className="ml-2 text-xs text-muted-foreground">— {b.reason}</span>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteBlock(b.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Quick Sale */}
          <TabsContent value="quicksale">
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              <Input placeholder="Nome do cliente (opcional)" value={qsName} onChange={(e) => setQsName(e.target.value)} />
              <Input placeholder="Telefone (opcional)" value={qsPhone} onChange={(e) => setQsPhone(e.target.value)} />
              <div className="space-y-2">
                {services?.filter((s) => s.active).map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={qsServiceIds.includes(s.id)} onChange={(e) => setQsServiceIds((prev) => e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id))} />
                    <span>{s.name} — R$ {Number(s.price).toFixed(2)}</span>
                  </label>
                ))}
              </div>
              <Button onClick={handleQuickSale} disabled={qsServiceIds.length === 0} className="w-full">Registrar Venda</Button>
            </div>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings">
            <div className="space-y-4">
              {[
                { key: "business_name", label: "Nome do Negócio" },
                { key: "whatsapp", label: "WhatsApp" },
                { key: "pix_key", label: "Chave PIX" },
                { key: "address", label: "Endereço" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium">{label}</label>
                    <Input value={settingsLocal[key] || ""} onChange={(e) => setSettingsLocal((prev) => ({ ...prev, [key]: e.target.value }))} />
                  </div>
                  <Button onClick={() => saveSetting(key)}>Salvar</Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
