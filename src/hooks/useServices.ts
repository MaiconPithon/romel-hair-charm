import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useServices(onlyActive = true) {
  return useQuery({
    queryKey: ["services", onlyActive],
    queryFn: async () => {
      let q = supabase.from("services").select("*").order("sort_order");
      if (onlyActive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}
