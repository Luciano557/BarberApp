UPDATE auth.users
SET email_confirmed_at = now()
WHERE id = 'd3111779-a809-4fe4-b250-3649d73cd44b'
  AND email = 'sebastian.tello20001@gmail.com'
  AND email_confirmed_at IS NULL;