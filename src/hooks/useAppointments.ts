import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAppointments(date?: string) {
  return useQuery({
    queryKey: ["appointments", date],
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("*")
        .in("status", ["pendente", "confirmado"])
        .order("appointment_date")
        .order("appointment_time");
      if (date) q = q.eq("appointment_date", date);
      const { data, error } = await q;
      if (error) {
        console.error("[useAppointments] Error:", error);
        return [];
      }
      return data ?? [];
    },
    staleTime: 0,
    gcTime: 30_000,
  });
}
