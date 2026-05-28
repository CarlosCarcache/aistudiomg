
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'ccarcache2002@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles
WHERE role = 'viewer'
  AND user_id IN (SELECT id FROM auth.users WHERE email = 'ccarcache2002@gmail.com');
