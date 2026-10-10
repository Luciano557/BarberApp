import { commercialEligibility, parseCommercialMutation, type CommercialSubscription } from '../functions/_shared/admin-organization-domain.ts';
import { createCommercialHandler, type CommercialHandlerDependencies } from '../functions/_shared/admin-organization-handler.ts';

function assert(value: unknown, message = 'Assertion failed'): asserts value { if (!value) throw new Error(message); }
function rejects(task: () => unknown) { let failed = false; try { task(); } catch { failed = true; } assert(failed, 'Expected rejection'); }
const org = '11111111-1111-4111-8111-111111111111';
const key = '33333333-3333-4333-8333-333333333333';
const revision = '2026-09-08T05:30:10.380602+00:00';
const input = () => ({ action: 'update_details', organizationId: org,
  expectedOrganizationUpdatedAt: revision, expectedSubscriptionUpdatedAt: revision,
  changes: { name: '  Barbería ejemplo  ', phone: null, address: null, contactEmail: ' CONTACTO@EXAMPLE.COM ' },
  reason: 'Actualizar contacto comercial', password: 'synthetic-test-only' });
const trial = (): CommercialSubscription => ({ provider: 'mercadopago', status: 'trialing',
  current_plan_code: null, effective_plan_code: 'premium', current_period_start: null,
  current_period_end: null, trial_started_at: '2026-09-01T00:00:00Z', trial_ends_at: revision, last_payment_at: null,
  pending_plan_code: null, pending_checkout_amount_ars: null, pending_checkout_price_version: null,
  mercadopago_preapproval_id: null, mercadopago_external_reference: null, mercadopago_status: null,
  mercadopago_init_point: null, metadata: {} });

export function registerCommercialTests(test: (name: string, task: () => void | Promise<void>) => void) {
  test('commercial: sanitizes details and preserves CAS microseconds', () => {
    const result = parseCommercialMutation(input());
    assert(result.expectedSubscriptionUpdatedAt === revision);
    assert('name' in result.changes && result.changes.name === 'Barbería ejemplo');
    assert('contactEmail' in result.changes && result.changes.contactEmail === 'contacto@example.com');
  });
  test('commercial: rejects arbitrary metadata, roles, slug and unknown actions', () => {
    for (const extra of [{ metadata: {} }, { platform_role: 'platform_admin' }, { slug: 'new' }]) rejects(() => parseCommercialMutation({ ...input(), changes: { ...input().changes, ...extra } }));
    rejects(() => parseCommercialMutation({ ...input(), action: 'delete_user' }));
    rejects(() => parseCommercialMutation({ ...input(), token: 'not-allowed' }));
  });
  test('commercial: validates lengths, nulls, UUID, email and reason', () => {
    for (const changes of [{ ...input().changes, name: 'x'.repeat(121) }, { ...input().changes, name: '  ' },
      { ...input().changes, contactEmail: 'invalid' }, { ...input().changes, phone: 'x'.repeat(41) },
      { ...input().changes, address: 'x'.repeat(301) }, { ...input().changes, name: 'bad\nname' }]) rejects(() => parseCommercialMutation({ ...input(), changes }));
    rejects(() => parseCommercialMutation({ ...input(), organizationId: 'not-an-id' }));
    rejects(() => parseCommercialMutation({ ...input(), reason: 'short' }));
    rejects(() => parseCommercialMutation({ ...input(), password: '' }));
    rejects(() => parseCommercialMutation({ ...input(), expectedOrganizationUpdatedAt: 'tomorrow' }));
  });
  test('commercial: manual grant requires a real plan and future deadline or explicit null', () => {
    const base = { ...input(), action: 'assign_manual_plan', changes: { planCode: 'basico', endsAt: null } };
    assert('planCode' in parseCommercialMutation(base).changes);
    rejects(() => parseCommercialMutation({ ...base, changes: { planCode: 'invalid', endsAt: null } }));
    rejects(() => parseCommercialMutation({ ...base, changes: { planCode: 'basico' } }));
    rejects(() => parseCommercialMutation({ ...base, changes: { planCode: 'basico', endsAt: '2020-01-01T00:00:00Z' } }));
    rejects(() => parseCommercialMutation({ ...base, action: 'extend_trial', changes: { endsAt: null } }));
  });
  test('commercial: legacy and clean manual subscriptions can receive a manual plan', () => {
    assert(commercialEligibility(null, false, false).canAssignManualPlan);
    assert(commercialEligibility({ ...trial(), status: 'active', provider: 'manual', current_plan_code: 'basico' }, false, false).canAssignManualPlan);
    assert(!commercialEligibility({ ...trial(), status: 'active', provider: 'manual' }, false, false).canExtendTrial);
  });
  test('commercial: blocks every provider link, checkout and unresolved provider fence', () => {
    for (const change of [{ mercadopago_preapproval_id: 'ref' }, { mercadopago_external_reference: 'ref' },
      { mercadopago_status: 'cancelled' }, { mercadopago_init_point: 'link' }, { pending_plan_code: 'premium' },
      { pending_checkout_amount_ars: 20000 }, { pending_checkout_price_version: 1 },
      { metadata: { pending_mercadopago_preapproval_id: 'ref' } }, { metadata: { previous_mercadopago_preapproval_id: 'ref' } }]) {
      const result = commercialEligibility({ ...trial(), ...change }, false, false);
      assert(!result.canAssignManualPlan && !result.canExtendTrial && result.blockCode === 'PROVIDER_RECONCILIATION_REQUIRED');
    }
    assert(commercialEligibility(trial(), true, false).blockCode === 'OPERATION_IN_PROGRESS');
  });
  test('commercial: trial extension never replaces paid or manual access', () => {
    assert(commercialEligibility(trial(), false, false).canExtendTrial);
    assert(commercialEligibility({ ...trial(), status: 'expired' }, false, false).canExtendTrial);
    for (const change of [{ status: 'active' }, { current_plan_code: 'basico' },
      { current_period_start: revision }, { current_period_end: '2026-09-09T00:00:00Z' }, { last_payment_at: revision }]) {
      assert(!commercialEligibility({ ...trial(), ...change }, false, false).canExtendTrial);
    }
    assert(!commercialEligibility(trial(), false, true).canExtendTrial);
  });
  test('commercial: recognizes provisioned trial periods, not arbitrary paid periods', () => {
    const provisioned = { ...trial(), current_period_start: trial().trial_started_at, current_period_end: revision };
    assert(commercialEligibility(provisioned, false, false).canExtendTrial);
    assert(!commercialEligibility({ ...provisioned, last_payment_at: revision }, false, false).canExtendTrial);
    assert(!commercialEligibility({ ...provisioned, metadata: { previous_mercadopago_external_reference: 'ref' } }, false, false).canExtendTrial);
  });

  function harness(options: { authStatus?: number; enabled?: boolean; reauth?: boolean; fail?: boolean } = {}) {
    const calls = { authorize: 0, reauth: 0, writes: 0, reads: 0 };
    const deps: CommercialHandlerDependencies = {
      enabled: () => options.enabled !== false,
      requestId: req => req.headers.get('x-request-id') ?? key,
      reply: (_req, body, status) => new Response(status === 204 ? null : JSON.stringify(body), { status }),
      authorize: async () => {
        calls.authorize++;
        if (options.authStatus) return new Response(null, { status: options.authStatus });
        return { reauthenticate: async () => { calls.reauth++; return options.reauth !== false; },
          mutate: async (_input, requestId) => { calls.writes++; if (options.fail) throw new Error('secret provider payload should never appear'); return { organizationId: org, requestId, replayed: false }; },
          status: async (_id, requestId) => { calls.reads++; return { organizationId: org, requestId, status: 'not_found' }; } };
      },
    };
    return { handler: createCommercialHandler(deps), calls };
  }
  const request = (body: unknown = input(), id: string | null = key) => new Request('https://example.test/admin', {
    method: 'POST', headers: id ? { 'x-request-id': id } : {}, body: JSON.stringify(body) });
  test('commercial: unauthorized/tenant callers cannot read bodies or mutate', async () => {
    for (const status of [401, 403]) {
      const h = harness({ authStatus: status }); const req = request();
      assert((await h.handler(req)).status === status && !req.bodyUsed);
      assert(h.calls.reauth === 0 && h.calls.writes === 0 && h.calls.reads === 0);
    }
  });
  test('commercial: kill switch blocks writes before reauthentication', async () => {
    const h = harness({ enabled: false }); assert((await h.handler(request())).status === 503);
    assert(h.calls.reauth === 0 && h.calls.writes === 0);
  });
  test('commercial: request key and valid input are mandatory', async () => {
    const h = harness(); assert((await h.handler(request(input(), null))).status === 400);
    assert((await h.handler(request({ ...input(), action: 'delete_user' }))).status === 400);
    assert(h.calls.writes === 0 && h.calls.reauth === 0);
  });
  test('commercial: wrong confirmation password cannot write', async () => {
    const h = harness({ reauth: false }); const response = await h.handler(request());
    assert(response.status === 403 && h.calls.writes === 0);
    assert((await response.json()).code === 'REAUTHENTICATION_FAILED');
  });
  test('commercial: valid write sends stable key and never echoes password', async () => {
    const h = harness(); const response = await h.handler(request()); const result = await response.text();
    assert(response.status === 200 && h.calls.writes === 1 && h.calls.reauth === 1);
    assert(result.includes(key) && !result.includes(input().password));
  });
  test('commercial: read-only recovery works when writes are disabled', async () => {
    const h = harness({ enabled: false });
    assert((await h.handler(request({ action: 'status', organizationId: org, operationRequestId: key }))).status === 200);
    assert(h.calls.reads === 1 && h.calls.writes === 0 && h.calls.reauth === 0);
    assert((await h.handler(request({ action: 'status', organizationId: 'invalid', operationRequestId: key }))).status === 400);
  });
  test('commercial: ambiguous error is sanitized and never automatically retried', async () => {
    const h = harness({ fail: true }); const response = await h.handler(request());
    assert(response.status === 500 && h.calls.writes === 1);
    assert(!(await response.text()).includes('secret provider payload'));
  });
  test('commercial: body size, JSON and HTTP method are bounded', async () => {
    const h = harness();
    assert((await h.handler(new Request('https://example.test', { method: 'GET' }))).status === 405);
    assert((await h.handler(new Request('https://example.test', { method: 'OPTIONS' }))).status === 204);
    assert((await h.handler(new Request('https://example.test', { method: 'POST', body: '{' }))).status === 400);
    assert((await h.handler(new Request('https://example.test', { method: 'POST', body: 'x'.repeat(8193) }))).status === 413);
    assert(h.calls.writes === 0);
  });
}
