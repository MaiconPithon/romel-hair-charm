import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

    const queryClient = useQueryClient();

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

            // Invalidate queries to ensure instant slot release in the booking flow
            queryClient.invalidateQueries({ queryKey: ["appointments"] });

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

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ["appointments"] });

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
        pendente: { label: "PENDENTE", color: "text-[#D1B122] font-black uppercase" },
        confirmado: { label: "CONFIRMADO", color: "text-blue-400 font-black uppercase" },
        finalizado: { label: "FINALIZADO", color: "text-green-400 font-black uppercase" },
        plano: { label: "PLANO", color: "text-purple-400 font-black uppercase" },
    };

    return (
        <div className="dark min-h-screen bg-black text-foreground">
            {/* Header */}
            <header className="flex items-center gap-3 border-b border-white/5 px-4 py-6 bg-black/50 backdrop-blur-md sticky top-0 z-50">
                <button
                    onClick={() => navigate("/")}
                    className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors uppercase font-bold tracking-widest"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Voltar</span>
                </button>
            </header>

            <div className="mx-auto max-w-xl px-4 py-8 space-y-8">
                {/* Search card */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-black text-white tracking-tight">Consultar agendamentos por telefone</h2>
                        <button onClick={() => navigate("/")} className="text-white/40 hover:text-white/60 transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && searchAppointments()}
                                placeholder="(71) 99999-9999"
                                className="h-12 bg-[#0A0A0A] border-[1.5px] border-[#D1B122] text-white rounded-lg px-4 focus-visible:ring-0 focus-visible:border-[#D1B122] placeholder:text-white/20 font-medium"
                            />
                        </div>
                        <Button
                            onClick={searchAppointments}
                            disabled={searching}
                            className="h-12 px-8 bg-[#D1B122] hover:bg-[#B19112] text-black font-black uppercase tracking-wider rounded-lg transition-all"
                        >
                            {searching ? "..." : "Buscar"}
                        </Button>
                    </div>

                    <p className="text-center text-[11px] text-white/30 font-medium tracking-wide">
                        Problemas? Fale pelo WhatsApp com a barbearia.
                    </p>
                </div>

                {/* Cancellation rule notice */}
                {/* (Kept minimal as per image focus, but could be hidden or restyled) */}
                <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 text-center">
                    <p className="text-[10px] text-white/30 uppercase font-black tracking-[0.15em]">
                        Cancelamento permitido com {formatLimitLabel(cancelMinutesLimit)} de antecedência
                    </p>
                </div>

                {/* Results */}
                {searched && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {appointments.length === 0 && (
                            <div className="rounded-2xl border border-white/5 bg-[#0A0A0A] p-12 text-center space-y-4 shadow-2xl">
                                <p className="text-white/50 text-sm font-medium">Nenhum agendamento ativo encontrado.</p>
                                <Link to="/agendar" className="inline-block">
                                    <Button className="bg-[#D1B122] text-black font-black uppercase text-xs tracking-widest px-8">
                                        Novo Agendamento
                                    </Button>
                                </Link>
                            </div>
                        )}

                        {appointments.map((appt) => {
                            const cancelCheck = canCancel(appt);
                            const status = statusLabel[appt.status] || { label: appt.status.toUpperCase(), color: "text-white/40" };
                            const isLoading = loadingId === appt.id;

                            return (
                                <div key={appt.id} className="rounded-2xl border border-white/5 bg-[#0A0A0A] p-6 shadow-2xl transition-all hover:border-white/10 group">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="space-y-1">
                                            <h4 className="text-lg font-black text-white tracking-tight uppercase">{appt.client_name}</h4>
                                            <div className="flex flex-col gap-0.5 text-white/50 font-medium text-[13px]">
                                                <span>{format(parseISO(appt.appointment_date), "dd/MM/yyyy")} · {appt.appointment_time.substring(0, 5)}</span>
                                                <span className="text-white/30">{appt.service_names?.join(" + ")}</span>
                                            </div>
                                            <div className="pt-2">
                                                <span className="text-[#D1B122] font-black text-base tracking-tighter">
                                                    R$ {Number(appt.total_price).toFixed(2).replace('.', ',')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-6">
                                            <span className={`text-[11px] tracking-[0.1em] ${status.color}`}>
                                                {status.label}
                                            </span>

                                            {cancelCheck.allowed && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={isLoading}
                                                    onClick={() => handleCancel(appt)}
                                                    className="h-9 px-6 border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white text-[11px] font-black uppercase tracking-widest rounded-lg transition-all"
                                                >
                                                    {isLoading ? "..." : "Cancelar"}
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {!cancelCheck.allowed && (
                                        <div className="mt-4 pt-4 border-t border-white/5">
                                            <p className="text-[10px] text-red-500/60 uppercase font-black tracking-widest leading-relaxed">
                                                {cancelCheck.reason}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer link */}
                <div className="text-center pt-8">
                    <Link to="/agendar" className="text-[11px] text-white/20 hover:text-[#D1B122] transition-colors uppercase font-black tracking-[0.2em]">
                        Fazer novo agendamento
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default MeusAgendamentos;
