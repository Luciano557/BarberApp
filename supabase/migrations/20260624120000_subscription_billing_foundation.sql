-- Subscription billing foundation.
-- Phase 1: tenant-level trial/access model and Mercado Pago subscription audit tables.

-- Keep the legacy feature table aligned with the commercial prices.
INSERT INTO public.plan_features (
  plan, max_barbers, max_services, can_export_reports, can_view_analytics, price_monthly
) VALUES
  ('basico', 5, 50, true, true, 30000),
  ('profesional', 999, 999, true, true, 60000),
  ('premium', 999, 999, true, true, 100000)
ON CONFLICT (plan) DO UPDATE
SET price_monthly = EXCLUDED.price_monthly;

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  code text PRIMARY KEY CHECK (code IN ('basico', 'profesional', 'premium')),
  name text NOT NULL,
  description text,
  amount_ars numeric(12, 2) NOT NULL CHECK (amount_ars >= 0),
  billing_period text NOT NULL DEFAULT 'monthly' CHECK (billing_period = 'monthly'),
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.subscription_plans (
  code, name, description, amount_ars, billing_period, sort_order, is_active
) VALUES
  ('basico', 'Basico', 'Plan mensual Basico', 30000, 'monthly', 10, true),
  ('profesional', 'Profesional', 'Plan mensual Profesional', 60000, 'monthly', 20, true),
  ('premium', 'Premium', 'Plan mensual Premium', 100000, 'monthly', 30, true)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  amount_ars = EXCLUDED.amount_ars,
  billing_period = EXCLUDED.billing_period,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  provider text NOT NULL DEFAULT 'mercadopago'
    CHECK (provider IN ('mercadopago', 'manual')),

  -- current_plan_code is the selected/paid plan. During trial it can be null.
  current_plan_code text REFERENCES public.subscription_plans(code),
  -- effective_plan_code is what the product should use for access/features.
  effective_plan_code text NOT NULL DEFAULT 'premium' REFERENCES public.subscription_plans(code),
  pending_plan_code text REFERENCES public.subscription_plans(code),
  billing_plan_code text REFERENCES public.subscription_plans(code),

  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,

  payer_email text,
  mercadopago_preapproval_id text,
  mercadopago_status text,
  mercadopago_init_point text,
  mercadopago_external_reference text,
  next_payment_date timestamptz,
  last_payment_at timestamptz,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id),
  UNIQUE (mercadopago_preapproval_id),
  UNIQUE (mercadopago_external_reference)
);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status
  ON public.organization_subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_period_end
  ON public.organization_subscriptions (current_period_end);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_mp_preapproval
  ON public.organization_subscriptions (mercadopago_preapproval_id)
  WHERE mercadopago_preapproval_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.subscription_plan_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.organization_subscriptions(id) ON DELETE SET NULL,
  from_plan_code text REFERENCES public.subscription_plans(code),
  to_plan_code text REFERENCES public.subscription_plans(code),
  change_type text NOT NULL CHECK (
    change_type IN (
      'initial_selection',
      'upgrade',
      'downgrade',
      'renewal',
      'reactivation',
      'cancel_requested',
      'cancel_reverted',
      'provider_sync'
    )
  ),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  effective_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  amount_ars numeric(12, 2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_subscription_plan_changes_org
  ON public.subscription_plan_changes (organization_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.organization_subscriptions(id) ON DELETE SET NULL,
  plan_code text REFERENCES public.subscription_plans(code),
  billing_plan_code text REFERENCES public.subscription_plans(code),
  amount_ars numeric(12, 2) NOT NULL CHECK (amount_ars >= 0),
  currency_id text NOT NULL DEFAULT 'ARS',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'in_process', 'rejected', 'cancelled', 'refunded', 'charged_back')),
  provider text NOT NULL DEFAULT 'mercadopago'
    CHECK (provider IN ('mercadopago', 'manual')),
  mercadopago_payment_id text UNIQUE,
  mercadopago_authorized_payment_id text UNIQUE,
  mercadopago_preapproval_id text,
  period_start timestamptz,
  period_end timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_org
  ON public.subscription_payments (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status
  ON public.subscription_payments (status);
CREATE TABLE IF NOT EXISTS public.mercadopago_subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.organization_subscriptions(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.subscription_payments(id) ON DELETE SET NULL,
  topic text,
  action text,
  data_id text,
  provider_event_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_subscription_events_org
  ON public.mercadopago_subscription_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_subscription_events_data_id
  ON public.mercadopago_subscription_events (data_id)
  WHERE data_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_subscription_events_dedupe
  ON public.mercadopago_subscription_events (
    COALESCE(topic, ''),
    COALESCE(action, ''),
    COALESCE(data_id, ''),
    COALESCE(provider_event_id, '')
  )
  WHERE data_id IS NOT NULL OR provider_event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_subscription_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_subscription_plans_touch ON public.subscription_plans;
CREATE TRIGGER trg_subscription_plans_touch
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.touch_subscription_updated_at();

DROP TRIGGER IF EXISTS trg_organization_subscriptions_touch ON public.organization_subscriptions;
CREATE TRIGGER trg_organization_subscriptions_touch
BEFORE UPDATE ON public.organization_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.touch_subscription_updated_at();

DROP TRIGGER IF EXISTS trg_subscription_payments_touch ON public.subscription_payments;
CREATE TRIGGER trg_subscription_payments_touch
BEFORE UPDATE ON public.subscription_payments
FOR EACH ROW EXECUTE FUNCTION public.touch_subscription_updated_at();

CREATE OR REPLACE FUNCTION public.get_organization_owner_id(_org_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p.id
    FROM public.profiles p
    JOIN public.user_roles ur
      ON ur.user_id = p.id
     AND ur.role = 'owner'::public.app_role
   WHERE p.organization_id = _org_id
   ORDER BY p.created_at ASC NULLS LAST
   LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.get_organization_trial_started_at(_org_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _owner_id uuid;
  _started_at timestamptz;
BEGIN
  _owner_id := public.get_organization_owner_id(_org_id);

  SELECT COALESCE(uo.started_at, au.created_at, p.created_at, o.created_at)
    INTO _started_at
    FROM public.organizations o
    LEFT JOIN public.profiles p ON p.id = _owner_id
    LEFT JOIN auth.users au ON au.id = _owner_id
    LEFT JOIN public.user_onboarding uo ON uo.user_id = _owner_id
   WHERE o.id = _org_id;

  RETURN _started_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_organization_trial_ends_at(_org_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.get_organization_trial_started_at(_org_id) + interval '15 days'
$function$;

CREATE OR REPLACE FUNCTION public.sync_organization_subscription_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _access_until timestamptz;
BEGIN
  _access_until := CASE
    WHEN NEW.status = 'trialing' THEN NEW.trial_ends_at
    ELSE NEW.current_period_end
  END;

  UPDATE public.organizations
     SET plan = NEW.effective_plan_code,
         plan_expires_at = _access_until
   WHERE id = NEW.organization_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_org_subscriptions_projection ON public.organization_subscriptions;
CREATE TRIGGER trg_org_subscriptions_projection
AFTER INSERT OR UPDATE OF status, effective_plan_code, trial_ends_at, current_period_end
ON public.organization_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_organization_subscription_projection();

CREATE OR REPLACE FUNCTION public.ensure_organization_subscription(_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _subscription_id uuid;
  _trial_started_at timestamptz;
  _trial_ends_at timestamptz;
BEGIN
  SELECT id INTO _subscription_id
    FROM public.organization_subscriptions
   WHERE organization_id = _org_id;

  IF _subscription_id IS NOT NULL THEN
    RETURN _subscription_id;
  END IF;

  _trial_started_at := public.get_organization_trial_started_at(_org_id);
  _trial_ends_at := _trial_started_at + interval '15 days';

  INSERT INTO public.organization_subscriptions (
    organization_id,
    status,
    provider,
    current_plan_code,
    effective_plan_code,
    billing_plan_code,
    trial_started_at,
    trial_ends_at,
    current_period_start,
    current_period_end
  ) VALUES (
    _org_id,
    'trialing',
    'mercadopago',
    NULL,
    'premium',
    NULL,
    _trial_started_at,
    _trial_ends_at,
    _trial_started_at,
    _trial_ends_at
  )
  ON CONFLICT (organization_id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id
  RETURNING id INTO _subscription_id;

  RETURN _subscription_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.initialize_organization_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.ensure_organization_subscription(NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_initialize_organization_subscription ON public.organizations;
CREATE TRIGGER trg_initialize_organization_subscription
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.initialize_organization_subscription();

CREATE OR REPLACE FUNCTION public.sync_owner_onboarding_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _org_id uuid;
BEGIN
  IF NEW.started_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.has_role(NEW.user_id, 'owner'::public.app_role) THEN
    RETURN NEW;
  END IF;

  SELECT organization_id
    INTO _org_id
    FROM public.profiles
   WHERE id = NEW.user_id;

  IF _org_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.ensure_organization_subscription(_org_id);

  UPDATE public.organization_subscriptions
     SET trial_started_at = NEW.started_at,
         trial_ends_at = NEW.started_at + interval '15 days',
         current_period_start = CASE
           WHEN status = 'trialing' THEN NEW.started_at
           ELSE current_period_start
         END,
         current_period_end = CASE
           WHEN status = 'trialing' THEN NEW.started_at + interval '15 days'
           ELSE current_period_end
         END
   WHERE organization_id = _org_id
     AND status = 'trialing';

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_owner_onboarding_trial ON public.user_onboarding;
CREATE TRIGGER trg_sync_owner_onboarding_trial
AFTER INSERT OR UPDATE OF started_at ON public.user_onboarding
FOR EACH ROW EXECUTE FUNCTION public.sync_owner_onboarding_trial();

-- Existing tenants keep access under the current legacy projection. The new
-- guard will use organization_subscriptions, but this avoids surprise lockouts
-- while the billing flow is rolled out.
INSERT INTO public.organization_subscriptions (
  organization_id,
  status,
  provider,
  current_plan_code,
  effective_plan_code,
  billing_plan_code,
  trial_started_at,
  trial_ends_at,
  current_period_start,
  current_period_end,
  last_payment_at
)
SELECT
  o.id,
  CASE WHEN COALESCE(o.is_active, true) THEN 'active' ELSE 'expired' END,
  'mercadopago',
  COALESCE(o.plan, 'premium'),
  COALESCE(o.plan, 'premium'),
  COALESCE(o.plan, 'premium'),
  public.get_organization_trial_started_at(o.id),
  public.get_organization_trial_ends_at(o.id),
  COALESCE(o.last_payment_at, o.created_at),
  CASE
    WHEN COALESCE(o.is_active, true)
      THEN GREATEST(COALESCE(o.plan_expires_at, now() + interval '30 days'), now() + interval '30 days')
    ELSE COALESCE(o.plan_expires_at, now())
  END,
  o.last_payment_at
FROM public.organizations o
ON CONFLICT (organization_id) DO NOTHING;

-- New organizations start with the Premium trial projection and no fake payment.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id uuid;
  new_sucursal_id uuid;
  org_name text;
  org_slug text;
  user_country text;
  user_timezone text;
  invited_by_id uuid;
  is_sucursal_acc boolean;
  owner_full_name text;
  owner_nombre text;
  owner_apellido text;
  new_barbero_id uuid;
BEGIN
  invited_by_id := (NEW.raw_user_meta_data->>'invited_by')::uuid;
  is_sucursal_acc := COALESCE((NEW.raw_user_meta_data->>'sucursal_account')::boolean, false);

  IF is_sucursal_acc THEN
    RETURN NEW;
  END IF;

  IF invited_by_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
    RETURN NEW;
  END IF;

  org_name := COALESCE(NEW.raw_user_meta_data->>'business_name', 'Mi Barberia');
  org_slug := LOWER(REPLACE(org_name, ' ', '-')) || '-' || SUBSTRING(gen_random_uuid()::text, 1, 8);
  user_country := COALESCE(NEW.raw_user_meta_data->>'country', 'AR');

  user_timezone := CASE user_country
    WHEN 'AR' THEN 'America/Argentina/Buenos_Aires'
    WHEN 'MX' THEN 'America/Mexico_City'
    WHEN 'CO' THEN 'America/Bogota'
    WHEN 'CL' THEN 'America/Santiago'
    WHEN 'PE' THEN 'America/Lima'
    WHEN 'EC' THEN 'America/Guayaquil'
    WHEN 'UY' THEN 'America/Montevideo'
    WHEN 'PY' THEN 'America/Asuncion'
    WHEN 'BO' THEN 'America/La_Paz'
    WHEN 'VE' THEN 'America/Caracas'
    WHEN 'ES' THEN 'Europe/Madrid'
    WHEN 'BR' THEN 'America/Sao_Paulo'
    WHEN 'CR' THEN 'America/Costa_Rica'
    WHEN 'PA' THEN 'America/Panama'
    WHEN 'DO' THEN 'America/Santo_Domingo'
    WHEN 'GT' THEN 'America/Guatemala'
    WHEN 'HN' THEN 'America/Tegucigalpa'
    WHEN 'SV' THEN 'America/El_Salvador'
    WHEN 'NI' THEN 'America/Managua'
    WHEN 'PR' THEN 'America/Puerto_Rico'
    WHEN 'CU' THEN 'America/Havana'
    ELSE 'America/Argentina/Buenos_Aires'
  END;

  INSERT INTO public.organizations (name, slug, plan, timezone, plan_expires_at, last_payment_at)
  VALUES (org_name, org_slug, 'premium', user_timezone, now() + interval '15 days', NULL)
  RETURNING id INTO new_org_id;

  INSERT INTO public.sucursales (organization_id, nombre, timezone)
  VALUES (new_org_id, 'Casa Central', user_timezone)
  RETURNING id INTO new_sucursal_id;

  owner_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  IF btrim(owner_full_name) = '' THEN
    owner_nombre := COALESCE(NEW.email, 'Dueno');
    owner_apellido := '';
  ELSIF position(' ' IN btrim(owner_full_name)) = 0 THEN
    owner_nombre := btrim(owner_full_name);
    owner_apellido := '';
  ELSE
    owner_nombre := split_part(btrim(owner_full_name), ' ', 1);
    owner_apellido := btrim(substring(btrim(owner_full_name) FROM position(' ' IN btrim(owner_full_name)) + 1));
  END IF;

  INSERT INTO public.barberos (
    organization_id, nombre, apellido, sucursal_id, comision,
    tipo_compensacion, rol_equipo, roles_equipo, fecha_cobro_dia, activo
  ) VALUES (
    new_org_id, owner_nombre, owner_apellido, NULL, 0,
    'comision', 'owner', ARRAY['owner']::text[], 1, true
  )
  RETURNING id INTO new_barbero_id;

  INSERT INTO public.profiles (id, email, full_name, organization_id, default_sucursal_id, barbero_id)
  VALUES (NEW.id, NEW.email, owner_full_name, new_org_id, new_sucursal_id, new_barbero_id);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');

  INSERT INTO public.user_sucursales (user_id, sucursal_id, organization_id)
  VALUES (NEW.id, new_sucursal_id, new_org_id);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_organization_subscription_access(_org_id uuid)
RETURNS TABLE (
  organization_id uuid,
  subscription_id uuid,
  status text,
  current_plan_code text,
  effective_plan_code text,
  pending_plan_code text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  has_access boolean,
  access_ends_at timestamptz,
  days_until_access_ends integer,
  block_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _caller_org uuid;
BEGIN
  _caller_org := public.get_user_organization_id(auth.uid());

  IF _caller_org IS NULL OR _caller_org <> _org_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.organization_id,
    s.id,
    s.status,
    s.current_plan_code,
    s.effective_plan_code,
    s.pending_plan_code,
    s.trial_started_at,
    s.trial_ends_at,
    s.current_period_end,
    s.cancel_at_period_end,
    CASE
      WHEN s.status = 'trialing' THEN now() < s.trial_ends_at
      WHEN s.status IN ('active', 'cancelled') THEN s.current_period_end IS NULL OR now() < s.current_period_end
      ELSE false
    END AS has_access,
    CASE
      WHEN s.status = 'trialing' THEN s.trial_ends_at
      ELSE s.current_period_end
    END AS access_ends_at,
    CASE
      WHEN (CASE WHEN s.status = 'trialing' THEN s.trial_ends_at ELSE s.current_period_end END) IS NULL THEN NULL
      ELSE GREATEST(
        CEIL(EXTRACT(EPOCH FROM (
          CASE WHEN s.status = 'trialing' THEN s.trial_ends_at ELSE s.current_period_end END
          - now()
        )) / 86400)::integer,
        0
      )
    END AS days_until_access_ends,
    CASE
      WHEN s.status = 'trialing' AND now() >= s.trial_ends_at THEN 'trial_expired'
      WHEN s.status = 'past_due' THEN 'payment_failed'
      WHEN s.status = 'active' AND s.current_period_end IS NOT NULL AND now() >= s.current_period_end THEN 'subscription_expired'
      WHEN s.status = 'expired' THEN 'subscription_expired'
      WHEN s.status = 'cancelled' AND s.current_period_end IS NOT NULL AND now() >= s.current_period_end THEN 'subscription_cancelled'
      ELSE NULL
    END AS block_reason
  FROM public.organization_subscriptions s
  WHERE s.organization_id = _org_id;
END;
$function$;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plan_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercadopago_subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_can_view_subscription_plans" ON public.subscription_plans;
CREATE POLICY "public_can_view_subscription_plans"
ON public.subscription_plans FOR SELECT
TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "org_members_can_view_own_subscription" ON public.organization_subscriptions;
CREATE POLICY "org_members_can_view_own_subscription"
ON public.organization_subscriptions FOR SELECT
TO authenticated
USING (organization_id = public.get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_members_can_view_own_plan_changes" ON public.subscription_plan_changes;
CREATE POLICY "org_members_can_view_own_plan_changes"
ON public.subscription_plan_changes FOR SELECT
TO authenticated
USING (organization_id = public.get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_members_can_view_own_subscription_payments" ON public.subscription_payments;
CREATE POLICY "org_members_can_view_own_subscription_payments"
ON public.subscription_payments FOR SELECT
TO authenticated
USING (organization_id = public.get_user_organization_id(auth.uid()));

GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT SELECT ON public.organization_subscriptions TO authenticated;
GRANT SELECT ON public.subscription_plan_changes TO authenticated;
GRANT SELECT ON public.subscription_payments TO authenticated;

REVOKE ALL ON FUNCTION public.touch_subscription_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_organization_owner_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_organization_trial_started_at(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_organization_trial_ends_at(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_organization_subscription_projection() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_organization_subscription(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.initialize_organization_subscription() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_owner_onboarding_trial() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_organization_subscription_access(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_organization_subscription_access(uuid) TO authenticated;
