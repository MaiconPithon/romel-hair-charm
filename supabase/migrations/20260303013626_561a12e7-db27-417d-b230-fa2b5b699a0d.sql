
-- Add interval column to services for buffer time between appointments
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS interval_minutes integer NOT NULL DEFAULT 0;

-- Create storage bucket for business assets (logo, background)
INSERT INTO storage.buckets (id, name, public) VALUES ('business-assets', 'business-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view business assets
CREATE POLICY "Public read access for business assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'business-assets');

-- Allow admins to manage business assets
CREATE POLICY "Admins can manage business assets"
ON storage.objects FOR ALL
USING (bucket_id = 'business-assets' AND public.has_role(auth.uid(), 'admin'));
