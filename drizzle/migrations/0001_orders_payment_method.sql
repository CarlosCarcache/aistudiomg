ALTER TABLE public.orders ADD COLUMN payment_method text;
COMMENT ON COLUMN public.clients.payment_method IS 'DEPRECATED: replaced by orders.payment_method';