import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDailyOverrides() {
  return useQuery({
    queryKey: ["daily_overrides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_overrides" as any)
        .select("*")
        .order("override_date");
      if (error) throw error;
      return data as any[];
    },
  });
}
