import { MessageCircle } from "lucide-react";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";

export function WhatsAppButton() {
  const { data: settings } = useBusinessSettings();
  const phone = settings?.whatsapp || "";

  if (!phone) return null;

  return (
    <a
      href={`https://wa.me/${phone}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform hover:scale-110"
      aria-label="WhatsApp"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
