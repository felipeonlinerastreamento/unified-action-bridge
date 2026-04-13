-- Update existing user role from atendente to admin
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = '4d574c6c-3cb9-4899-a8d9-cd1e86423c49' AND role = 'atendente';