-- One-off reconciliation explicitly authorized on 2026-10-11.
-- NOT a migration. Writes exactly one failed audit receipt, never tenant data.
-- Run only with commercial mutations paused; abort if any evidence changed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '20s';
DO $reconcile$
DECLARE
  _org public.organizations%ROWTYPE;
  _sub public.organization_subscriptions%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('8947710e-47e3-47c4-85a9-cfc086e47c29', 0));
  IF EXISTS (SELECT 1 FROM public.platform_admin_audit_log
    WHERE request_id = '8947710e-47e3-47c4-85a9-cfc086e47c29') THEN
    RAISE EXCEPTION 'REQUEST_ALREADY_RECORDED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users
    WHERE id = 'dc4ef789-02c6-4109-a4b3-46e0c9a3276e'
      AND raw_app_meta_data->>'platform_role' = 'platform_admin'
      AND email_confirmed_at IS NOT NULL
      AND (banned_until IS NULL OR banned_until <= now())) THEN
    RAISE EXCEPTION 'PLATFORM_ACTOR_CHANGED';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid <> pg_backend_pid()
    AND state = 'active' AND query ILIKE '%platform_admin_manage_organization%') THEN
    RAISE EXCEPTION 'COMMERCIAL_BACKEND_STILL_ACTIVE';
  END IF;
  SELECT * INTO _sub FROM public.organization_subscriptions
    WHERE organization_id = '60c0dedd-2bf6-4d3b-b989-2387a7dece49' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUBSCRIPTION_MISSING'; END IF;
  SELECT * INTO _org FROM public.organizations
    WHERE id = '60c0dedd-2bf6-4d3b-b989-2387a7dece49' FOR SHARE;
  IF NOT FOUND OR _org.updated_at IS DISTINCT FROM '2026-10-10T16:54:49.00842Z'::timestamptz
    OR _sub.updated_at IS DISTINCT FROM '2026-10-10T14:13:45.64908Z'::timestamptz
    OR _sub.trial_ends_at IS DISTINCT FROM '2026-10-25T14:12:39.02Z'::timestamptz
    OR _sub.current_period_end IS DISTINCT FROM _sub.trial_ends_at
    OR _sub.status <> 'trialing' OR _sub.current_plan_code IS NOT NULL
    OR _sub.last_payment_at IS NOT NULL
    OR nullif(_sub.mercadopago_preapproval_id, '') IS NOT NULL
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
    OR EXISTS (SELECT 1 FROM public.subscription_payments
      WHERE organization_id = _org.id AND status = 'approved') THEN
    RAISE EXCEPTION 'INCIDENT_EVIDENCE_CHANGED';
  END IF;
  INSERT INTO public.platform_admin_audit_log
    (actor_user_id, actor_alias, action, target_type, target_id, reason,
     result_status, result_detail, request_id)
  VALUES ('dc4ef789-02c6-4109-a4b3-46e0c9a3276e', 'admin',
    'organization.trial_extended', 'organization', _org.id::text,
    'Reconciliación autorizada del rechazo del 11/10/2026; no se modificó el trial.',
    'failed', jsonb_build_object('errorCode', 'TRIAL_EXTENSION_NOT_ALLOWED',
      'inputFingerprint', 'legacy_reconciled_failure', 'reconciled', true,
      'reconciliationSource', 'postgres_logs_read_only_20261011'),
    '8947710e-47e3-47c4-85a9-cfc086e47c29');
END;
$reconcile$;
COMMIT;
SELECT id, request_id, action, result_status,
  result_detail->>'errorCode' AS error_code, created_at
FROM public.platform_admin_audit_log
WHERE request_id = '8947710e-47e3-47c4-85a9-cfc086e47c29';
