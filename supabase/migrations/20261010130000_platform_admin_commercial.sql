-- Prepared for Lovable. Do NOT apply directly to production from an agent.
-- No existing SECURITY DEFINER function is replaced; all new RPCs are INVOKER.
-- Platform-control contact data is not operational tenant/sucursal data.
CREATE TABLE public.platform_admin_organization_contacts (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text CHECK (email IS NULL OR (char_length(email) <= 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admin_organization_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admin_organization_contacts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.platform_admin_organization_contacts TO service_role;

CREATE FUNCTION public.platform_admin_manage_organization(
  _organization_id uuid,
  _actor_user_id uuid,
  _request_id uuid,
  _action text,
  _changes jsonb,
  _reason text,
  _expected_organization_updated_at timestamptz,
  _expected_subscription_updated_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $function$
DECLARE
  _org public.organizations%ROWTYPE;
  _sub public.organization_subscriptions%ROWTYPE;
  _existing public.platform_admin_audit_log%ROWTYPE;
  _has_sub boolean;
  _audit_action text;
  _fingerprint text;
  _before jsonb;
  _after jsonb;
  _email text;
  _name text;
  _phone text;
  _address text;
  _plan text;
  _ends_at timestamptz;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF _organization_id IS NULL OR _actor_user_id IS NULL OR _request_id IS NULL
     OR _reason IS NULL OR char_length(btrim(_reason)) < 10 OR char_length(_reason) > 500
     OR _reason ~ '[[:cntrl:]]' OR jsonb_typeof(_changes) IS DISTINCT FROM 'object'
     OR _action IS NULL OR _action NOT IN ('update_details', 'assign_manual_plan', 'extend_trial') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = '22023';
  END IF;
  _audit_action := CASE _action
    WHEN 'update_details' THEN 'organization.details_updated'
    WHEN 'assign_manual_plan' THEN 'organization.manual_plan_assigned'
    ELSE 'organization.trial_extended' END;
  _fingerprint := md5(jsonb_build_object('organization', _organization_id, 'actor', _actor_user_id,
    'action', _action, 'changes', _changes, 'reason', btrim(_reason),
    'expectedOrganization', _expected_organization_updated_at,
    'expectedSubscription', _expected_subscription_updated_at)::text);
  -- Serialize even different actions sharing the same request ID.
  PERFORM pg_advisory_xact_lock(hashtextextended(_request_id::text, 0));
  SELECT * INTO _existing FROM public.platform_admin_audit_log
  WHERE request_id = _request_id ORDER BY created_at, id LIMIT 1;
  IF FOUND THEN
    IF _existing.actor_user_id IS DISTINCT FROM _actor_user_id
       OR _existing.target_type IS DISTINCT FROM 'organization'
       OR _existing.target_id IS DISTINCT FROM _organization_id::text
       OR _existing.action IS DISTINCT FROM _audit_action
       OR _existing.result_detail->>'inputFingerprint' IS DISTINCT FROM _fingerprint THEN
      RAISE EXCEPTION 'COMMERCIAL_REQUEST_CONFLICT' USING ERRCODE = '40001';
    END IF;
    RETURN jsonb_build_object('organizationId', _organization_id, 'requestId', _request_id,
      'action', _action, 'replayed', true);
  END IF;

  -- Same plan-before-subscription lock order as catalogue/checkout writes.
  IF _action = 'assign_manual_plan' THEN
    IF NOT (_changes ?& ARRAY['planCode', 'endsAt'])
       OR _changes - ARRAY['planCode', 'endsAt'] <> '{}'::jsonb
       OR jsonb_typeof(_changes->'planCode') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = '22023';
    END IF;
    _plan := _changes->>'planCode';
    PERFORM 1 FROM public.subscription_plans WHERE code = _plan AND is_active FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_NOT_AVAILABLE' USING ERRCODE = '22023'; END IF;
  END IF;

  -- Existing billing RPCs lock the subscription before its projection updates
  -- the organization. Follow that order to avoid a reverse-lock deadlock.
  SELECT * INTO _sub FROM public.organization_subscriptions WHERE organization_id = _organization_id FOR UPDATE;
  _has_sub := FOUND;
  SELECT * INTO _org FROM public.organizations WHERE id = _organization_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF _org.updated_at IS DISTINCT FROM _expected_organization_updated_at THEN
    RAISE EXCEPTION 'COMMERCIAL_CONFLICT' USING ERRCODE = '40001';
  END IF;
  IF _sub.updated_at IS DISTINCT FROM _expected_subscription_updated_at THEN
    RAISE EXCEPTION 'COMMERCIAL_CONFLICT' USING ERRCODE = '40001';
  END IF;

  IF _action = 'update_details' THEN
    IF NOT (_changes ?& ARRAY['name', 'phone', 'address', 'contactEmail'])
       OR _changes - ARRAY['name', 'phone', 'address', 'contactEmail'] <> '{}'::jsonb
       OR jsonb_typeof(_changes->'name') IS DISTINCT FROM 'string'
       OR jsonb_typeof(_changes->'phone') NOT IN ('string', 'null')
       OR jsonb_typeof(_changes->'address') NOT IN ('string', 'null')
       OR jsonb_typeof(_changes->'contactEmail') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = '22023';
    END IF;
    _name := btrim(_changes->>'name');
    _phone := nullif(btrim(_changes->>'phone'), '');
    _address := nullif(btrim(_changes->>'address'), '');
    _email := nullif(lower(btrim(_changes->>'contactEmail')), '');
    IF _name = '' OR char_length(_name) > 120 OR char_length(_phone) > 40
       OR char_length(_address) > 300 OR char_length(_email) > 254
       OR concat(_name, _phone, _address, _email) ~ '[[:cntrl:]]'
       OR (_email IS NOT NULL AND _email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = '22023';
    END IF;
    _before := jsonb_build_object('name', _org.name, 'phone', _org.phone, 'address', _org.address,
      'contactEmail', (SELECT email FROM public.platform_admin_organization_contacts WHERE organization_id = _organization_id));
    UPDATE public.organizations SET name = _name, phone = _phone, address = _address, updated_at = now()
    WHERE id = _organization_id;
    INSERT INTO public.platform_admin_organization_contacts (organization_id, email, updated_at)
    VALUES (_organization_id, _email, now()) ON CONFLICT (organization_id)
    DO UPDATE SET email = EXCLUDED.email, updated_at = EXCLUDED.updated_at;
    _after := jsonb_build_object('name', _name, 'phone', _phone, 'address', _address, 'contactEmail', _email);
  ELSE
    -- No provider cancellation/GET/PUT is implicit in a manual grant or trial.
    -- Any provider reference (even marked cancelled) needs explicit reconciliation.
    IF _has_sub AND EXISTS (
      SELECT 1 FROM public.subscription_price_change_items
      WHERE subscription_id = _sub.id AND
        (status IN ('pending', 'processing') OR requires_compensation)
    ) THEN RAISE EXCEPTION 'OPERATION_IN_PROGRESS' USING ERRCODE = '40001'; END IF;
    IF _has_sub AND (
      nullif(_sub.mercadopago_preapproval_id, '') IS NOT NULL
      OR nullif(_sub.mercadopago_external_reference, '') IS NOT NULL
      OR nullif(_sub.mercadopago_status, '') IS NOT NULL
      OR nullif(_sub.mercadopago_init_point, '') IS NOT NULL
      OR _sub.pending_plan_code IS NOT NULL
      OR _sub.pending_checkout_amount_ars IS NOT NULL
      OR _sub.pending_checkout_price_version IS NOT NULL
      OR nullif(_sub.metadata->>'pending_mercadopago_preapproval_id', '') IS NOT NULL
      OR nullif(_sub.metadata->>'pending_mercadopago_external_reference', '') IS NOT NULL
      OR nullif(_sub.metadata->>'previous_mercadopago_preapproval_id', '') IS NOT NULL
      OR nullif(_sub.metadata->>'previous_mercadopago_external_reference', '') IS NOT NULL
    ) THEN RAISE EXCEPTION 'PROVIDER_RECONCILIATION_REQUIRED' USING ERRCODE = '40001'; END IF;
    BEGIN
      IF jsonb_typeof(_changes->'endsAt') NOT IN ('string', 'null') THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = '22023';
      END IF;
      _ends_at := (_changes->>'endsAt')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = '22023';
    END;
    IF _ends_at IS NOT NULL AND (NOT isfinite(_ends_at) OR _ends_at <= now()) THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = '22023';
    END IF;
    _before := jsonb_build_object('provider', _sub.provider, 'status', _sub.status,
      'planCode', _sub.effective_plan_code, 'currentPlanCode', _sub.current_plan_code,
      'billingPlanCode', _sub.billing_plan_code, 'accessEndsAt', _sub.current_period_end,
      'trialEndsAt', _sub.trial_ends_at, 'billingAmountArs', _sub.billing_amount_ars,
      'billingPriceVersion', _sub.billing_price_version);

    IF _action = 'assign_manual_plan' THEN
      IF NOT _has_sub THEN
        INSERT INTO public.organization_subscriptions
          (organization_id, provider, status, current_plan_code, effective_plan_code,
           current_period_start, current_period_end, metadata)
        VALUES (_organization_id, 'manual', 'active', _plan, _plan, now(), _ends_at,
          jsonb_build_object('manual_plan_change', true, 'manual_plan_changed_at', now(),
            'manual_reason', CASE WHEN _ends_at IS NULL THEN 'sin_vencimiento' ELSE 'admin_manual_grant' END));
      ELSE
        UPDATE public.organization_subscriptions SET provider = 'manual', status = 'active',
          current_plan_code = _plan, effective_plan_code = _plan, billing_plan_code = NULL,
          billing_amount_ars = NULL, billing_price_version = NULL, current_period_start = now(),
          current_period_end = _ends_at, cancel_at_period_end = false, cancelled_at = NULL,
          next_payment_date = NULL,
          metadata = metadata || jsonb_build_object('manual_plan_change', true,
            'manual_plan_changed_at', now(), 'manual_reason',
            CASE WHEN _ends_at IS NULL THEN 'sin_vencimiento' ELSE 'admin_manual_grant' END)
        WHERE id = _sub.id AND organization_id = _organization_id;
      END IF;
      -- Snapshots of a previous contract remain in audit/payment history, not
      -- in the fields representing a current billing contract for a courtesy.
    ELSE
      IF NOT (_changes ? 'endsAt') OR _changes - 'endsAt' <> '{}'::jsonb
         OR _ends_at IS NULL OR NOT _has_sub OR _sub.status NOT IN ('trialing', 'expired')
         OR _sub.current_plan_code IS NOT NULL OR _sub.last_payment_at IS NOT NULL
         OR (_sub.current_period_start IS NOT NULL AND _sub.current_period_start IS DISTINCT FROM _sub.trial_started_at)
         OR (_sub.current_period_end IS NOT NULL AND _sub.current_period_end IS DISTINCT FROM _sub.trial_ends_at)
         OR (_sub.trial_ends_at IS NOT NULL AND _ends_at <= _sub.trial_ends_at)
         OR EXISTS (SELECT 1 FROM public.subscription_payments
                    WHERE organization_id = _organization_id AND status = 'approved') THEN
        RAISE EXCEPTION 'TRIAL_EXTENSION_NOT_ALLOWED' USING ERRCODE = '40001';
      END IF;
      -- Provisioning historically mirrors trial dates into current_period_*.
      -- Keep that projection aligned, without treating the trial as paid.
      UPDATE public.organization_subscriptions SET status = 'trialing', trial_ends_at = _ends_at,
        current_period_end = CASE WHEN current_period_end IS NOT NULL THEN _ends_at ELSE NULL END
      WHERE id = _sub.id AND organization_id = _organization_id;
    END IF;
    SELECT * INTO _sub FROM public.organization_subscriptions WHERE organization_id = _organization_id;
    _after := jsonb_build_object('provider', _sub.provider, 'status', _sub.status,
      'planCode', _sub.effective_plan_code, 'currentPlanCode', _sub.current_plan_code,
      'billingPlanCode', _sub.billing_plan_code, 'accessEndsAt', _sub.current_period_end,
      'trialEndsAt', _sub.trial_ends_at, 'billingAmountArs', _sub.billing_amount_ars,
      'billingPriceVersion', _sub.billing_price_version);
    UPDATE public.organizations SET updated_at = now() WHERE id = _organization_id;
  END IF;

  INSERT INTO public.platform_admin_audit_log
    (actor_user_id, actor_alias, action, target_type, target_id, reason,
     previous_state, next_state, result_status, result_detail, request_id)
  VALUES (_actor_user_id, 'admin', _audit_action, 'organization', _organization_id::text,
    btrim(_reason), _before, _after, 'succeeded',
    jsonb_build_object('organizationId', _organization_id, 'inputFingerprint', _fingerprint), _request_id);
  RETURN jsonb_build_object('organizationId', _organization_id, 'requestId', _request_id,
    'action', _action, 'replayed', false);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'COMMERCIAL_CONFLICT' USING ERRCODE = '40001';
END;
$function$;
REVOKE ALL ON FUNCTION public.platform_admin_manage_organization(uuid, uuid, uuid, text, jsonb, text, timestamptz, timestamptz)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_manage_organization(uuid, uuid, uuid, text, jsonb, text, timestamptz, timestamptz)
TO service_role;
