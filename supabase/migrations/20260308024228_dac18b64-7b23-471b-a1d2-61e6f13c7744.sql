ALTER TABLE public.appointments
DROP CONSTRAINT IF EXISTS appointments_payment_method_check;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_payment_method_check
CHECK (
  payment_method IS NULL
  OR payment_method = ANY (
    ARRAY[
      'Pix'::text,
      'Dinheiro'::text,
      'Cartão'::text,
      'Fotos'::text,
      'plano'::text
    ]
  )
);