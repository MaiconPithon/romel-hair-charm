import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDailyOverrides() {
  return useQuery({
    queryKey: ["daily_overrides"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("daily_overrides")
          .select("*")
          .order("override_date");
        if (error) {
          console.error("[useDailyOverrides] Supabase error:", error);
          return [];
        }
        return data ?? [];
      } catch (e) {
        console.error("[useDailyOverrides] Unexpected error:", e);
        return [];
      }
    },
    staleTime: 0,
    gcTime: 0,
  });
}
