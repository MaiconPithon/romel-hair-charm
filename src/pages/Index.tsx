import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useServices } from "@/hooks/useServices";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Scissors, Star, MapPin, Clock, Phone, ChevronUp } from "lucide-react";
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

  const primaryColor = settings?.primary_color || "#d1b122";
  const infoColor = settings?.info_color || "#d1b122";

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
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <div className="flex flex-col items-center justify-center w-full max-w-sm animate-in fade-in zoom-in duration-1000">
          {/* Logo - Compact */}
          <img
            src={logoUrl || romelLogo}
            alt="Romel Barbearia"
            className="h-24 w-auto md:h-32 object-contain mb-4"
          />

          {/* Star rating - Extra Minimal */}
          {avaliacoes && avaliacoes.length > 0 && (
            <div className="flex items-center gap-1.5 mb-4 scale-90">
              <div className="flex items-center gap-1 bg-black/10 backdrop-blur-sm border border-white/5 px-2.5 py-1 rounded-full">
                <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                <span className="text-[11px] font-black text-white">{avgRating.toFixed(1)}</span>
                <span className="text-[9px] text-white/30 font-bold uppercase tracking-tighter ml-0.5">({avaliacoes.length})</span>
              </div>
            </div>
          )}

          {/* Main CTA - Compact */}
          <Link to="/agendar" className="w-full max-w-[240px] mb-6 group">
            <Button
              size="lg"
              className="w-full rounded-2xl h-12 text-base font-black gap-2 transition-all active:scale-95 shadow-lg"
              style={{ backgroundColor: primaryColor, color: "#000" }}
            >
              <Scissors className="h-4 w-4 transition-transform group-hover:rotate-12" /> AGENDAR HORÁRIO
            </Button>
          </Link>

          {/* Info bar - Very Compact single line with shadow for legibility */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-4 text-[10px] md:text-[11px] font-bold text-white uppercase tracking-tighter drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" style={{ color: primaryColor }} />
              <span>Ter–Sáb · 08h às 21h</span>
            </div>
            {settings?.whatsapp && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                <span>(71) 98889-6715</span>
              </div>
            )}
            {address && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                <span className="max-w-[140px] truncate md:max-w-none">{address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Area */}
        <div className="absolute bottom-0 left-0 w-full flex flex-col items-center">
          {/* Signature */}
          <div className="flex flex-col items-center gap-1 mb-8 opacity-30 select-none">
            <Link to="/admin/login" className="text-[9px] hover:text-white transition-colors font-bold uppercase tracking-[0.3em]">
              Área do Barbeiro
            </Link>
            <span className="text-[9px] font-medium tracking-[0.1em]">
              Desenvolvido por Michael Pithon
            </span>
          </div>

          {/* Bottom Tab - Meus Agendamentos */}
          <Link to="/meus-agendamentos" className="w-auto transform transition-transform hover:-translate-y-1 active:scale-95">
            <div className="bg-black px-8 py-3 rounded-t-2xl border-x border-t border-white/10 flex items-center gap-2 shadow-2xl">
              <ChevronUp className="h-4 w-4 text-white/50" />
              <span className="text-xs font-black text-white uppercase tracking-widest">Meus Agendamentos</span>
            </div>
          </Link>
        </div>
      </section>

      <WhatsAppButton />
    </div>
  );
};

export default Index;
