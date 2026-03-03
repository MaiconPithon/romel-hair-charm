import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useScheduleConfig() {
  return useQuery({
    queryKey: ["schedule_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_config")
        .select("*")
        .order("day_of_week");
      if (error) throw error;
      return data;
    },
  });
}
