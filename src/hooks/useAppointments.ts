import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAppointments(date?: string) {
  return useQuery({
    queryKey: ["appointments", date],
    queryFn: async () => {
      let q = supabase.from("appointments").select("*").order("appointment_date").order("appointment_time");
      if (date) q = q.eq("appointment_date", date);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}
