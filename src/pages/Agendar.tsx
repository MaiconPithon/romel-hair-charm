import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useServices } from "@/hooks/useServices";
import { useScheduleConfig } from "@/hooks/useScheduleConfig";
import { useBlockedSlots } from "@/hooks/useBlockedSlots";
import { useAppointments } from "@/hooks/useAppointments";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { StarRating } from "@/components/StarRating";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { cn } from "@/lib/utils";
import { format, addDays, getDay, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Check, ChevronRight, MessageCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import romelBg from "@/assets/romel-bg.jpg";
import romelLogo from "@/assets/romel-logo.jpeg";

type Step = "service" | "date" | "time" | "info" | "payment" | "confirm" | "done";

const STEPS: Step[] = ["service", "date", "time", "info", "payment", "confirm"];

const Agendar = () => {
  const navigate = useNavigate();
  const { data: services } = useServices();
  const { data: schedule } = useScheduleConfig();
  const { data: blocked } = useBlockedSlots();
  const { data: settings } = useBusinessSettings();

  const [step, setStep] = useState<Step>("service");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "dinheiro">("pix");
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined;
  const { data: dayAppointments } = useAppointments(dateStr);

  const chosen = services?.filter((s) => selectedServices.includes(s.id)) || [];
  const totalPrice = chosen.reduce((sum, s) => sum + Number(s.price), 0);
  const totalDuration = chosen.reduce((sum, s) => sum + s.duration, 0);

  const currentStepIndex = STEPS.indexOf(step);

  // Get buffer from settings or default 45 min
  const bufferMinutes = settings?.buffer_minutes ? parseInt(settings.buffer_minutes) : 45;

  // Generate time slots considering total duration + buffer
  const generateSlots = (): string[] => {
    if (!selectedDate || !schedule) return [];
    const dow = getDay(selectedDate);
    const config = schedule.find((c) => c.day_of_week === dow);
    if (!config || !config.is_open) return [];

    const [oh, om] = config.open_time.split(":").map(Number);
    const [ch, cm] = config.close_time.split(":").map(Number);
    const openMin = oh * 60 + om;
    const closeMin = ch * 60 + cm;

    const lunchStart = config.lunch_start ? (() => { const [h, m] = config.lunch_start!.split(":").map(Number); return h * 60 + m; })() : null;
    const lunchEnd = config.lunch_end ? (() => { const [h, m] = config.lunch_end!.split(":").map(Number); return h * 60 + m; })() : null;

    const slotStep = 45; // slot grid step (45-min intervals)
    const neededMin = totalDuration + bufferMinutes; // total block needed

    const slots: string[] = [];
    for (let m = openMin; m + totalDuration <= closeMin; m += slotStep) {
      // Check lunch overlap
      if (lunchStart !== null && lunchEnd !== null) {
        if (m < lunchEnd && m + totalDuration > lunchStart) continue;
      }
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const time = `${hh}:${mm}`;

      const ds = format(selectedDate, "yyyy-MM-dd");
      const isBlocked = blocked?.some(
        (b) => b.blocked_date === ds && (b.all_day || b.blocked_time === time + ":00")
      );
      if (isBlocked) continue;

      // Check overlap with existing appointments considering their duration
      const isOccupied = dayAppointments?.some((a) => {
        if (a.status === "cancelado") return false;
        const [ah, am] = a.appointment_time.split(":").map(Number);
        const aStart = ah * 60 + am;
        const aDuration = (a.total_duration || 30) + bufferMinutes;
        const aEnd = aStart + aDuration;
        const newEnd = m + totalDuration;
        // Check if new slot overlaps with existing appointment
        return m < aEnd && newEnd > aStart;
      });
      if (isOccupied) continue;

      slots.push(time);
    }
    return slots;
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date(new Date().toDateString());
    if (date < today) return true;
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
    if (date < weekStart || date > weekEnd) return true;
    const dow = getDay(date);
    const config = schedule?.find((c) => c.day_of_week === dow);
    if (!config || !config.is_open) return true;
    const ds = format(date, "yyyy-MM-dd");
    return !!blocked?.some((b) => b.blocked_date === ds && b.all_day);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("appointments").insert({
        client_name: clientName,
        client_phone: clientPhone,
        service_ids: selectedServices,
        service_names: chosen.map((s) => s.name),
        appointment_date: format(selectedDate!, "yyyy-MM-dd"),
        appointment_time: selectedTime + ":00",
        payment_method: paymentMethod,
        total_price: totalPrice,
        total_duration: totalDuration,
      });
      if (error) throw error;

      // Redirect to WhatsApp with confirmation message
      const whatsappNumber = settings?.whatsapp || "5571988896715";
      const dateFormatted = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "";
      const servicesList = chosen.map((s) => s.name).join(", ");
      const message = `✅ Agendamento Confirmado!\n📍 Barbearia Romel\n👤 Cliente: ${clientName}\n✂️ Serviço: ${servicesList}\n📅 Data: ${dateFormatted} às ${selectedTime}\n💰 Valor: R$ ${totalPrice.toFixed(2)}\nPor favor, envie o comprovante do Pix para garantir sua vaga!`;
      
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank");

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
      case "confirm": return true;
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
                  i <= currentStepIndex || step === "done" ? "bg-green-500" : "bg-transparent"
                )}
                style={{ width: "100%" }}
              />
            </div>
          ))}
        </div>

        {/* Step title */}
        <div className="px-4 mt-4 mb-4">
          <h2 className="text-primary text-lg font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>{stepTitles[step]}</h2>
          {step === "time" && selectedDate && (
            <p className="text-sm text-muted-foreground">
              {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} — {totalDuration} min necessários
            </p>
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
                    selectedServices.includes(s.id) ? "border-green-500 bg-green-500/10" : "border-border bg-card/50 hover:border-muted-foreground"
                  )}
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
                  <span className="font-bold text-green-500">R$ {Number(s.price).toFixed(2)}</span>
                </label>
              ))}

              {/* Dynamic total summary */}
              {selectedServices.length > 0 && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Duração total:</span>
                    <span className="font-bold">{totalDuration} min</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Valor total:</span>
                    <span className="font-bold text-green-500">R$ {totalPrice.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Date */}
          {step === "date" && (
            <div className="flex justify-center">
               <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={isDateDisabled}
                locale={ptBR}
                className="pointer-events-auto rounded-lg border border-border bg-card p-3 text-foreground [&_button]:text-foreground [&_.rdp-day_disabled]:text-muted-foreground/40 [&_.rdp-head_cell]:text-muted-foreground [&_.rdp-caption]:text-foreground"
              />
            </div>
          )}

          {/* Step: Time */}
          {step === "time" && (
            <div className="grid grid-cols-3 gap-2">
              {slots.length === 0 && (
                <p className="col-span-3 text-center text-muted-foreground py-8">Nenhum horário disponível</p>
              )}
              {slots.map((time) => (
                <button
                  key={time}
                  onClick={() => setSelectedTime(time)}
                  className={cn(
                    "rounded-lg border py-3 text-center font-medium transition-colors",
                    selectedTime === time
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-border bg-card/60 hover:border-green-500/50"
                  )}
                >
                  {time}
                </button>
              ))}
            </div>
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
                  paymentMethod === "pix" ? "border-green-500 bg-green-500/10" : "border-border bg-card/50 hover:border-muted-foreground"
                )}
              >
                <span className="text-lg">⚡</span>
                <span>Pix</span>
              </button>
              <button
                onClick={() => setPaymentMethod("dinheiro")}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg border p-4 text-left font-medium transition-colors",
                  paymentMethod === "dinheiro" ? "border-green-500 bg-green-500/10" : "border-border bg-card/50 hover:border-muted-foreground"
                )}
              >
                <span className="text-lg">💵</span>
                <span>Dinheiro (pagar no local)</span>
              </button>

              {paymentMethod === "pix" && settings?.pix_key && (
                <div className="mt-4 rounded-xl border border-border bg-card/80 p-6 text-center space-y-3">
                  <p className="text-lg font-bold">Pagar com PIX</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Confirmação imediata</p>
                  <div className="mt-4 rounded-lg bg-muted/30 p-3 text-center text-sm">
                    <p className="mb-1 text-muted-foreground text-xs uppercase">Chave PIX Copia e Cola</p>
                    <p className="font-mono text-sm text-foreground break-all">{settings.pix_key}</p>
                  </div>
                  <p className="font-bold text-green-500">Valor: R$ {totalPrice.toFixed(2)}</p>
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
              <p className="text-green-500 font-bold">Total: R$ {totalPrice.toFixed(2)}</p>
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <img src={romelLogo} alt="Romel Barbearia" className="h-20 w-20 rounded-full object-cover border-2 border-green-500" />
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 border-2 border-green-500 -mt-4">
                <Check className="h-6 w-6 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-green-500">Agendado!</h2>

              {/* Summary card */}
              <div className="w-full rounded-lg border border-border bg-card/60 p-5 text-sm text-left space-y-1">
                <p><span className="text-muted-foreground">Nome:</span> <span className="font-bold">{clientName}</span></p>
                <p><span className="text-muted-foreground">Serviço:</span> <span className="font-bold">{chosen.map((s) => s.name).join(", ")}</span></p>
                <p><span className="text-muted-foreground">Data:</span> <span className="font-bold">{selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""}</span></p>
                <p><span className="text-muted-foreground">Horário:</span> <span className="font-bold">{selectedTime}</span></p>
                <p><span className="text-muted-foreground">Pagamento:</span> <span className="font-bold">{paymentMethod === "pix" ? "Pix" : "Dinheiro"}</span></p>
                <p className="text-green-500 font-bold">Total: R$ {totalPrice.toFixed(2)}</p>
              </div>

              {/* Rating */}
              <div className="w-full rounded-lg border border-border bg-card/60 p-5 flex flex-col items-center">
                <p className="font-bold text-lg mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>Avalie sua Experiência</p>
                <StarRating rating={rating} onRate={handleRate} size={36} />
                {rating > 0 && (
                  <p className="mt-3 text-green-500 font-medium text-center">Avaliação recebida! Muito obrigado. ⭐</p>
                )}
              </div>

              <button
                onClick={() => navigate("/")}
                className="w-full rounded-lg border border-border bg-card/60 py-3 font-medium hover:bg-card transition-colors"
              >
                Voltar ao início
              </button>
            </div>
          )}
        </div>

        {/* Fixed bottom button */}
        {step !== "done" && (
          <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background to-transparent">
            <Button
              className="w-full rounded-lg text-base font-bold bg-green-500 hover:bg-green-600 text-white py-6"
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
