import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useBlockedSlots() {
  return useQuery({
    queryKey: ["blocked_slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_slots")
        .select("*")
        .gte("blocked_date", new Date().toISOString().split("T")[0]);
      if (error) throw error;
      return data;
    },
  });
}
