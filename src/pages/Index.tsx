import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useServices } from "@/hooks/useServices";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import { StarRating } from "@/components/StarRating";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Scissors, MapPin, Clock, Phone } from "lucide-react";

const Index = () => {
  const { data: services } = useServices();
  const { data: settings } = useBusinessSettings();
  const { data: avaliacoes } = useAvaliacoes();

  const businessName = settings?.business_name || "Barbearia do Romel";
  const address = settings?.address || "";
  const avgRating = avaliacoes?.length
    ? avaliacoes.reduce((sum, a) => sum + a.stars, 0) / avaliacoes.length
    : 0;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-4 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-background/90 to-background" />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <Scissors className="h-16 w-16 text-primary" />
          <h1 className="text-5xl font-black tracking-tight text-foreground md:text-7xl">
            {businessName}
          </h1>
          {avaliacoes && avaliacoes.length > 0 && (
            <div className="flex items-center gap-2">
              <StarRating rating={Math.round(avgRating)} />
              <span className="text-sm text-muted-foreground">
                ({avaliacoes.length} avaliações)
              </span>
            </div>
          )}
          <Link to="/agendar">
            <Button size="lg" className="mt-4 rounded-full px-10 text-lg font-bold">
              Agendar Horário
            </Button>
          </Link>
        </div>
      </section>

      {/* Info */}
      <section className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-8 px-4 py-8 text-sm text-muted-foreground">
        {address && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span>{address}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span>Seg-Sex 08h–18h · Sáb 08h–12h</span>
        </div>
        {settings?.whatsapp && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            <span>{settings.whatsapp}</span>
          </div>
        )}
      </section>

      {/* Services */}
      <section className="mx-auto max-w-2xl px-4 pb-20">
        <h2 className="mb-8 text-center text-3xl font-bold text-foreground">
          Nossos Serviços
        </h2>
        <div className="space-y-3">
          {services?.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4"
            >
              <div>
                <p className="font-semibold text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.duration} min</p>
              </div>
              <span className="text-lg font-bold text-primary">
                R$ {Number(s.price).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <WhatsAppButton />
    </div>
  );
};

export default Index;
