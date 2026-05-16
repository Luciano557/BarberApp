-- 1) Limpiar flags de cambio forzado de contraseña en metadata
UPDATE auth.users
SET raw_user_meta_data =
  (COALESCE(raw_user_meta_data, '{}'::jsonb) - 'must_change_password' - 'temp_password_pending')
  || jsonb_build_object('must_change_password', false, 'temp_password_pending', false)
WHERE id = '84747979-b763-4a7e-ba57-af3dbf77b774';

-- 2) Asegurar rol owner
INSERT INTO public.user_roles (user_id, role)
VALUES ('84747979-b763-4a7e-ba57-af3dbf77b774', 'owner')
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Quitar general_manager (duplicidad innecesaria)
DELETE FROM public.user_roles
WHERE user_id = '84747979-b763-4a7e-ba57-af3dbf77b774'
  AND role = 'general_manager';