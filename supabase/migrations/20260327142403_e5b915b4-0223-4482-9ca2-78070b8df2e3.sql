CREATE TABLE public.daily_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  override_date DATE NOT NULL UNIQUE,
  is_open BOOLEAN NOT NULL DEFAULT true,
  open_time TIME NOT NULL DEFAULT '08:00',
  close_time TIME NOT NULL DEFAULT '18:00',
  lunch_start TIME,
  lunch_end TIME,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage daily overrides" ON public.daily_overrides
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view daily overrides" ON public.daily_overrides
  FOR SELECT TO public USING (true);