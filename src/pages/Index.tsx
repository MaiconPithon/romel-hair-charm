import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useServices } from "@/hooks/useServices";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import { StarRating } from "@/components/StarRating";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Scissors, MapPin, Clock, Phone } from "lucide-react";
import barberBg from "@/assets/barber-bg.jpg";

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
    <div className="dark min-h-screen bg-background text-foreground relative">
      {/* Full-screen background */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${barberBg})` }}
      />
      <div className="fixed inset-0 z-0 bg-black/50" />

      {/* Hero */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <div className="flex flex-col items-center gap-6">
          <Scissors className="h-20 w-20 text-primary" />
          <h1 className="text-5xl font-black tracking-tight text-foreground md:text-7xl">
            {businessName.split(" ").map((word, i, arr) =>
              i === arr.length - 1 ? (
                <span key={i} className="text-green-500"> {word}</span>
              ) : (
                <span key={i}>{i > 0 ? " " : ""}{word}</span>
              )
            )}
          </h1>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Estilo & Atitude</p>
          {avaliacoes && avaliacoes.length > 0 && (
            <div className="flex items-center gap-2">
              <StarRating rating={Math.round(avgRating)} />
              <span className="text-sm text-muted-foreground">
                ({avaliacoes.length})
              </span>
            </div>
          )}
          <Link to="/agendar">
            <Button size="lg" className="mt-2 rounded-full px-10 text-lg font-bold bg-green-600 hover:bg-green-700 text-white gap-2">
              <Scissors className="h-5 w-5" /> AGENDAR HORÁRIO
            </Button>
          </Link>
        </div>

        {/* Info bar */}
        <div className="absolute bottom-16 left-0 right-0 flex flex-wrap items-center justify-center gap-8 px-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-green-500" />
            <span>Ter–Sáb · 08h às 21h</span>
          </div>
          {settings?.whatsapp && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-green-500" />
              <span>(71) 98889-6715</span>
            </div>
          )}
          {address && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-500" />
              <span>{address}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-4 text-xs text-muted-foreground/50">
          Desenvolvido por Michael Pithon
        </div>
      </section>

      <WhatsAppButton />
    </div>
  );
};

export default Index;
