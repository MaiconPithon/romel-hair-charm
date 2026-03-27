DROP POLICY IF EXISTS "Admins can manage daily overrides" ON public.daily_overrides;

CREATE POLICY "Admins can manage daily overrides"
ON public.daily_overrides
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));