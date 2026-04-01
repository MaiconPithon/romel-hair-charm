import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useServices } from "@/hooks/useServices";
import { useScheduleConfig } from "@/hooks/useScheduleConfig";
import { useBlockedSlots } from "@/hooks/useBlockedSlots";
import { useAppointments } from "@/hooks/useAppointments";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useDailyOverrides } from "@/hooks/useDailyOverrides";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { StarRating } from "@/components/StarRating";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorBoundary from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";
import { format, addDays, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Check, ChevronRight, Clock, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import romelBg from "@/assets/romel-bg.jpg";
import romelLogo from "@/assets/romel-logo.jpeg";

type Step = "service" | "date" | "time" | "info" | "payment" | "confirm" | "done";

const STEPS: Step[] = ["service", "date", "time", "info", "payment", "confirm"];

/** Safe date helper – never returns Invalid Date */
const safeDate = (v?: string | Date | null): Date => {
  if (!v) return new Date();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const Agendar = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: services, isLoading: loadingServices } = useServices();
  const { data: schedule, isLoading: loadingSchedule } = useScheduleConfig();
  const { data: blocked } = useBlockedSlots();
  const { data: settings } = useBusinessSettings();
  const { data: dailyOverrides, isLoading: loadingOverrides } = useDailyOverrides();

  const [step, setStep] = useState<Step>("service");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState(() => searchParams.get("nome") || "");
  const [clientPhone, setClientPhone] = useState(() => searchParams.get("telefone") || "");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "dinheiro">("pix");
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined;
  const { data: dayAppointments } = useAppointments(dateStr);

  const chosen = services?.filter((s) => selectedServices.includes(s.id)) || [];
  const totalPrice = chosen.reduce((sum, s) => sum + Number(s.price), 0);
  const totalDuration = chosen.reduce((sum, s) => sum + s.duration, 0);

  const currentStepIndex = STEPS.indexOf(step);

  const bufferMinutes = settings?.buffer_minutes ? parseInt(settings.buffer_minutes) : 45;
  const primaryColor = settings?.primary_color || "#d1b122";

  const isDataReady = !loadingServices && !loadingSchedule && !loadingOverrides;

  // Generate time slots with availability info
  type SlotInfo = { time: string; available: boolean; reason?: string };

  const generateSlots = (): SlotInfo[] => {
    try {
      if (!selectedDate || !schedule?.length) return [];
      const dow = getDay(selectedDate);
      const ds = format(selectedDate, "yyyy-MM-dd");

      // Priority 1: Check daily override for this specific date
      const override = dailyOverrides?.find((o: any) => o?.override_date === ds);
      let openTime: string | undefined;
      let closeTime: string | undefined;
      let lunchStartStr: string | null = null;
      let lunchEndStr: string | null = null;
      let isOpen = false;

      if (override) {
        isOpen = override?.is_open ?? false;
        openTime = override?.open_time;
        closeTime = override?.close_time;
        lunchStartStr = override?.lunch_start ?? null;
        lunchEndStr = override?.lunch_end ?? null;
      } else {
        const config = schedule?.find((c) => c?.day_of_week === dow);
        if (!config?.is_open) return [];
        isOpen = config.is_open;
        openTime = config.open_time;
        closeTime = config.close_time;
        lunchStartStr = config?.lunch_start ?? null;
        lunchEndStr = config?.lunch_end ?? null;
      }

      if (!isOpen || !openTime || !closeTime) return [];

      const [oh, om] = openTime.split(":").map(Number);
      const [ch, cm] = closeTime.split(":").map(Number);
      if (isNaN(oh) || isNaN(om) || isNaN(ch) || isNaN(cm)) {
        console.error("[generateSlots] Invalid time values:", { openTime, closeTime });
        return [];
      }
      const openMin = oh * 60 + om;
      const closeMin = ch * 60 + cm;

      const lunchStart = lunchStartStr ? (() => { const parts = lunchStartStr!.split(":").map(Number); return !isNaN(parts[0]) && !isNaN(parts[1]) ? parts[0] * 60 + parts[1] : null; })() : null;
      const lunchEnd = lunchEndStr ? (() => { const parts = lunchEndStr!.split(":").map(Number); return !isNaN(parts[0]) && !isNaN(parts[1]) ? parts[0] * 60 + parts[1] : null; })() : null;

      const slotStep = 5;
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");
      const nowMin = now.getHours() * 60 + now.getMinutes() + bufferMinutes;

      const occupiedIntervals = (dayAppointments || [])
        .map((a) => {
          const parts = a?.appointment_time?.split(":").map(Number) || [0, 0];
          const aStart = (parts[0] || 0) * 60 + (parts[1] || 0);
          const aDuration = a?.total_duration || 30;
          return { start: aStart, end: aStart + aDuration };
        });

      const slots: SlotInfo[] = [];
      for (let m = openMin; m + totalDuration <= closeMin; m += slotStep) {
        const hh = String(Math.floor(m / 60)).padStart(2, "0");
        const mm = String(m % 60).padStart(2, "0");
        const time = `${hh}:${mm}`;

        if (ds === todayStr && m <= nowMin) {
          slots.push({ time, available: false, reason: "past" });
          continue;
        }

        if (lunchStart !== null && lunchEnd !== null) {
          if (m < lunchEnd && m + totalDuration > lunchStart) {
            slots.push({ time, available: false, reason: "lunch" });
            continue;
          }
        }

        const isBlocked = blocked?.some(
          (b) => b?.blocked_date === ds && (b?.all_day || b?.blocked_time === time + ":00")
        );
        if (isBlocked) {
          slots.push({ time, available: false, reason: "blocked" });
          continue;
        }

        const newEnd = m + totalDuration;
        const isOccupied = occupiedIntervals.some((occ) => m < occ.end && newEnd > occ.start);
        if (isOccupied) {
          slots.push({ time, available: false, reason: "occupied" });
          continue;
        }

        slots.push({ time, available: true });
      }
      return slots;
    } catch (e) {
      console.error("[generateSlots] Unexpected error:", e);
      return [];
    }
  };

  const isDateDisabled = (date: Date): boolean => {
    try {
      const today = new Date(new Date().toDateString());
      const sevenDaysFromNow = addDays(today, 7);
      if (date < today || date > sevenDaysFromNow) return true;

      const dateStr = format(date, "yyyy-MM-dd");

      if (blocked?.some((b) => b?.blocked_date === dateStr && b?.all_day)) return true;

      const override = dailyOverrides?.find((o: any) => o?.override_date === dateStr);
      if (override) return !(override?.is_open ?? false);

      const dow = getDay(date);
      const config = schedule?.find((c) => c?.day_of_week === dow);
      if (!config?.is_open) return true;

      return false;
    } catch (e) {
      console.error("[isDateDisabled] Error for date:", date, e);
      return true; // safer to disable than crash
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const dbPaymentMethod = paymentMethod === "pix" ? "Pix" : "Dinheiro";
      const { error } = await supabase.from("appointments").insert({
        client_name: clientName,
        client_phone: clientPhone,
        service_ids: selectedServices,
        service_names: chosen.map((s) => s.name),
        appointment_date: format(selectedDate!, "yyyy-MM-dd"),
        appointment_time: selectedTime + ":00",
        payment_method: dbPaymentMethod,
        total_price: totalPrice,
        total_duration: totalDuration,
      });
      if (error) throw error;

      const whatsappNumber = settings?.whatsapp || "5571988896715";
      const dateFormatted = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "";
      const servicesList = chosen.map((s) => s.name).join(", ");
      const message = `✅ Agendamento Confirmado!\n\n📍 Barbearia Romel\n👤 Cliente: ${clientName}\n✂️ Serviço: ${servicesList}\n📅 Data: ${dateFormatted} às ${selectedTime}\n💰 Valor: R$ ${totalPrice.toFixed(2)}\n\nPor favor, envie o comprovante do Pix para garantir sua vaga!`;
      const waUrl = `https://wa.me/5571988896715?text=${encodeURIComponent(message)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");

      setStep("done");
    } catch {
      toast.error("Erro ao agendar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleRate = async (stars: number) => {
    setRating(stars);
    await supabase.from("avaliacoes").insert({ client_name: clientName, stars });
    toast.success("Avaliação recebida! Muito obrigado. ⭐");
  };

  const slots = step === "time" ? generateSlots() : [];

  const stepTitles: Record<Step, string> = {
    service: "Escolha os serviços",
    date: "Escolha a data",
    time: "Escolha o horário",
    info: "Seus dados",
    payment: "Forma de Pagamento",
    confirm: "Confirmar Agendamento",
    done: "Agendado!",
  };

  const canNext = () => {
    switch (step) {
      case "service": return selectedServices.length > 0;
      case "date": return !!selectedDate;
      case "time": return !!selectedTime;
      case "info": return clientName.trim().length > 0 && clientPhone.trim().length >= 10;
      case "payment": return true;
      case "confirm": return !!selectedDate && !!selectedTime && selectedServices.length > 0 && totalDuration > 0;
      default: return false;
    }
  };

  const goNext = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
    else handleSubmit();
  };

  const goBack = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
    else navigate("/");
  };

  // Loading skeleton
  if (!isDataReady) {
    return (
      <div className="dark min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-3 w-full max-w-md mt-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground relative">
      {/* Background image */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{ backgroundImage: `url(${romelBg})` }}
      />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Top bar */}
        <div className="px-4 pt-4">
          <button onClick={step === "done" ? () => navigate("/") : goBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground font-semibold uppercase tracking-wider">
            <ArrowLeft className="h-4 w-4" /> Romel Barbearia
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 px-4 mt-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 h-1 rounded-full overflow-hidden bg-border">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  i <= currentStepIndex || step === "done" ? "" : "bg-transparent"
                )}
                style={{ width: "100%", backgroundColor: i <= currentStepIndex || step === "done" ? primaryColor : undefined }}
              />
            </div>
          ))}
        </div>

        {/* Step title */}
        <div className="px-4 mt-4 mb-4">
          <h2 className="text-primary text-lg font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>{stepTitles[step]}</h2>
          {step === "time" && selectedDate && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} — {totalDuration} min necessários
              </p>
              {selectedTime && (
                <button
                  onClick={() => setSelectedTime("")}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-md px-2 py-1"
                >
                  <X className="h-3 w-3" /> Limpar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 px-4 pb-24">
          {/* Step: Service */}
          {step === "service" && (
            <div className="space-y-2">
              {services?.map((s) => (
                <label
                  key={s.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors",
                    selectedServices.includes(s.id) ? "border-2 bg-opacity-10" : "border-border bg-card/50 hover:border-muted-foreground"
                  )}
                  style={selectedServices.includes(s.id) ? { borderColor: primaryColor, backgroundColor: `${primaryColor}15` } : undefined}
                >
                  <Checkbox
                    checked={selectedServices.includes(s.id)}
                    onCheckedChange={(checked) =>
                      setSelectedServices((prev) =>
                        checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                      )
                    }
                  />
                  <div className="flex-1">
                    <span className="font-medium">{s.name}</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>{s.duration} min</span>
                    </div>
                  </div>
                  <span className="font-bold" style={{ color: primaryColor }}>R$ {Number(s.price).toFixed(2)}</span>
                </label>
              ))}

              {selectedServices.length > 0 && (
                <div className="rounded-lg border p-4 mt-4" style={{ borderColor: `${primaryColor}50`, backgroundColor: `${primaryColor}0D` }}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Duração total:</span>
                    <span className="font-bold">{totalDuration} min</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Valor total:</span>
                    <span className="font-bold" style={{ color: primaryColor }}>R$ {totalPrice.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Date */}
          {step === "date" && (
            <ErrorBoundary fallbackMessage="Erro ao carregar o calendário.">
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col items-center gap-2 mb-2">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#D1B122]/10 border border-[#D1B122]/20">
                    <span className="text-[10px] font-black text-[#D1B122] uppercase tracking-widest">Atenção</span>
                  </div>
                  <p className="text-xs font-bold text-white/40 uppercase tracking-tighter">Agenda liberada apenas para os próximos 7 dias</p>
                </div>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setStep("time");
                  }}
                  disabled={isDateDisabled}
                  fromDate={new Date()}
                  toDate={addDays(new Date(), 7)}
                  className="rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl p-4 shadow-2xl [&_.rdp-day:not([disabled])]:!text-white [&_.rdp-day:not([disabled])]:font-bold [&_.rdp-head_cell]:!text-white/70 [&_.rdp-caption_label]:!text-white [&_.rdp-nav_button]:!text-white"
                  locale={ptBR}
                />
              </div>
            </ErrorBoundary>
          )}

          {/* Step: Time - Vertical Timeline */}
          {step === "time" && (
            <ErrorBoundary fallbackMessage="Erro ao carregar os horários.">
              <div className="relative">
                {slots.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    {selectedDate && format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
                      ? "Não há mais horários disponíveis para hoje"
                      : "Nenhum horário disponível"}
                  </p>
                )}
                {slots.length > 0 && (
                  <div className="relative ml-4">
                    <div className="absolute left-[7px] top-0 bottom-0 w-0.5 bg-border" />
                    <div className="space-y-0.5">
                      {slots.map((slot) => {
                        const isSelected = slot.available && selectedTime === slot.time;
                        const serviceNames = chosen.map((s) => s.name).join(" + ");
                        const [sh, sm] = slot.time.split(":").map(Number);
                        const endMinTotal = sh * 60 + sm + totalDuration;
                        const endH = String(Math.floor(endMinTotal / 60)).padStart(2, "0");
                        const endM = String(endMinTotal % 60).padStart(2, "0");
                        const endTime = `${endH}:${endM}`;
                        const blockHeight = Math.max(totalDuration * 2, 52);

                        return (
                          <div key={slot.time} className="relative flex items-start gap-3">
                            <div
                              className={cn(
                                "relative z-10 mt-3 h-3.5 w-3.5 rounded-full border-2 shrink-0 transition-colors",
                                !slot.available
                                  ? "border-muted-foreground/30 bg-muted/30"
                                  : isSelected
                                    ? "border-transparent"
                                    : "border-border bg-background"
                              )}
                              style={isSelected ? { borderColor: primaryColor, backgroundColor: primaryColor } : undefined}
                            />
                            <button
                              onClick={() => slot.available && setSelectedTime(slot.time)}
                              disabled={!slot.available}
                              className={cn(
                                "flex-1 rounded-lg border transition-all text-left",
                                !slot.available
                                  ? "border-border bg-card/20 opacity-40 cursor-not-allowed"
                                  : isSelected
                                    ? "border-2"
                                    : "border-border bg-card/60 hover:border-muted-foreground"
                              )}
                              style={{
                                minHeight: isSelected ? `${blockHeight}px` : '36px',
                                ...(isSelected ? { borderColor: primaryColor, backgroundColor: primaryColor } : {}),
                              }}
                            >
                              <div className="flex flex-col justify-center h-full pl-2 py-1.5">
                                {isSelected ? (
                                  <>
                                    <span className="font-bold text-xs" style={{ color: '#000000' }}>{serviceNames}</span>
                                    <span className="font-bold text-[11px]" style={{ color: '#000000cc' }}>{slot.time} até {endTime}</span>
                                  </>
                                ) : (
                                  <span className={cn(
                                    "font-medium text-sm flex items-center gap-1.5",
                                    !slot.available ? "line-through text-muted-foreground" : ""
                                  )}>
                                    <Clock className="h-3 w-3 opacity-50" />
                                    {slot.time}
                                    {!slot.available && slot.reason === "lunch" && (
                                      <span className="ml-1 text-xs text-muted-foreground/60">— Pausa / Almoço</span>
                                    )}
                                    {!slot.available && slot.reason === "occupied" && (
                                      <span className="ml-1 text-xs text-muted-foreground/60">Ocupado</span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ErrorBoundary>
          )}

          {/* Step: Info */}
          {step === "info" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold">Nome</label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Seu nome" className="bg-card/50 border-border" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Telefone</label>
                <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="71999999999" className="bg-card/50 border-border" />
              </div>
            </div>
          )}

          {/* Step: Payment */}
          {step === "payment" && (
            <div className="space-y-2">
              <button
                onClick={() => setPaymentMethod("pix")}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg border p-4 text-left font-medium transition-colors",
                  paymentMethod === "pix" ? "border-2" : "border-border bg-card/50 hover:border-muted-foreground"
                )}
                style={paymentMethod === "pix" ? { borderColor: primaryColor, backgroundColor: `${primaryColor}15` } : undefined}
              >
                <span className="text-lg">⚡</span>
                <span>Pix</span>
              </button>
              <button
                onClick={() => setPaymentMethod("dinheiro")}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg border p-4 text-left font-medium transition-colors",
                  paymentMethod === "dinheiro" ? "border-2" : "border-border bg-card/50 hover:border-muted-foreground"
                )}
                style={paymentMethod === "dinheiro" ? { borderColor: primaryColor, backgroundColor: `${primaryColor}15` } : undefined}
              >
                <span className="text-lg">💵</span>
                <span>Dinheiro (pagar no local)</span>
              </button>

              {paymentMethod === "pix" && (
                <div className="mt-4 rounded-xl border border-border bg-zinc-900 p-6 text-center space-y-4">
                  <p className="text-2xl font-bold text-white">Total a Pagar</p>
                  <p className="text-3xl font-black" style={{ color: primaryColor }}>R$ {totalPrice.toFixed(2)}</p>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider">Escaneie o QR Code ou copie a chave</p>
                  <div className="flex justify-center">
                    <div className="bg-white p-3 rounded-lg">
                      <QRCodeSVG
                        value={(() => {
                          const valorStr = totalPrice.toFixed(2);
                          const valorTag = `54${String(valorStr.length).padStart(2, "0")}${valorStr}`;
                          return `00020126440014BR.GOV.BCB.PIX0122romel.cruz@hotmail.com5204000053039865${valorTag}5802BR5925Romel da Cruz Mascarenhas6008SALVADOR62140510iY2ZGjlaHK6304`;
                        })()}
                        size={200}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-800 p-3 flex items-center justify-between gap-2">
                    <span className="text-sm text-zinc-300 truncate">romel.cruz@hotmail.com</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText("romel.cruz@hotmail.com");
                        toast.success("Chave Pix copiada!");
                      }}
                      className="shrink-0 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 text-sm font-bold transition-colors flex items-center gap-1"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar Chave Pix
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Confirm */}
          {step === "confirm" && (
            <div className="rounded-lg border border-border bg-card/60 p-5 text-sm space-y-2">
              <p><span className="text-muted-foreground">Nome:</span> <span className="font-bold">{clientName}</span></p>
              <p><span className="text-muted-foreground">Telefone:</span> <span className="font-bold">{clientPhone}</span></p>
              <p><span className="text-muted-foreground">Data:</span> <span className="font-bold">{selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""}</span></p>
              <p><span className="text-muted-foreground">Horário:</span> <span className="font-bold">{selectedTime}</span></p>
              <p><span className="text-muted-foreground">Serviço:</span> <span className="font-bold">{chosen.map((s) => s.name).join(", ")}</span></p>
              <p><span className="text-muted-foreground">Duração:</span> <span className="font-bold">{totalDuration} min</span></p>
              <p><span className="text-muted-foreground">Pagamento:</span> <span className="font-bold">{paymentMethod === "pix" ? "Pix" : "Dinheiro"}</span></p>
              <p className="font-bold" style={{ color: primaryColor }}>Total: R$ {totalPrice.toFixed(2)}</p>
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <img src={romelLogo} alt="Romel Barbearia" className="h-20 w-20 object-contain" />
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 -mt-4" style={{ borderColor: primaryColor, backgroundColor: `${primaryColor}33` }}>
                <Check className="h-6 w-6" style={{ color: primaryColor }} />
              </div>
              <h2 className="text-xl font-bold" style={{ color: primaryColor }}>Agendado!</h2>
              <div className="w-full rounded-lg border border-border bg-card/60 p-5 text-sm text-left space-y-1">
                <p><span className="text-muted-foreground">Nome:</span> <span className="font-bold">{clientName}</span></p>
                <p><span className="text-muted-foreground">Serviço:</span> <span className="font-bold">{chosen.map((s) => s.name).join(", ")}</span></p>
                <p><span className="text-muted-foreground">Data:</span> <span className="font-bold">{selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""}</span></p>
                <p><span className="text-muted-foreground">Horário:</span> <span className="font-bold">{selectedTime}</span></p>
                <p><span className="text-muted-foreground">Pagamento:</span> <span className="font-bold">{paymentMethod === "pix" ? "Pix" : "Dinheiro"}</span></p>
                <p className="font-bold" style={{ color: primaryColor }}>Total: R$ {totalPrice.toFixed(2)}</p>
              </div>
              <div className="w-full rounded-lg border border-border bg-card/60 p-5 flex flex-col items-center">
                <p className="font-bold text-lg mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>Avalie sua Experiência</p>
                <StarRating rating={rating} onRate={handleRate} size={36} />
                {rating > 0 && (
                  <p className="mt-3 font-medium text-center" style={{ color: primaryColor }}>Avaliação recebida! Muito obrigado. ⭐</p>
                )}
              </div>
              <button
                onClick={() => navigate("/")}
                className="w-full rounded-lg border border-border bg-card/60 py-3 font-medium hover:bg-card transition-colors"
              >
                Voltar ao início
              </button>
              <Link
                to="/meus-agendamentos"
                className="w-full block text-center rounded-lg border py-3 text-sm font-medium hover:bg-card/60 transition-colors text-muted-foreground hover:text-foreground"
                style={{ borderColor: `${primaryColor}40` }}
              >
                Gerenciar meu agendamento
              </Link>
            </div>
          )}
        </div>

        {/* Fixed bottom button */}
        {step !== "done" && (
          <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background to-transparent">
            <Button
              className="w-full rounded-lg text-base font-bold text-black py-6"
              style={{ backgroundColor: primaryColor }}
              disabled={!canNext() || saving}
              onClick={step === "confirm" ? handleSubmit : goNext}
            >
              {step === "confirm" ? (saving ? "Agendando..." : "Confirmar Agendamento") : "Continuar"}
              {step !== "confirm" && <ChevronRight className="ml-1 h-5 w-5" />}
            </Button>
          </div>
        )}
      </div>

      <WhatsAppButton />
    </div>
  );
};

export default Agendar;
