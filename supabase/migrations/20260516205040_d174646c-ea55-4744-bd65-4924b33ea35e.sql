
BEGIN;
DELETE FROM public.access_logs     WHERE user_id = '84747979-b763-4a7e-ba57-af3dbf77b774';
DELETE FROM public.user_onboarding WHERE user_id = '84747979-b763-4a7e-ba57-af3dbf77b774';
DELETE FROM public.user_pins       WHERE user_id = '84747979-b763-4a7e-ba57-af3dbf77b774';
DELETE FROM public.user_sucursales WHERE user_id = '84747979-b763-4a7e-ba57-af3dbf77b774';
DELETE FROM public.user_roles      WHERE user_id = '84747979-b763-4a7e-ba57-af3dbf77b774';
DELETE FROM public.profiles        WHERE id      = '84747979-b763-4a7e-ba57-af3dbf77b774';
DELETE FROM auth.users             WHERE id      = '84747979-b763-4a7e-ba57-af3dbf77b774';
COMMIT;
