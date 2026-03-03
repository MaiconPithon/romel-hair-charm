import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useServices } from "@/hooks/useServices";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Scissors, Star, MapPin, Clock, Phone } from "lucide-react";
import romelBg from "@/assets/romel-bg.jpg";
import romelLogo from "@/assets/romel-logo.jpeg";
import { useEffect } from "react";

const Index = () => {
  const { data: services } = useServices();
  const { data: settings } = useBusinessSettings();
  const { data: avaliacoes } = useAvaliacoes();

  const businessName = settings?.business_name || "Barbearia do Romel";
  const address = settings?.address || "";
  const bgImage = settings?.background_url || romelBg;
  const logoUrl = settings?.logo_url;
  const avgRating = avaliacoes?.length
    ? avaliacoes.reduce((sum, a) => sum + a.stars, 0) / avaliacoes.length
    : 0;

  // Apply dynamic colors from settings globally
  useEffect(() => {
    if (settings?.primary_color) {
      document.documentElement.style.setProperty("--dynamic-primary", settings.primary_color);
    }
    if (settings?.bg_color) {
      document.documentElement.style.setProperty("--dynamic-bg", settings.bg_color);
    }
    return () => {
      document.documentElement.style.removeProperty("--dynamic-primary");
      document.documentElement.style.removeProperty("--dynamic-bg");
    };
  }, [settings]);

  return (
    <div className="dark min-h-screen bg-background text-foreground relative" style={settings?.bg_color ? { backgroundColor: settings.bg_color } : undefined}>
      {/* Full-screen background - mobile optimized */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="fixed inset-0 z-0 bg-black/40" />

      {/* Hero */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-end px-4 text-center pb-32">
        {/* Logo */}
        <img src={logoUrl || romelLogo} alt="Romel Barbearia" className="h-24 w-24 object-contain mb-4" />

        {/* Star rating */}
        {avaliacoes && avaliacoes.length > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm mb-4">
            <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
            <span className="text-sm font-bold text-white">{Math.round(avgRating)}</span>
            <span className="text-xs text-muted-foreground">({avaliacoes.length})</span>
          </div>
        )}

        <Link to="/agendar">
          <Button size="lg" className="rounded-full px-10 text-lg font-bold bg-green-600 hover:bg-green-700 text-white gap-2">
            <Scissors className="h-5 w-5" /> AGENDAR HORÁRIO
          </Button>
        </Link>

        {/* Info bar */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 md:gap-6 px-4 text-sm text-white/70">
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
        <div className="absolute bottom-4 flex flex-col items-center gap-1 text-xs text-muted-foreground/50">
          <Link to="/admin/login" className="hover:text-muted-foreground transition-colors font-medium">
            Área do Barbeiro
          </Link>
          <span className="mt-1">Desenvolvido por Michael Pithon</span>
        </div>
      </section>

      <WhatsAppButton />
    </div>
  );
};

export default Index;
