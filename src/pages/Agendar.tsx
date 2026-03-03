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
import { format, addDays, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";

type Step = "service" | "date" | "time" | "info" | "payment" | "confirm" | "done";

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

  // Generate time slots
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

    const slots: string[] = [];
    for (let m = openMin; m + totalDuration <= closeMin; m += 30) {
      if (lunchStart !== null && lunchEnd !== null) {
        if (m < lunchEnd && m + totalDuration > lunchStart) continue;
      }
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const time = `${hh}:${mm}`;

      // Check blocked
      const ds = format(selectedDate, "yyyy-MM-dd");
      const isBlocked = blocked?.some(
        (b) => b.blocked_date === ds && (b.all_day || b.blocked_time === time + ":00")
      );
      if (isBlocked) continue;

      // Check occupied
      const isOccupied = dayAppointments?.some(
        (a) => a.appointment_time === time + ":00" && a.status !== "cancelado"
      );
      if (isOccupied) continue;

      slots.push(time);
    }
    return slots;
  };

  const isDateDisabled = (date: Date) => {
    if (date < new Date(new Date().toDateString())) return true;
    if (date > addDays(new Date(), 30)) return true;
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
    toast.success("Obrigado pela avaliação!");
  };

  const slots = step === "time" ? generateSlots() : [];

  const stepTitles: Record<Step, string> = {
    service: "Escolha os Serviços",
    date: "Escolha a Data",
    time: "Escolha o Horário",
    info: "Seus Dados",
    payment: "Pagamento",
    confirm: "Confirmar Agendamento",
    done: "Agendamento Confirmado!",
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
    const order: Step[] = ["service", "date", "time", "info", "payment", "confirm"];
    const i = order.indexOf(step);
    if (i < order.length - 1) setStep(order[i + 1]);
    else handleSubmit();
  };

  const goBack = () => {
    const order: Step[] = ["service", "date", "time", "info", "payment", "confirm"];
    const i = order.indexOf(step);
    if (i > 0) setStep(order[i - 1]);
    else navigate("/");
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Header */}
        {step !== "done" && (
          <button onClick={goBack} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
        )}

        <h1 className="mb-6 text-2xl font-bold">{stepTitles[step]}</h1>

        {/* Step: Service */}
        {step === "service" && (
          <div className="space-y-3">
            {services?.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary">
                <Checkbox
                  checked={selectedServices.includes(s.id)}
                  onCheckedChange={(checked) =>
                    setSelectedServices((prev) =>
                      checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                    )
                  }
                />
                <div className="flex-1">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.duration} min</p>
                </div>
                <span className="font-bold text-primary">R$ {Number(s.price).toFixed(2)}</span>
              </label>
            ))}
            {selectedServices.length > 0 && (
              <div className="mt-4 rounded-lg bg-primary/10 p-3 text-center text-sm">
                Total: <span className="font-bold text-primary">R$ {totalPrice.toFixed(2)}</span> · {totalDuration} min
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
              className="pointer-events-auto rounded-lg border border-border bg-card p-3"
            />
          </div>
        )}

        {/* Step: Time */}
        {step === "time" && (
          <div className="grid grid-cols-3 gap-3">
            {slots.length === 0 && (
              <p className="col-span-3 text-center text-muted-foreground">Nenhum horário disponível</p>
            )}
            {slots.map((time) => (
              <button
                key={time}
                onClick={() => setSelectedTime(time)}
                className={cn(
                  "rounded-lg border border-border py-3 text-center font-medium transition-colors",
                  selectedTime === time
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card hover:border-primary"
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
              <label className="mb-1 block text-sm font-medium">Nome</label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Seu nome" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Telefone (WhatsApp)</label>
              <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="11999999999" />
            </div>
          </div>
        )}

        {/* Step: Payment */}
        {step === "payment" && (
          <div className="space-y-3">
            {(["pix", "dinheiro"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={cn(
                  "w-full rounded-lg border border-border p-4 text-left font-medium transition-colors",
                  paymentMethod === m ? "border-primary bg-primary/10" : "bg-card hover:border-primary"
                )}
              >
                {m === "pix" ? "PIX" : "Dinheiro"}
              </button>
            ))}
            {paymentMethod === "pix" && settings?.pix_key && (
              <div className="mt-4 rounded-lg bg-card p-4 text-center text-sm">
                <p className="mb-1 text-muted-foreground">Chave PIX:</p>
                <p className="font-mono font-bold text-primary">{settings.pix_key}</p>
              </div>
            )}
          </div>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Serviços</span><span className="font-medium">{chosen.map((s) => s.name).join(", ")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span className="font-medium">{selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Horário</span><span className="font-medium">{selectedTime}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Nome</span><span className="font-medium">{clientName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Telefone</span><span className="font-medium">{clientPhone}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pagamento</span><span className="font-medium">{paymentMethod === "pix" ? "PIX" : "Dinheiro"}</span></div>
            <hr className="border-border" />
            <div className="flex justify-between text-base font-bold"><span>Total</span><span className="text-primary">R$ {totalPrice.toFixed(2)}</span></div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-6 py-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
              <Check className="h-10 w-10 text-green-500" />
            </div>
            <p className="text-muted-foreground">Seu agendamento foi registrado com sucesso!</p>
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Avalie nosso atendimento:</p>
              <StarRating rating={rating} onRate={handleRate} size={32} />
            </div>
            {settings?.whatsapp && (
              <a
                href={`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(`Olá! Agendei um horário para ${selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""} às ${selectedTime}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="rounded-full">Enviar mensagem no WhatsApp</Button>
              </a>
            )}
            <Button onClick={() => navigate("/")} className="rounded-full">Voltar ao Início</Button>
          </div>
        )}

        {/* Next button */}
        {step !== "done" && (
          <Button
            className="mt-8 w-full rounded-full text-lg font-bold"
            disabled={!canNext() || saving}
            onClick={step === "confirm" ? handleSubmit : goNext}
          >
            {step === "confirm" ? (saving ? "Agendando..." : "Confirmar Agendamento") : "Continuar"}
          </Button>
        )}
      </div>

      <WhatsAppButton />
    </div>
  );
};

export default Agendar;
