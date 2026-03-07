import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Calendar, Clock, X, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";

const GRACE_PERIOD_MINUTES = 5; // Always allow cancel if booked within last 5 min

const MeusAgendamentos = () => {
    const navigate = useNavigate();
    const { data: settings } = useBusinessSettings();
    const primaryColor = settings?.primary_color || "#d1b122";

    // Read cancel limit in minutes. New key = cancel_minutes_limit; fallback to old hours key.
    const cancelMinutesLimit = settings?.cancel_minutes_limit
        ? parseInt(settings.cancel_minutes_limit)
        : settings?.cancel_hours_limit
            ? parseInt(settings.cancel_hours_limit) * 60
            : 120; // default: 2 hours

    const formatLimitLabel = (mins: number) => {
        if (mins < 60) return `${mins} minutos`;
        if (mins === 60) return "1 hora";
        return `${mins / 60} horas`;
    };

    const [phone, setPhone] = useState("");
    const [searching, setSearching] = useState(false);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [searched, setSearched] = useState(false);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const searchAppointments = async () => {
        if (!phone.trim() || phone.trim().length < 8) {
            toast.error("Digite um número de telefone válido (mínimo 8 dígitos).");
            return;
        }
        setSearching(true);
        setSearched(false);
        try {
            const today = format(new Date(), "yyyy-MM-dd");
            const { data, error } = await supabase
                .from("appointments")
                .select("*")
                .ilike("client_phone", `%${phone.trim().replace(/\D/g, "")}%`)
                .neq("status", "cancelado")
                .gte("appointment_date", today)
                .order("appointment_date")
                .order("appointment_time");
            if (error) throw error;
            setAppointments(data || []);
            setSearched(true);
        } catch {
            toast.error("Erro ao buscar agendamentos. Tente novamente.");
        } finally {
            setSearching(false);
        }
    };

    const canCancel = (appt: any): { allowed: boolean; reason?: string } => {
        const apptDateTime = new Date(`${appt.appointment_date}T${appt.appointment_time}`);
        const now = new Date();
        const minutesUntil = differenceInMinutes(apptDateTime, now);

        // Grace period: if appointment is very recent (created_at within 5 min), always allow
        if (appt.created_at) {
            const createdAt = new Date(appt.created_at);
            const minutesSinceBooking = differenceInMinutes(now, createdAt);
            if (minutesSinceBooking <= GRACE_PERIOD_MINUTES) {
                return { allowed: true };
            }
        }

        if (minutesUntil < cancelMinutesLimit) {
            return {
                allowed: false,
                reason: `Cancelamento não permitido. É necessário ${formatLimitLabel(cancelMinutesLimit)} de antecedência. Faltam ${minutesUntil < 0 ? "0" : minutesUntil} minutos para o horário.`,
            };
        }
        return { allowed: true };
    };

    const handleCancel = async (appt: any) => {
        const check = canCancel(appt);
        if (!check.allowed) {
            toast.error(check.reason || "Cancelamento não permitido.", { duration: 5000 });
            return;
        }
        setLoadingId(appt.id);
        try {
            const { error } = await supabase
                .from("appointments")
                .update({ status: "cancelado" })
                .eq("id", appt.id);
            if (error) throw error;
            setAppointments(prev => prev.filter(a => a.id !== appt.id));
            toast.success("Agendamento cancelado! O horário foi liberado.");
        } catch {
            toast.error("Erro ao cancelar. Tente novamente.");
        } finally {
            setLoadingId(null);
        }
    };

    const handleReschedule = async (appt: any) => {
        const check = canCancel(appt);
        if (!check.allowed) {
            toast.error(check.reason || "Reagendamento não permitido.", { duration: 5000 });
            return;
        }
        setLoadingId(appt.id);
        try {
            const { error } = await supabase
                .from("appointments")
                .update({ status: "cancelado" })
                .eq("id", appt.id);
            if (error) throw error;
            const params = new URLSearchParams({
                nome: appt.client_name || "",
                telefone: appt.client_phone || "",
            });
            navigate(`/agendar?${params.toString()}`);
        } catch {
            toast.error("Erro ao reagendar. Tente novamente.");
            setLoadingId(null);
        }
    };

    const statusLabel: Record<string, { label: string; color: string }> = {
        pendente: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-400" },
        confirmado: { label: "Confirmado", color: "bg-blue-500/20 text-blue-400" },
        finalizado: { label: "Finalizado", color: "bg-green-500/20 text-green-400" },
        plano: { label: "Plano", color: "bg-purple-500/20 text-purple-400" },
    };

    return (
        <div className="dark min-h-screen bg-background text-foreground">
            {/* Header */}
            <header className="flex items-center gap-3 border-b border-border px-4 py-4">
                <button
                    onClick={() => navigate("/")}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Início</span>
                </button>
                <div className="flex-1" />
                <div>
                    <h1 className="text-xl font-black text-primary" style={{ fontFamily: "Playfair Display, serif" }}>
                        Meus Agendamentos
                    </h1>
                    <p className="text-xs text-muted-foreground text-right">Barbearia do Romel</p>
                </div>
            </header>

            <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
                {/* Search card */}
                <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                    <div>
                        <h2 className="text-base font-bold mb-1">Encontre seu agendamento</h2>
                        <p className="text-sm text-muted-foreground">
                            Digite o número de telefone usado no agendamento para localizar seus horários ativos.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && searchAppointments()}
                            placeholder="71999999999"
                            className="bg-background border-border text-foreground flex-1"
                        />
                        <Button
                            onClick={searchAppointments}
                            disabled={searching}
                            style={{ backgroundColor: primaryColor, color: "#000" }}
                            className="font-bold gap-2"
                        >
                            <Search className="h-4 w-4" />
                            {searching ? "Buscando..." : "Buscar"}
                        </Button>
                    </div>
                </div>

                {/* Cancellation rule notice */}
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">
                        Cancelamentos e reagendamentos só são permitidos com pelo menos{" "}
                        <strong>{formatLimitLabel(cancelMinutesLimit)} de antecedência</strong>.
                        {" "}Uma margem de {GRACE_PERIOD_MINUTES} minutos é concedida para erros imediatos após o agendamento.
                    </p>
                </div>

                {/* Results */}
                {searched && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            {appointments.length > 0
                                ? `${appointments.length} agendamento(s) encontrado(s)`
                                : "Nenhum agendamento ativo encontrado"}
                        </h3>

                        {appointments.length === 0 && (
                            <div className="rounded-xl border border-border bg-card p-8 text-center">
                                <p className="text-muted-foreground">Nenhum agendamento futuro encontrado para este número.</p>
                                <p className="text-xs text-muted-foreground mt-2">Verifique se digitou o número corretamente.</p>
                                <Link to="/agendar">
                                    <Button className="mt-4 font-bold" style={{ backgroundColor: primaryColor, color: "#000" }}>
                                        Fazer um novo agendamento
                                    </Button>
                                </Link>
                            </div>
                        )}

                        {appointments.map((appt) => {
                            const cancelCheck = canCancel(appt);
                            const status = statusLabel[appt.status] || { label: appt.status, color: "bg-zinc-500/20 text-zinc-400" };
                            const isLoading = loadingId === appt.id;

                            return (
                                <div key={appt.id} className="rounded-xl border border-border bg-card overflow-hidden">
                                    {/* Card header */}
                                    <div className="flex items-center justify-between px-5 pt-5 pb-3">
                                        <div>
                                            <p className="font-bold text-base">{appt.client_name}</p>
                                            <p className="text-xs text-muted-foreground">{appt.client_phone}</p>
                                        </div>
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.color}`}>
                                            {status.label}
                                        </span>
                                    </div>

                                    {/* Divider */}
                                    <div className="border-t border-border mx-5" />

                                    {/* Details */}
                                    <div className="px-5 py-4 space-y-2 text-sm">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Calendar className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
                                            <span className="text-foreground font-medium">
                                                {format(parseISO(appt.appointment_date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Clock className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
                                            <span className="text-foreground font-medium">
                                                {appt.appointment_time.substring(0, 5)}
                                            </span>
                                        </div>
                                        <div className="rounded-lg bg-background/60 px-3 py-2 mt-2">
                                            <p className="font-semibold">{appt.service_names?.join(" + ")}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{appt.total_duration} min</p>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    {!cancelCheck.allowed ? (
                                        <div className="px-5 pb-4">
                                            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                                                <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                                                <p className="text-xs text-red-300">{cancelCheck.reason}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2 px-5 pb-5">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-1.5"
                                                disabled={isLoading}
                                                onClick={() => handleCancel(appt)}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                                {isLoading ? "Cancelando..." : "Cancelar"}
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="flex-1 gap-1.5 font-bold"
                                                style={{ backgroundColor: primaryColor, color: "#000" }}
                                                disabled={isLoading}
                                                onClick={() => handleReschedule(appt)}
                                            >
                                                <RefreshCw className="h-3.5 w-3.5" />
                                                {isLoading ? "Aguarde..." : "Reagendar"}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer link */}
                <div className="text-center pt-4">
                    <Link to="/agendar">
                        <Button variant="outline" className="gap-2">
                            Fazer novo agendamento
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default MeusAgendamentos;
