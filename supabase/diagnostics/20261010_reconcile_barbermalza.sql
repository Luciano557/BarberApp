-- One-off, explicitly authorized production exception; NOT a migration.
-- Project: azqpyfoobpovqosbayvz. Only BarberMalza and its Basic price batch.
-- Prerequisite: verify collector/application/reference and zero provider invoices,
-- cancel preapproval f30e86b1897d44b592026b8b6c52d008, then confirm cancellation
-- through GET /preapproval/{id}. Do NOT run while it is pending/authorized.
-- Preserve manual access, plans, periods, billing snapshots and payment history.
-- No new functions, grants, RLS, migrations or schema changes.
-- Executed after provider GET verified cancelled / zero invoices at
-- 2026-10-10T11:40:51.532Z (PUT 200, verification GET 200).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Validate/lock the existing shared admin before switching to service_role,
-- which intentionally has no SELECT permission on auth.users.
DO $actor_check$
BEGIN
  PERFORM 1 FROM auth.users
  WHERE id = 'dc4ef789-02c6-4109-a4b3-46e0c9a3276e'
    AND raw_app_meta_data->>'platform_role' = 'platform_admin'
    AND email_confirmed_at IS NOT NULL
    AND deleted_at IS NULL
    AND (banned_until IS NULL OR banned_until <= now())
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECONCILIATION_ACTOR_INVALID';
  END IF;
END;
$actor_check$;

SET LOCAL ROLE service_role;
DO $reconcile$
DECLARE
  _subscription public.organization_subscriptions%ROWTYPE;
  _batch public.subscription_price_change_batches%ROWTYPE;
  _item public.subscription_price_change_items%ROWTYPE;
  _catalog_before jsonb;
  _catalog_after jsonb;
  _refreshed jsonb;
  _request_id constant uuid := '40df75c2-2680-4b9c-8fb5-21f38a6be1bb';
BEGIN
  SELECT * INTO STRICT _batch FROM public.subscription_price_change_batches
  WHERE id = 'b0470a1f-8f6c-4b1e-95ea-aff6803a02dc' FOR UPDATE;
  SELECT * INTO STRICT _item FROM public.subscription_price_change_items
  WHERE id = '90f9f1ca-d191-4c1c-a180-6ddd2770bde9' FOR UPDATE;
  SELECT * INTO STRICT _subscription FROM public.organization_subscriptions
  WHERE id = 'b7948334-db00-47e3-bdb6-e235a0715740'
    AND organization_id = '282a4316-f001-4b29-ad57-7fc0b5b6358b'
  FOR UPDATE;

  -- A second invocation cannot duplicate the correction or its audit.
  IF EXISTS (SELECT 1 FROM public.platform_admin_audit_log
             WHERE request_id = _request_id
               AND action = 'subscription.provider_reconciled') THEN
    IF _subscription.provider = 'manual'
       AND _subscription.mercadopago_preapproval_id IS NULL
       AND _batch.status = 'completed'
       AND _item.status = 'skipped' THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'RECONCILIATION_ALREADY_RECORDED_STATE_CHANGED';
  END IF;

  IF _batch.plan_code IS DISTINCT FROM 'basico'
     OR _batch.status IS DISTINCT FROM 'partially_completed'
     OR _batch.total_items <> 27 OR _batch.failed_items <> 1
     OR _batch.skipped_items <> 26
     OR _item.batch_id IS DISTINCT FROM _batch.id
     OR _item.organization_id IS DISTINCT FROM _subscription.organization_id
     OR _item.subscription_id IS DISTINCT FROM _subscription.id
     OR _item.item_type IS DISTINCT FROM 'active_renewal'
     OR _item.status IS DISTINCT FROM 'failed'
     OR _item.error_code IS DISTINCT FROM 'provider_not_active'
     OR _item.preapproval_id IS DISTINCT FROM 'f30e86b1897d44b592026b8b6c52d008'
     OR _item.requires_compensation IS DISTINCT FROM false
     OR _item.provider_mutation_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'RECONCILIATION_BATCH_CONFLICT';
  END IF;

  IF _subscription.updated_at IS DISTINCT FROM '2026-09-08T05:30:10.380602Z'::timestamptz
     OR _subscription.provider IS DISTINCT FROM 'mercadopago'
     OR _subscription.status IS DISTINCT FROM 'active'
     OR _subscription.current_plan_code IS DISTINCT FROM 'basico'
     OR _subscription.billing_plan_code IS DISTINCT FROM 'basico'
     OR _subscription.effective_plan_code IS DISTINCT FROM 'basico'
     OR _subscription.current_period_end IS NOT NULL
     OR _subscription.pending_plan_code IS NOT NULL
     OR _subscription.pending_checkout_amount_ars IS NOT NULL
     OR _subscription.pending_checkout_price_version IS NOT NULL
     OR _subscription.cancel_at_period_end IS DISTINCT FROM false
     OR _subscription.mercadopago_preapproval_id IS DISTINCT FROM 'f30e86b1897d44b592026b8b6c52d008'
     OR _subscription.mercadopago_status IS DISTINCT FROM 'pending'
     OR _subscription.mercadopago_external_reference IS DISTINCT FROM
       'sub_282a4316-f001-4b29-ad57-7fc0b5b6358b_profesional_4bff887b-2936-4311-9f91-0a94783191d6'
     OR _subscription.metadata->>'manual_reason' IS DISTINCT FROM 'sin_vencimiento'
     OR _subscription.metadata->>'manual_plan_change' IS DISTINCT FROM 'true'
     OR EXISTS (SELECT 1 FROM public.subscription_payments
                WHERE organization_id = _subscription.organization_id) THEN
    RAISE EXCEPTION 'RECONCILIATION_SUBSCRIPTION_CONFLICT';
  END IF;

  SELECT jsonb_agg(jsonb_build_object('code', code, 'amount', amount_ars,
                                     'version', price_version, 'updatedAt', updated_at)
                   ORDER BY code)
  INTO _catalog_before FROM public.subscription_plans;

  UPDATE public.organization_subscriptions
  SET provider = 'manual', mercadopago_preapproval_id = NULL,
      mercadopago_external_reference = NULL, mercadopago_status = NULL,
      mercadopago_init_point = NULL, next_payment_date = NULL
  WHERE id = _subscription.id AND organization_id = _subscription.organization_id
    AND updated_at = _subscription.updated_at;
  IF NOT FOUND THEN RAISE EXCEPTION 'RECONCILIATION_SUBSCRIPTION_CONFLICT'; END IF;

  INSERT INTO public.platform_admin_audit_log
    (actor_user_id, actor_alias, action, target_type, target_id, reason,
     previous_state, next_state, result_status, result_detail, request_id)
  VALUES
    ('dc4ef789-02c6-4109-a4b3-46e0c9a3276e', 'admin',
     'subscription.provider_reconciled', 'organization_subscription', _subscription.id,
     'Excepcion directa autorizada por el operador: conservar Basico manual sin vencimiento y desvincular checkout obsoleto de Premium, cancelado y sin facturas en Mercado Pago.',
     jsonb_build_object('provider', _subscription.provider, 'status', _subscription.status,
                        'planCode', _subscription.effective_plan_code,
                        'preapprovalId', _subscription.mercadopago_preapproval_id,
                        'providerStatus', _subscription.mercadopago_status,
                        'amountArs', _subscription.billing_amount_ars,
                        'priceVersion', _subscription.billing_price_version,
                        'updatedAt', _subscription.updated_at),
     jsonb_build_object('provider', 'manual', 'status', 'active', 'planCode', 'basico',
                        'preapprovalId', NULL, 'providerStatus', NULL,
                        'amountArs', _subscription.billing_amount_ars,
                        'priceVersion', _subscription.billing_price_version,
                        'currentPeriodEnd', NULL),
     'succeeded',
     jsonb_build_object('executionChannel', 'operator_authorized_sql',
                        'providerVerifiedStatus', 'cancelled', 'providerInvoiceCount', 0,
                        'providerVerifiedAt', '2026-10-10T11:40:51.532Z',
                        'collectorId', '265810177', 'applicationId', '3847322984949546',
                        'batchId', _batch.id), _request_id);

  -- Use the deployed canonical RPCs, never force a completed batch manually.
  PERFORM public.platform_admin_retry_price_change_items(_batch.id, ARRAY[_item.id]);
  _refreshed := public.platform_admin_refresh_price_change_batch(_batch.id);
  IF _refreshed->>'status' IS DISTINCT FROM 'completed'
     OR (_refreshed->>'failed_items')::integer <> 0
     OR (_refreshed->>'skipped_items')::integer <> 27 THEN
    RAISE EXCEPTION 'RECONCILIATION_BATCH_NOT_TERMINAL';
  END IF;

  INSERT INTO public.platform_admin_audit_log
    (actor_user_id, actor_alias, action, target_type, target_id, reason,
     previous_state, next_state, result_status, result_detail, request_id)
  VALUES
    ('dc4ef789-02c6-4109-a4b3-46e0c9a3276e', 'admin',
     'subscription_price_change.reconciled', 'subscription_price_change_batch', _batch.id,
     'Reintento acotado al unico fallo despues de reconciliar proveedor manual; exclusion canonica, sin modificar precios ni registrar cobros.',
     jsonb_build_object('batchId', _batch.id, 'total', 27, 'failed', 1, 'skipped', 26),
     jsonb_build_object('batchId', _batch.id, 'total', 27, 'failed', 0, 'skipped', 27),
     'succeeded', jsonb_build_object('itemId', _item.id, 'errorCode', 'subscription_changed'),
     _request_id);

  SELECT jsonb_agg(jsonb_build_object('code', code, 'amount', amount_ars,
                                     'version', price_version, 'updatedAt', updated_at)
                   ORDER BY code)
  INTO _catalog_after FROM public.subscription_plans;
  IF _catalog_after IS DISTINCT FROM _catalog_before THEN
    RAISE EXCEPTION 'RECONCILIATION_CATALOG_CHANGED';
  END IF;
END;
$reconcile$;
COMMIT;

SELECT jsonb_build_object(
  'subscription', (SELECT jsonb_build_object('id', id, 'provider', provider, 'status', status,
      'planCode', effective_plan_code, 'currentPeriodEnd', current_period_end,
      'hasPreapproval', mercadopago_preapproval_id IS NOT NULL, 'updatedAt', updated_at)
    FROM public.organization_subscriptions WHERE id = 'b7948334-db00-47e3-bdb6-e235a0715740'),
  'batch', (SELECT jsonb_build_object('status', status, 'total', total_items,
      'failed', failed_items, 'skipped', skipped_items)
    FROM public.subscription_price_change_batches WHERE id = 'b0470a1f-8f6c-4b1e-95ea-aff6803a02dc'),
  'item', (SELECT jsonb_build_object('status', status, 'errorCode', error_code)
    FROM public.subscription_price_change_items WHERE id = '90f9f1ca-d191-4c1c-a180-6ddd2770bde9'),
  'auditEntries', (SELECT count(*) FROM public.platform_admin_audit_log
    WHERE request_id = '40df75c2-2680-4b9c-8fb5-21f38a6be1bb')
) AS verification;
