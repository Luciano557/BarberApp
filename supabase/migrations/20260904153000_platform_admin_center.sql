-- Vittro platform administration foundation.
--
-- IMPORTANT DEPLOYMENT NOTE
-- -------------------------
-- This migration intentionally replaces public.handle_new_user(), which is an
-- existing SECURITY DEFINER trigger function, only to add the early
-- platform_admin provisioning exception below. Per the repository policy this
-- file must be reviewed and applied through Lovable; do not apply it directly
-- from a local or automated agent session.

-- subscription_plans.amount_ars is the only commercial price source.
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS price_version integer NOT NULL DEFAULT 1
  CHECK (price_version > 0);

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS billing_amount_ars numeric(12, 2)
    CHECK (billing_amount_ars IS NULL OR billing_amount_ars > 0),
  ADD COLUMN IF NOT EXISTS billing_price_version integer
    CHECK (billing_price_version IS NULL OR billing_price_version > 0),
  ADD COLUMN IF NOT EXISTS pending_checkout_amount_ars numeric(12, 2)
    CHECK (pending_checkout_amount_ars IS NULL OR pending_checkout_amount_ars > 0),
  ADD COLUMN IF NOT EXISTS pending_checkout_price_version integer
    CHECK (pending_checkout_price_version IS NULL OR pending_checkout_price_version > 0);

-- Preserve a best-effort billing snapshot for existing paid subscriptions.
-- Existing pending links deliberately remain unversioned so checkout code will
-- never reuse a link created before this migration.
UPDATE public.organization_subscriptions AS subscription
SET
  billing_amount_ars = COALESCE(
    subscription.billing_amount_ars,
    (
      SELECT payment.amount_ars
      FROM public.subscription_payments AS payment
      WHERE payment.subscription_id = subscription.id
        AND payment.status = 'approved'
      ORDER BY payment.paid_at DESC NULLS LAST, payment.created_at DESC
      LIMIT 1
    ),
    plan.amount_ars
  ),
  billing_price_version = COALESCE(
    subscription.billing_price_version,
    CASE
      WHEN COALESCE(
        subscription.billing_amount_ars,
        (
          SELECT payment.amount_ars
          FROM public.subscription_payments AS payment
          WHERE payment.subscription_id = subscription.id
            AND payment.status = 'approved'
          ORDER BY payment.paid_at DESC NULLS LAST, payment.created_at DESC
          LIMIT 1
        ),
        plan.amount_ars
      ) = plan.amount_ars
      THEN plan.price_version
      ELSE NULL
    END
  )
FROM public.subscription_plans AS plan
WHERE plan.code = COALESCE(
  subscription.billing_plan_code,
  subscription.current_plan_code,
  subscription.effective_plan_code
)
  AND (
    subscription.billing_amount_ars IS NULL
    OR subscription.billing_price_version IS NULL
  );

CREATE TABLE IF NOT EXISTS public.platform_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_alias text NOT NULL DEFAULT 'admin',
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  reason text,
  previous_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_status text NOT NULL DEFAULT 'succeeded'
    CHECK (result_status IN ('pending', 'succeeded', 'partial', 'failed', 'skipped')),
  result_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_admin_audit_reason_length
    CHECK (reason IS NULL OR char_length(reason) <= 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_admin_audit_request_action
  ON public.platform_admin_audit_log (request_id, action);
CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_created
  ON public.platform_admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_actor
  ON public.platform_admin_audit_log (actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.subscription_price_change_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL REFERENCES public.subscription_plans(code),
  old_amount_ars numeric(12, 2) NOT NULL CHECK (old_amount_ars > 0),
  new_amount_ars numeric(12, 2) NOT NULL CHECK (new_amount_ars > 0),
  old_price_version integer NOT NULL CHECK (old_price_version > 0),
  new_price_version integer NOT NULL CHECK (new_price_version > 0),
  expected_updated_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'partially_completed', 'completed', 'failed')),
  total_items integer NOT NULL DEFAULT 0 CHECK (total_items >= 0),
  processed_items integer NOT NULL DEFAULT 0 CHECK (processed_items >= 0),
  succeeded_items integer NOT NULL DEFAULT 0 CHECK (succeeded_items >= 0),
  failed_items integer NOT NULL DEFAULT 0 CHECK (failed_items >= 0),
  skipped_items integer NOT NULL DEFAULT 0 CHECK (skipped_items >= 0),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_alias text NOT NULL DEFAULT 'admin',
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 500),
  request_id uuid NOT NULL UNIQUE,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_price_change_version_step
    CHECK (new_price_version = old_price_version + 1),
  CONSTRAINT subscription_price_change_amount_changed
    CHECK (new_amount_ars <> old_amount_ars)
);

CREATE INDEX IF NOT EXISTS idx_price_change_batches_plan_created
  ON public.subscription_price_change_batches (plan_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_change_batches_status
  ON public.subscription_price_change_batches (status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_change_batches_one_unfinished_plan
  ON public.subscription_price_change_batches (plan_code)
  WHERE status <> 'completed';

CREATE TABLE IF NOT EXISTS public.subscription_price_change_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL
    REFERENCES public.subscription_price_change_batches(id) ON DELETE CASCADE,
  organization_id uuid
    REFERENCES public.organizations(id) ON DELETE SET NULL,
  subscription_id uuid
    REFERENCES public.organization_subscriptions(id) ON DELETE SET NULL,
  preapproval_id text,
  item_type text NOT NULL
    CHECK (item_type IN ('active_renewal', 'pending_checkout')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 100),
  idempotency_key uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  last_http_status integer,
  error_code text,
  error_message text,
  provider_response_ref text,
  next_retry_at timestamptz,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, subscription_id, item_type),
  CONSTRAINT subscription_price_change_error_length
    CHECK (error_message IS NULL OR char_length(error_message) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_price_change_items_work_queue
  ON public.subscription_price_change_items (batch_id, status, next_retry_at, created_at);
CREATE INDEX IF NOT EXISTS idx_price_change_items_subscription
  ON public.subscription_price_change_items (subscription_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_price_change_batches_touch
  ON public.subscription_price_change_batches;
CREATE TRIGGER trg_price_change_batches_touch
BEFORE UPDATE ON public.subscription_price_change_batches
FOR EACH ROW EXECUTE FUNCTION public.touch_subscription_updated_at();

DROP TRIGGER IF EXISTS trg_price_change_items_touch
  ON public.subscription_price_change_items;
CREATE TRIGGER trg_price_change_items_touch
BEFORE UPDATE ON public.subscription_price_change_items
FOR EACH ROW EXECUTE FUNCTION public.touch_subscription_updated_at();

ALTER TABLE public.platform_admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_price_change_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_price_change_items ENABLE ROW LEVEL SECURITY;

-- There are intentionally no client policies. These control-plane tables are
-- reachable only by service_role after an Edge Function has authenticated the
-- platform administrator.
REVOKE ALL ON TABLE public.platform_admin_audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.subscription_price_change_batches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.subscription_price_change_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.platform_admin_audit_log TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.subscription_price_change_batches TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.subscription_price_change_items TO service_role;

-- Transactionally updates the catalog and materializes an immutable work list.
-- SECURITY INVOKER is deliberate: only service_role has table privileges/RLS
-- bypass and EXECUTE permission.
CREATE OR REPLACE FUNCTION public.platform_admin_create_price_change_batch(
  _plan_code text,
  _new_amount_ars numeric,
  _expected_amount_ars numeric,
  _expected_price_version integer,
  _expected_updated_at timestamptz,
  _actor_user_id uuid,
  _reason text,
  _request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  _plan public.subscription_plans%ROWTYPE;
  _batch public.subscription_price_change_batches%ROWTYPE;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF _new_amount_ars IS NULL OR _new_amount_ars <= 0 THEN
    RAISE EXCEPTION 'INVALID_PRICE' USING ERRCODE = '22023';
  END IF;

  IF char_length(btrim(COALESCE(_reason, ''))) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'INVALID_REASON' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _plan
  FROM public.subscription_plans
  WHERE code = _plan_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF _plan.amount_ars IS DISTINCT FROM _expected_amount_ars
    OR _plan.price_version IS DISTINCT FROM _expected_price_version
    OR _plan.updated_at IS DISTINCT FROM _expected_updated_at THEN
    RAISE EXCEPTION 'CATALOG_CONFLICT' USING ERRCODE = '40001';
  END IF;

  IF _plan.amount_ars = _new_amount_ars THEN
    RAISE EXCEPTION 'PRICE_UNCHANGED' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.subscription_price_change_batches (
    plan_code,
    old_amount_ars,
    new_amount_ars,
    old_price_version,
    new_price_version,
    expected_updated_at,
    actor_user_id,
    actor_alias,
    reason,
    request_id
  ) VALUES (
    _plan.code,
    _plan.amount_ars,
    _new_amount_ars,
    _plan.price_version,
    _plan.price_version + 1,
    _plan.updated_at,
    _actor_user_id,
    CASE WHEN _actor_user_id IS NULL THEN 'deployment' ELSE 'admin' END,
    btrim(_reason),
    _request_id
  )
  RETURNING * INTO _batch;

  UPDATE public.subscription_plans
  SET
    amount_ars = _new_amount_ars,
    price_version = _plan.price_version + 1
  WHERE code = _plan.code;

  INSERT INTO public.subscription_price_change_items (
    batch_id,
    organization_id,
    subscription_id,
    preapproval_id,
    item_type,
    status,
    error_code,
    error_message,
    completed_at
  )
  SELECT
    _batch.id,
    subscription.organization_id,
    subscription.id,
    NULLIF(subscription.mercadopago_preapproval_id, ''),
    'active_renewal',
    CASE
      WHEN subscription.provider <> 'mercadopago' THEN 'skipped'
      WHEN NULLIF(subscription.mercadopago_preapproval_id, '') IS NULL THEN 'skipped'
      ELSE 'pending'
    END,
    CASE
      WHEN subscription.provider <> 'mercadopago' THEN 'provider_not_supported'
      WHEN NULLIF(subscription.mercadopago_preapproval_id, '') IS NULL THEN 'missing_preapproval'
      ELSE NULL
    END,
    CASE
      WHEN subscription.provider <> 'mercadopago' THEN 'La suscripcion no usa Mercado Pago.'
      WHEN NULLIF(subscription.mercadopago_preapproval_id, '') IS NULL THEN 'Falta la referencia de preapproval.'
      ELSE NULL
    END,
    CASE
      WHEN subscription.provider <> 'mercadopago'
        OR NULLIF(subscription.mercadopago_preapproval_id, '') IS NULL
      THEN now()
      ELSE NULL
    END
  FROM public.organization_subscriptions AS subscription
  WHERE subscription.status = 'active'
    AND COALESCE(
      CASE
        WHEN subscription.pending_plan_code IS NOT NULL
          AND NULLIF(subscription.metadata->>'pending_mercadopago_preapproval_id', '') IS NULL
          AND subscription.mercadopago_status IS DISTINCT FROM 'pending'
          AND subscription.pending_checkout_amount_ars IS NULL
          AND subscription.pending_checkout_price_version IS NULL
        THEN subscription.pending_plan_code
      END,
      subscription.billing_plan_code,
      subscription.current_plan_code,
      subscription.effective_plan_code
    ) = _plan.code;

  INSERT INTO public.subscription_price_change_items (
    batch_id,
    organization_id,
    subscription_id,
    preapproval_id,
    item_type,
    status,
    error_code,
    error_message,
    completed_at
  )
  SELECT
    _batch.id,
    subscription.organization_id,
    subscription.id,
    pending_checkout.preapproval_id,
    'pending_checkout',
    CASE
      WHEN subscription.provider <> 'mercadopago' THEN 'skipped'
      WHEN pending_checkout.preapproval_id IS NULL THEN 'skipped'
      ELSE 'pending'
    END,
    CASE
      WHEN subscription.provider <> 'mercadopago' THEN 'provider_not_supported'
      WHEN pending_checkout.preapproval_id IS NULL THEN 'missing_preapproval'
      ELSE NULL
    END,
    CASE
      WHEN subscription.provider <> 'mercadopago' THEN 'El checkout pendiente no usa Mercado Pago.'
      WHEN pending_checkout.preapproval_id IS NULL THEN 'Falta la referencia del checkout pendiente.'
      ELSE NULL
    END,
    CASE
      WHEN subscription.provider <> 'mercadopago'
        OR pending_checkout.preapproval_id IS NULL
      THEN now()
      ELSE NULL
    END
  FROM public.organization_subscriptions AS subscription
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      NULLIF(subscription.metadata->>'pending_mercadopago_preapproval_id', ''),
      CASE WHEN subscription.mercadopago_status = 'pending'
        THEN NULLIF(subscription.mercadopago_preapproval_id, '')
      END
    ) AS preapproval_id
  ) AS pending_checkout
  WHERE subscription.pending_plan_code = _plan.code
    AND (
      pending_checkout.preapproval_id IS NOT NULL
      OR subscription.pending_checkout_amount_ars IS NOT NULL
      OR subscription.pending_checkout_price_version IS NOT NULL
    );

  INSERT INTO public.platform_admin_audit_log (
    actor_user_id,
    actor_alias,
    action,
    target_type,
    target_id,
    reason,
    previous_state,
    next_state,
    result_status,
    request_id
  ) VALUES (
    _actor_user_id,
    CASE WHEN _actor_user_id IS NULL THEN 'deployment' ELSE 'admin' END,
    'subscription_price_change.created',
    'subscription_plan',
    _plan.code,
    btrim(_reason),
    jsonb_build_object(
      'amountArs', _plan.amount_ars,
      'priceVersion', _plan.price_version,
      'updatedAt', _plan.updated_at
    ),
    jsonb_build_object(
      'amountArs', _new_amount_ars,
      'priceVersion', _plan.price_version + 1,
      'batchId', _batch.id
    ),
    'pending',
    _request_id
  );

  SELECT * INTO _batch
  FROM public.subscription_price_change_batches
  WHERE id = _batch.id;

  RETURN to_jsonb(_batch);
END;
$function$;

-- Atomically claims no more than the requested bounded work set. Rows left in
-- processing by an interrupted worker become claimable after 15 minutes.
CREATE OR REPLACE FUNCTION public.platform_admin_claim_price_change_items(
  _batch_id uuid,
  _limit integer DEFAULT 20
)
RETURNS SETOF public.subscription_price_change_items
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.subscription_price_change_items AS item
  SET
    status = 'skipped',
    error_code = 'subscription_removed',
    error_message = 'La suscripcion fue eliminada antes del procesamiento.',
    claimed_at = NULL,
    next_retry_at = NULL,
    completed_at = now()
  WHERE item.batch_id = _batch_id
    AND (
      item.status = 'pending'
      OR (item.status = 'processing' AND item.claimed_at < now() - interval '15 minutes')
    )
    AND (
      item.subscription_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.organization_subscriptions AS subscription
        WHERE subscription.id = item.subscription_id
      )
    );

  -- A subscription can change plan or checkout while a batch is waiting. Do
  -- not let a stale work item mutate the replacement preapproval.
  UPDATE public.subscription_price_change_items AS item
  SET
    status = 'skipped',
    error_code = 'subscription_changed',
    error_message = 'La suscripcion o su preapproval cambiaron antes del procesamiento.',
    claimed_at = NULL,
    next_retry_at = NULL,
    completed_at = now()
  FROM public.organization_subscriptions AS subscription,
       public.subscription_price_change_batches AS batch
  WHERE item.batch_id = _batch_id
    AND batch.id = item.batch_id
    AND subscription.id = item.subscription_id
    AND (
      item.status = 'pending'
      OR (item.status = 'processing' AND item.claimed_at < now() - interval '15 minutes')
    )
    AND NOT (
      subscription.provider = 'mercadopago'
      AND (
        (
          item.item_type = 'active_renewal'
          AND subscription.status = 'active'
          AND COALESCE(
            CASE
              WHEN subscription.pending_plan_code IS NOT NULL
                AND NULLIF(subscription.metadata->>'pending_mercadopago_preapproval_id', '') IS NULL
                AND subscription.mercadopago_status IS DISTINCT FROM 'pending'
                AND subscription.pending_checkout_amount_ars IS NULL
                AND subscription.pending_checkout_price_version IS NULL
              THEN subscription.pending_plan_code
            END,
            subscription.billing_plan_code,
            subscription.current_plan_code,
            subscription.effective_plan_code
          ) = batch.plan_code
          AND NULLIF(subscription.mercadopago_preapproval_id, '') = item.preapproval_id
        )
        OR (
          item.item_type = 'pending_checkout'
          AND subscription.pending_plan_code = batch.plan_code
          AND COALESCE(
            NULLIF(subscription.metadata->>'pending_mercadopago_preapproval_id', ''),
            CASE WHEN subscription.mercadopago_status = 'pending'
              THEN NULLIF(subscription.mercadopago_preapproval_id, '')
            END
          ) = item.preapproval_id
        )
      )
    );

  IF _limit < 1 OR _limit > 20 THEN
    RAISE EXCEPTION 'INVALID_BATCH_LIMIT' USING ERRCODE = '22023';
  END IF;

  UPDATE public.subscription_price_change_batches
  SET status = 'processing', started_at = COALESCE(started_at, now())
  WHERE id = _batch_id
    AND status IN ('pending', 'processing', 'partially_completed', 'failed');

  RETURN QUERY
  WITH candidates AS (
    SELECT item.id
    FROM public.subscription_price_change_items AS item
    WHERE item.batch_id = _batch_id
      AND item.attempts < 3
      AND (
        (item.status = 'pending' AND (item.next_retry_at IS NULL OR item.next_retry_at <= now()))
        OR (item.status = 'processing' AND item.claimed_at < now() - interval '15 minutes')
      )
    ORDER BY item.created_at, item.id
    FOR UPDATE SKIP LOCKED
    LIMIT _limit
  )
  UPDATE public.subscription_price_change_items AS item
  SET
    status = 'processing',
    claimed_at = now(),
    next_retry_at = NULL
  FROM candidates
  WHERE item.id = candidates.id
  RETURNING item.*;
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_retry_price_change_items(
  _batch_id uuid,
  _item_ids uuid[] DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  _updated integer;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.subscription_price_change_items AS item
  SET
    status = 'skipped',
    error_code = 'subscription_removed',
    error_message = 'La suscripcion fue eliminada antes del reintento.',
    next_retry_at = NULL,
    claimed_at = NULL,
    completed_at = now()
  WHERE item.batch_id = _batch_id
    AND (
      item.status = 'failed'
      OR (item.status = 'skipped' AND item.error_code = 'missing_preapproval')
      OR (item.status = 'processing' AND item.claimed_at < now() - interval '5 minutes')
    )
    AND (_item_ids IS NULL OR item.id = ANY(_item_ids))
    AND (
      item.subscription_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.organization_subscriptions AS subscription
        WHERE subscription.id = item.subscription_id
      )
    );

  -- A different plan is a terminal exclusion for this immutable batch.
  UPDATE public.subscription_price_change_items AS item
  SET
    status = 'skipped',
    error_code = 'subscription_changed',
    error_message = 'La suscripcion cambio de plan antes del reintento.',
    next_retry_at = NULL,
    claimed_at = NULL,
    completed_at = now()
  FROM public.organization_subscriptions AS subscription,
       public.subscription_price_change_batches AS batch
  WHERE item.batch_id = _batch_id
    AND batch.id = item.batch_id
    AND item.subscription_id = subscription.id
    AND (
      item.status = 'failed'
      OR (item.status = 'skipped' AND item.error_code = 'missing_preapproval')
      OR (item.status = 'processing' AND item.claimed_at < now() - interval '5 minutes')
    )
    AND (_item_ids IS NULL OR item.id = ANY(_item_ids))
    AND NOT (
      subscription.provider = 'mercadopago'
      AND (
        (
          item.item_type = 'active_renewal'
          AND subscription.status = 'active'
          AND COALESCE(
            CASE
              WHEN subscription.pending_plan_code IS NOT NULL
                AND NULLIF(subscription.metadata->>'pending_mercadopago_preapproval_id', '') IS NULL
                AND subscription.mercadopago_status IS DISTINCT FROM 'pending'
                AND subscription.pending_checkout_amount_ars IS NULL
                AND subscription.pending_checkout_price_version IS NULL
              THEN subscription.pending_plan_code
            END,
            subscription.billing_plan_code,
            subscription.current_plan_code,
            subscription.effective_plan_code
          ) = batch.plan_code
        )
        OR (
          item.item_type = 'pending_checkout'
          AND subscription.pending_plan_code = batch.plan_code
        )
      )
    );

  -- Reopen only a target that still belongs to the same plan. If a checkout
  -- was safely recreated for that plan, rotate the provider idempotency key.
  UPDATE public.subscription_price_change_items AS item
  SET
    preapproval_id = CASE item.item_type
      WHEN 'active_renewal' THEN NULLIF(subscription.mercadopago_preapproval_id, '')
      ELSE COALESCE(
        NULLIF(subscription.metadata->>'pending_mercadopago_preapproval_id', ''),
        CASE WHEN subscription.mercadopago_status = 'pending'
          THEN NULLIF(subscription.mercadopago_preapproval_id, '')
        END
      )
    END,
    idempotency_key = CASE
      WHEN item.preapproval_id IS DISTINCT FROM CASE item.item_type
        WHEN 'active_renewal' THEN NULLIF(subscription.mercadopago_preapproval_id, '')
        ELSE COALESCE(
          NULLIF(subscription.metadata->>'pending_mercadopago_preapproval_id', ''),
          CASE WHEN subscription.mercadopago_status = 'pending'
            THEN NULLIF(subscription.mercadopago_preapproval_id, '')
          END
        )
      END
      THEN gen_random_uuid()
      ELSE item.idempotency_key
    END,
    status = 'pending',
    attempts = 0,
    last_http_status = NULL,
    error_code = NULL,
    error_message = NULL,
    provider_response_ref = NULL,
    next_retry_at = NULL,
    claimed_at = NULL,
    completed_at = NULL
  FROM public.organization_subscriptions AS subscription,
       public.subscription_price_change_batches AS batch
  WHERE item.batch_id = _batch_id
    AND batch.id = item.batch_id
    AND item.subscription_id = subscription.id
    AND (
      item.status = 'failed'
      OR (item.status = 'skipped' AND item.error_code = 'missing_preapproval')
      OR (item.status = 'processing' AND item.claimed_at < now() - interval '5 minutes')
    )
    AND (_item_ids IS NULL OR item.id = ANY(_item_ids))
    AND subscription.provider = 'mercadopago'
    AND (
      (
        item.item_type = 'active_renewal'
        AND subscription.status = 'active'
        AND COALESCE(
          CASE
            WHEN subscription.pending_plan_code IS NOT NULL
              AND NULLIF(subscription.metadata->>'pending_mercadopago_preapproval_id', '') IS NULL
              AND subscription.mercadopago_status IS DISTINCT FROM 'pending'
              AND subscription.pending_checkout_amount_ars IS NULL
              AND subscription.pending_checkout_price_version IS NULL
            THEN subscription.pending_plan_code
          END,
          subscription.billing_plan_code,
          subscription.current_plan_code,
          subscription.effective_plan_code
        ) = batch.plan_code
        AND NULLIF(subscription.mercadopago_preapproval_id, '') IS NOT NULL
      )
      OR (
        item.item_type = 'pending_checkout'
        AND subscription.pending_plan_code = batch.plan_code
        AND COALESCE(
          NULLIF(subscription.metadata->>'pending_mercadopago_preapproval_id', ''),
          CASE WHEN subscription.mercadopago_status = 'pending'
            THEN NULLIF(subscription.mercadopago_preapproval_id, '')
          END
        ) IS NOT NULL
      )
    );

  GET DIAGNOSTICS _updated = ROW_COUNT;

  IF _updated > 0 THEN
    UPDATE public.subscription_price_change_batches
    SET status = 'processing', completed_at = NULL
    WHERE id = _batch_id;
  END IF;

  RETURN _updated;
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_refresh_price_change_batch(
  _batch_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  _total integer;
  _pending integer;
  _processing integer;
  _succeeded integer;
  _failed integer;
  _skipped integer;
  _next_status text;
  _batch public.subscription_price_change_batches%ROWTYPE;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE status = 'pending')::integer,
    count(*) FILTER (WHERE status = 'processing')::integer,
    count(*) FILTER (WHERE status = 'succeeded')::integer,
    count(*) FILTER (WHERE status = 'failed')::integer,
    count(*) FILTER (WHERE status = 'skipped')::integer
  INTO _total, _pending, _processing, _succeeded, _failed, _skipped
  FROM public.subscription_price_change_items
  WHERE batch_id = _batch_id;

  _next_status := CASE
    WHEN _pending > 0 OR _processing > 0 THEN 'processing'
    WHEN _failed = 0 THEN 'completed'
    WHEN _succeeded > 0 OR _skipped > 0 THEN 'partially_completed'
    ELSE 'failed'
  END;

  UPDATE public.subscription_price_change_batches
  SET
    status = _next_status,
    total_items = _total,
    processed_items = _succeeded + _failed + _skipped,
    succeeded_items = _succeeded,
    failed_items = _failed,
    skipped_items = _skipped,
    completed_at = CASE
      WHEN _pending = 0 AND _processing = 0 THEN COALESCE(completed_at, now())
      ELSE NULL
    END
  WHERE id = _batch_id
  RETURNING * INTO _batch;

  IF _batch.id IS NULL THEN
    RAISE EXCEPTION 'BATCH_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.platform_admin_audit_log
  SET
    result_status = CASE _next_status
      WHEN 'completed' THEN 'succeeded'
      WHEN 'partially_completed' THEN 'partial'
      WHEN 'failed' THEN 'failed'
      ELSE 'pending'
    END,
    result_detail = jsonb_build_object(
      'batchId', _batch.id,
      'total', _total,
      'succeeded', _succeeded,
      'failed', _failed,
      'skipped', _skipped
    )
  WHERE request_id = _batch.request_id
    AND action = 'subscription_price_change.created';

  RETURN to_jsonb(_batch);
END;
$function$;

-- Commits the local billing snapshot and the successful queue result together,
-- after Mercado Pago accepted the idempotent PUT.
CREATE OR REPLACE FUNCTION public.platform_admin_complete_price_change_item(
  _item_id uuid,
  _expected_idempotency_key uuid,
  _expected_preapproval_id text,
  _expected_claimed_at timestamptz,
  _attempts integer,
  _http_status integer,
  _provider_response_ref text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  _item public.subscription_price_change_items%ROWTYPE;
  _batch public.subscription_price_change_batches%ROWTYPE;
  _subscription public.organization_subscriptions%ROWTYPE;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _item
  FROM public.subscription_price_change_items
  WHERE id = _item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF _item.idempotency_key IS DISTINCT FROM _expected_idempotency_key
    OR _item.preapproval_id IS DISTINCT FROM _expected_preapproval_id
    OR _item.claimed_at IS DISTINCT FROM _expected_claimed_at THEN
    RAISE EXCEPTION 'ITEM_CLAIM_LOST' USING ERRCODE = '40001';
  END IF;

  IF _item.status = 'succeeded' THEN
    RETURN to_jsonb(_item);
  END IF;
  IF _item.status <> 'processing' THEN
    RAISE EXCEPTION 'ITEM_NOT_CLAIMED' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO _batch
  FROM public.subscription_price_change_batches
  WHERE id = _item.batch_id;

  SELECT * INTO _subscription
  FROM public.organization_subscriptions
  WHERE id = _item.subscription_id
  FOR UPDATE;

  IF NOT FOUND OR NOT (
    _subscription.provider = 'mercadopago'
    AND (
      (
        _item.item_type = 'active_renewal'
        AND _subscription.status = 'active'
        AND COALESCE(
          CASE
            WHEN _subscription.pending_plan_code IS NOT NULL
              AND NULLIF(_subscription.metadata->>'pending_mercadopago_preapproval_id', '') IS NULL
              AND _subscription.mercadopago_status IS DISTINCT FROM 'pending'
              AND _subscription.pending_checkout_amount_ars IS NULL
              AND _subscription.pending_checkout_price_version IS NULL
            THEN _subscription.pending_plan_code
          END,
          _subscription.billing_plan_code,
          _subscription.current_plan_code,
          _subscription.effective_plan_code
        ) = _batch.plan_code
        AND NULLIF(_subscription.mercadopago_preapproval_id, '') = _item.preapproval_id
      )
      OR (
        _item.item_type = 'pending_checkout'
        AND _subscription.pending_plan_code = _batch.plan_code
        AND COALESCE(
          NULLIF(_subscription.metadata->>'pending_mercadopago_preapproval_id', ''),
          CASE WHEN _subscription.mercadopago_status = 'pending'
            THEN NULLIF(_subscription.mercadopago_preapproval_id, '')
          END
        ) = _item.preapproval_id
      )
    )
  ) THEN
    -- Mercado Pago already accepted the PUT, so the worker must first restore
    -- the provider's newly-current local intent (or cancel an orphan) before
    -- this item can become skipped/failed. Keep the fenced claim untouched.
    RETURN to_jsonb(_item) || jsonb_build_object(
      'status', 'compensation_required',
      'attempts', LEAST(GREATEST(_attempts, _item.attempts), 100),
      'last_http_status', _http_status,
      'provider_response_ref', left(_provider_response_ref, 250)
    );
  END IF;

  IF _item.item_type = 'active_renewal' THEN
    IF _subscription.pending_plan_code = _batch.plan_code
      AND NULLIF(_subscription.metadata->>'pending_mercadopago_preapproval_id', '') IS NULL
      AND _subscription.mercadopago_status IS DISTINCT FROM 'pending'
      AND _subscription.pending_checkout_amount_ars IS NULL
      AND _subscription.pending_checkout_price_version IS NULL THEN
      UPDATE public.organization_subscriptions
      SET metadata = metadata || jsonb_build_object(
        'scheduled_renewal_amount_ars', _batch.new_amount_ars,
        'scheduled_renewal_price_version', _batch.new_price_version
      )
      WHERE id = _subscription.id;
    ELSE
      UPDATE public.organization_subscriptions
      SET
        billing_amount_ars = _batch.new_amount_ars,
        billing_price_version = _batch.new_price_version
      WHERE id = _subscription.id;
    END IF;
  ELSE
    UPDATE public.organization_subscriptions
    SET
      pending_checkout_amount_ars = _batch.new_amount_ars,
      pending_checkout_price_version = _batch.new_price_version
    WHERE id = _subscription.id;
  END IF;

  UPDATE public.subscription_price_change_items
  SET
    status = 'succeeded',
    attempts = LEAST(GREATEST(_attempts, attempts), 100),
    last_http_status = _http_status,
    error_code = NULL,
    error_message = NULL,
    provider_response_ref = left(_provider_response_ref, 250),
    next_retry_at = NULL,
    completed_at = now()
  WHERE id = _item.id
  RETURNING * INTO _item;

  RETURN to_jsonb(_item);
END;
$function$;

-- Serializes checkout persistence with catalog price changes. The checkout is
-- created at Mercado Pago first, then this transaction takes a shared lock on
-- the exact catalog version. A concurrent admin price batch takes FOR UPDATE on
-- the same row, so either the checkout is included in that batch or it is
-- rejected and its provider preapproval is cancelled by the Edge Function.
CREATE OR REPLACE FUNCTION public.subscription_finalize_checkout(
  _organization_id uuid,
  _plan_code text,
  _expected_amount_ars numeric,
  _expected_price_version integer,
  _expected_plan_updated_at timestamptz,
  _existing_subscription_id uuid,
  _expected_subscription_updated_at timestamptz,
  _preapproval_id text,
  _external_reference text,
  _init_point text,
  _payer_email text,
  _provider_status text,
  _metadata jsonb,
  _preserve_current_provider boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  _plan public.subscription_plans%ROWTYPE;
  _subscription public.organization_subscriptions%ROWTYPE;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'SUBSCRIPTION_SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _plan
  FROM public.subscription_plans
  WHERE code = _plan_code
  FOR SHARE;

  IF NOT FOUND
    OR NOT _plan.is_active
    OR _plan.amount_ars IS DISTINCT FROM _expected_amount_ars
    OR _plan.price_version IS DISTINCT FROM _expected_price_version
    OR _plan.updated_at IS DISTINCT FROM _expected_plan_updated_at THEN
    RAISE EXCEPTION 'CATALOG_CONFLICT' USING ERRCODE = '40001';
  END IF;

  IF NULLIF(_preapproval_id, '') IS NULL
    OR NULLIF(_external_reference, '') IS NULL
    OR NULLIF(_init_point, '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_CHECKOUT_REFERENCE' USING ERRCODE = '22023';
  END IF;

  IF _existing_subscription_id IS NULL THEN
    IF _preserve_current_provider THEN
      RAISE EXCEPTION 'INVALID_PRESERVE_STATE' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.organization_subscriptions (
      organization_id,
      provider,
      pending_plan_code,
      pending_checkout_amount_ars,
      pending_checkout_price_version,
      mercadopago_preapproval_id,
      mercadopago_external_reference,
      mercadopago_init_point,
      mercadopago_status,
      payer_email,
      metadata
    ) VALUES (
      _organization_id,
      'mercadopago',
      _plan.code,
      _plan.amount_ars,
      _plan.price_version,
      _preapproval_id,
      _external_reference,
      _init_point,
      _provider_status,
      _payer_email,
      COALESCE(_metadata, '{}'::jsonb)
    )
    RETURNING * INTO _subscription;
  ELSE
    UPDATE public.organization_subscriptions AS subscription
    SET
      provider = 'mercadopago',
      pending_plan_code = _plan.code,
      pending_checkout_amount_ars = _plan.amount_ars,
      pending_checkout_price_version = _plan.price_version,
      mercadopago_preapproval_id = CASE
        WHEN _preserve_current_provider THEN subscription.mercadopago_preapproval_id
        ELSE _preapproval_id
      END,
      mercadopago_external_reference = CASE
        WHEN _preserve_current_provider THEN subscription.mercadopago_external_reference
        ELSE _external_reference
      END,
      mercadopago_status = CASE
        WHEN _preserve_current_provider THEN subscription.mercadopago_status
        ELSE _provider_status
      END,
      mercadopago_init_point = _init_point,
      payer_email = _payer_email,
      metadata = COALESCE(_metadata, '{}'::jsonb)
    WHERE subscription.id = _existing_subscription_id
      AND subscription.organization_id = _organization_id
      AND subscription.updated_at IS NOT DISTINCT FROM _expected_subscription_updated_at
    RETURNING subscription.* INTO _subscription;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'SUBSCRIPTION_CONFLICT' USING ERRCODE = '40001';
    END IF;
  END IF;

  RETURN to_jsonb(_subscription);
END;
$function$;

-- Finalizes a scheduled downgrade under the same catalog-row lock used by
-- price batches. Mercado Pago is updated first; a stale catalog or subscription
-- snapshot makes this transaction fail so the Edge Function can compensate the
-- provider instead of committing an old amount/version locally.
CREATE OR REPLACE FUNCTION public.subscription_finalize_scheduled_plan_change(
  _organization_id uuid,
  _subscription_id uuid,
  _expected_subscription_updated_at timestamptz,
  _expected_preapproval_id text,
  _from_plan_code text,
  _to_plan_code text,
  _expected_amount_ars numeric,
  _expected_price_version integer,
  _expected_plan_updated_at timestamptz,
  _metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  _plan public.subscription_plans%ROWTYPE;
  _subscription public.organization_subscriptions%ROWTYPE;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'SUBSCRIPTION_SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _plan
  FROM public.subscription_plans
  WHERE code = _to_plan_code
  FOR SHARE;

  IF NOT FOUND
    OR NOT _plan.is_active
    OR _plan.amount_ars IS DISTINCT FROM _expected_amount_ars
    OR _plan.price_version IS DISTINCT FROM _expected_price_version
    OR _plan.updated_at IS DISTINCT FROM _expected_plan_updated_at THEN
    RAISE EXCEPTION 'CATALOG_CONFLICT' USING ERRCODE = '40001';
  END IF;

  SELECT * INTO _subscription
  FROM public.organization_subscriptions
  WHERE id = _subscription_id
    AND organization_id = _organization_id
  FOR UPDATE;

  IF NOT FOUND
    OR _subscription.status <> 'active'
    OR _subscription.provider <> 'mercadopago'
    OR NULLIF(_expected_preapproval_id, '') IS NULL
    OR _subscription.mercadopago_preapproval_id IS DISTINCT FROM _expected_preapproval_id
    OR _subscription.updated_at IS DISTINCT FROM _expected_subscription_updated_at
    OR COALESCE(
      _subscription.effective_plan_code,
      _subscription.current_plan_code,
      _subscription.billing_plan_code
    ) IS DISTINCT FROM _from_plan_code THEN
    RAISE EXCEPTION 'SUBSCRIPTION_CONFLICT' USING ERRCODE = '40001';
  END IF;

  UPDATE public.organization_subscriptions
  SET
    pending_plan_code = _plan.code,
    pending_checkout_amount_ars = NULL,
    pending_checkout_price_version = NULL,
    mercadopago_init_point = NULL,
    metadata = COALESCE(_metadata, '{}'::jsonb)
  WHERE id = _subscription.id
  RETURNING * INTO _subscription;

  RETURN to_jsonb(_subscription);
END;
$function$;

-- Reactivation is likewise serialized with catalog price changes. It only
-- restores immediate access for a cancelled subscription whose paid period is
-- still current; expired subscriptions must create a fresh checkout.
CREATE OR REPLACE FUNCTION public.subscription_finalize_reactivation(
  _organization_id uuid,
  _subscription_id uuid,
  _expected_subscription_updated_at timestamptz,
  _expected_preapproval_id text,
  _plan_code text,
  _expected_amount_ars numeric,
  _expected_price_version integer,
  _expected_plan_updated_at timestamptz,
  _metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  _plan public.subscription_plans%ROWTYPE;
  _subscription public.organization_subscriptions%ROWTYPE;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'SUBSCRIPTION_SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _plan
  FROM public.subscription_plans
  WHERE code = _plan_code
  FOR SHARE;

  IF NOT FOUND
    OR NOT _plan.is_active
    OR _plan.amount_ars IS DISTINCT FROM _expected_amount_ars
    OR _plan.price_version IS DISTINCT FROM _expected_price_version
    OR _plan.updated_at IS DISTINCT FROM _expected_plan_updated_at THEN
    RAISE EXCEPTION 'CATALOG_CONFLICT' USING ERRCODE = '40001';
  END IF;

  SELECT * INTO _subscription
  FROM public.organization_subscriptions
  WHERE id = _subscription_id
    AND organization_id = _organization_id
  FOR UPDATE;

  IF NOT FOUND
    OR _subscription.status <> 'cancelled'
    OR _subscription.provider <> 'mercadopago'
    OR NULLIF(_expected_preapproval_id, '') IS NULL
    OR _subscription.mercadopago_preapproval_id IS DISTINCT FROM _expected_preapproval_id
    OR _subscription.updated_at IS DISTINCT FROM _expected_subscription_updated_at
    OR _subscription.current_period_end IS NULL
    OR _subscription.current_period_end <= now()
    OR COALESCE(
      _subscription.current_plan_code,
      _subscription.billing_plan_code,
      _subscription.effective_plan_code
    ) IS DISTINCT FROM _plan.code THEN
    RAISE EXCEPTION 'SUBSCRIPTION_CONFLICT' USING ERRCODE = '40001';
  END IF;

  UPDATE public.organization_subscriptions
  SET
    status = 'active',
    cancel_at_period_end = false,
    cancelled_at = NULL,
    pending_plan_code = NULL,
    billing_plan_code = _plan.code,
    billing_amount_ars = _plan.amount_ars,
    billing_price_version = _plan.price_version,
    pending_checkout_amount_ars = NULL,
    pending_checkout_price_version = NULL,
    mercadopago_status = 'authorized',
    mercadopago_init_point = NULL,
    metadata = COALESCE(_metadata, '{}'::jsonb)
  WHERE id = _subscription.id
  RETURNING * INTO _subscription;

  RETURN to_jsonb(_subscription);
END;
$function$;

REVOKE ALL ON FUNCTION public.platform_admin_create_price_change_batch(
  text, numeric, numeric, integer, timestamptz, uuid, text, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_admin_claim_price_change_items(uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_admin_retry_price_change_items(uuid, uuid[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_admin_refresh_price_change_batch(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_admin_complete_price_change_item(
  uuid, uuid, text, timestamptz, integer, integer, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.subscription_finalize_checkout(
  uuid, text, numeric, integer, timestamptz, uuid, timestamptz,
  text, text, text, text, text, jsonb, boolean
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.subscription_finalize_scheduled_plan_change(
  uuid, uuid, timestamptz, text, text, text, numeric, integer, timestamptz, jsonb
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.subscription_finalize_reactivation(
  uuid, uuid, timestamptz, text, text, numeric, integer, timestamptz, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.platform_admin_create_price_change_batch(
  text, numeric, numeric, integer, timestamptz, uuid, text, uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_admin_claim_price_change_items(uuid, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_admin_retry_price_change_items(uuid, uuid[])
  TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_admin_refresh_price_change_batch(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_admin_complete_price_change_item(
  uuid, uuid, text, timestamptz, integer, integer, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.subscription_finalize_checkout(
  uuid, text, numeric, integer, timestamptz, uuid, timestamptz,
  text, text, text, text, text, jsonb, boolean
) TO service_role;
GRANT EXECUTE ON FUNCTION public.subscription_finalize_scheduled_plan_change(
  uuid, uuid, timestamptz, text, text, text, numeric, integer, timestamptz, jsonb
) TO service_role;
GRANT EXECUTE ON FUNCTION public.subscription_finalize_reactivation(
  uuid, uuid, timestamptz, text, text, numeric, integer, timestamptz, jsonb
) TO service_role;

-- Bootstrap through the exact same auditable work queue if an older deployment
-- still has Profesional at a different amount. This never overwrites the local
-- billing snapshots: each Mercado Pago preapproval remains pending until an
-- authenticated administrator enables the mutation kill switch and processes
-- this batch. On installations already at ARS 60,000 this block is a no-op.
SET LOCAL ROLE service_role;
DO $bootstrap$
DECLARE
  _plan public.subscription_plans%ROWTYPE;
  _batch jsonb;
BEGIN
  SELECT * INTO _plan
  FROM public.subscription_plans
  WHERE code = 'profesional';

  IF FOUND AND _plan.amount_ars IS DISTINCT FROM 60000 THEN
    _batch := public.platform_admin_create_price_change_batch(
      'profesional',
      60000,
      _plan.amount_ars,
      _plan.price_version,
      _plan.updated_at,
      NULL,
      'Alineacion inicial auditable del precio Profesional a ARS 60.000.',
      gen_random_uuid()
    );
    PERFORM public.platform_admin_refresh_price_change_batch((_batch->>'id')::uuid);
  END IF;
END;
$bootstrap$;
RESET ROLE;

-- SECURITY DEFINER EXCEPTION: this is the existing Auth trigger function. The
-- only new behavior is the first platform_role branch, which returns before any
-- tenant organization, branch, profile, role or trial is provisioned.
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
  IF COALESCE(NEW.raw_app_meta_data->>'platform_role', '') = 'platform_admin' THEN
    RETURN NEW;
  END IF;

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

-- price_monthly is retired only after application consumers are migrated to
-- subscription_plans.amount_ars in the same release.
ALTER TABLE public.plan_features DROP COLUMN IF EXISTS price_monthly;
