// Local PostgreSQL/WASM only. No URLs, credentials or production data.
// Install the isolated test dependency as documented in PLAN_ADMIN_GESTION_COMERCIAL.md.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(pathToFileURL(resolve('node_modules/.admin-sql-test/node_modules/@electric-sql/pglite/dist/index.js')).href);
const db = await PGlite.create();
const foundation = await readFile('supabase/migrations/20260624120000_subscription_billing_foundation.sql', 'utf8');
const admin = await readFile('supabase/migrations/20260904153000_platform_admin_center.sql', 'utf8');
const migration = await readFile('supabase/migrations/20261010130000_platform_admin_commercial.sql', 'utf8');
function table(source, name) {
  const result = source.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${name} \\([\\s\\S]*?\\n\\);`));
  assert(result, `Missing real schema: ${name}`);
  return result[0];
}
function triggerFunction(name) {
  const result = foundation.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$function\\$;`));
  assert(result, `Missing existing trigger: ${name}`);
  return result[0];
}
const actor = randomUUID();
let passed = 0;
async function test(name, work) { await work(); passed++; console.log(`ok ${passed} - ${name}`); }
async function seed(overrides = null) {
  const id = randomUUID();
  await db.query(`INSERT INTO organizations (id,name,slug,updated_at) VALUES ($1::uuid,'Fixture','fixture-'||$1::text,$2)`, [id, '2026-09-01T00:00:00.380602Z']);
  if (overrides) {
    const cols = ['organization_id', ...Object.keys(overrides)];
    await db.query(`INSERT INTO organization_subscriptions (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`, [id, ...Object.values(overrides)]);
  }
  return id;
}
async function revisions(id) {
  const { rows } = await db.query(`SELECT o.updated_at::text AS org, s.updated_at::text AS sub FROM organizations o LEFT JOIN organization_subscriptions s ON s.organization_id=o.id WHERE o.id=$1`, [id]);
  return rows[0];
}
async function command(id, action, changes) {
  return { id, action, changes, revision: await revisions(id), request: randomUUID(), actor };
}
async function mutate(input, role = 'service_role') {
  assert(['service_role', 'anon', 'authenticated'].includes(role));
  return db.transaction(async tx => {
    await tx.exec(`SET LOCAL ROLE ${role}`);
    const { rows } = await tx.query(`SELECT public.platform_admin_manage_organization($1,$2,$3,$4,$5::jsonb,$6,$7::timestamptz,$8::timestamptz) AS result`, [input.id, input.actor, input.request, input.action, JSON.stringify(input.changes), 'Motivo comercial sintético', input.revision.org, input.revision.sub]);
    return rows[0].result;
  });
}
async function failure(input, message, role = 'service_role') {
  await assert.rejects(mutate(input, role), err => err.message.includes(message));
  const { rows } = await db.query('SELECT count(*)::integer AS n FROM platform_admin_audit_log WHERE request_id=$1', [input.request]);
  assert.equal(rows[0].n, 0);
}
async function subscription(id) { return (await db.query('SELECT to_jsonb(s) AS data FROM organization_subscriptions s WHERE organization_id=$1', [id])).rows[0]?.data; }
const future = '2099-01-01T00:00:00Z';
const trial = { status: 'expired', current_plan_code: null, trial_started_at: '2026-01-01T00:00:00Z', trial_ends_at: '2026-01-16T00:00:00Z', current_period_start: '2026-01-01T00:00:00Z', current_period_end: '2026-01-16T00:00:00Z' };

try {
  await db.exec(`
    SET TIME ZONE 'UTC';
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE TABLE public.organizations (id uuid PRIMARY KEY, name text NOT NULL, slug text UNIQUE,
      phone text, address text, is_active boolean NOT NULL DEFAULT true,
      plan text DEFAULT 'premium', plan_expires_at timestamptz,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    ${table(foundation, 'subscription_plans')}
    ${table(foundation, 'organization_subscriptions')}
    ${table(foundation, 'subscription_payments')}
    ${table(admin, 'platform_admin_audit_log')}
    CREATE UNIQUE INDEX audit_request_action ON platform_admin_audit_log(request_id,action);
    ALTER TABLE subscription_plans ADD price_version integer NOT NULL DEFAULT 1;
    ALTER TABLE organization_subscriptions ADD billing_amount_ars numeric(12,2),
      ADD billing_price_version integer, ADD pending_checkout_amount_ars numeric(12,2), ADD pending_checkout_price_version integer;
    CREATE TABLE subscription_price_change_items(id uuid DEFAULT gen_random_uuid(), subscription_id uuid,
      status text, requires_compensation boolean NOT NULL DEFAULT false);
    ${triggerFunction('touch_subscription_updated_at')}
    ${triggerFunction('sync_organization_subscription_projection')}
    CREATE TRIGGER subscription_touch BEFORE UPDATE ON organization_subscriptions
      FOR EACH ROW EXECUTE FUNCTION touch_subscription_updated_at();
    CREATE TRIGGER projection AFTER INSERT OR UPDATE OF status,effective_plan_code,trial_ends_at,current_period_end
      ON organization_subscriptions FOR EACH ROW EXECUTE FUNCTION sync_organization_subscription_projection();
    GRANT USAGE ON SCHEMA public TO service_role,anon,authenticated;
    GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
    INSERT INTO subscription_plans(code,name,amount_ars,sort_order) VALUES
      ('basico','Básico',20000,1),('profesional','Profesional',30000,2),('premium','Premium',50000,3);
  `);
  await db.query('INSERT INTO auth.users(id) VALUES ($1)', [actor]);
  await db.transaction(tx => tx.exec(migration));
  await test('migration is invoker, contacts have RLS and zero tenant policies', async () => {
    const { rows } = await db.query(`SELECT p.prosecdef FROM pg_proc p WHERE p.proname='platform_admin_manage_organization'`);
    assert.equal(rows[0].prosecdef, false);
    assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='platform_admin_organization_contacts'`)).rows[0].relrowsecurity, true);
    assert.equal((await db.query(`SELECT count(*)::integer n FROM pg_policies WHERE tablename='platform_admin_organization_contacts'`)).rows[0].n, 0);
  });
  await test('details/contact are atomic, scoped and do not change slug, Auth or subscription', async () => {
    const id = await seed({ provider: 'manual', status: 'active', current_plan_code: 'basico', effective_plan_code: 'basico' });
    const other = await seed(); const original = await subscription(id);
    await mutate(await command(id, 'update_details', { name: ' Nuevo nombre ', phone: '123', address: 'Dirección', contactEmail: ' COMMERCIAL@EXAMPLE.COM ' }));
    const row = (await db.query('SELECT * FROM organizations WHERE id=$1', [id])).rows[0];
    assert.equal(row.name, 'Nuevo nombre'); assert.equal(row.slug, `fixture-${id}`);
    assert.equal((await db.query('SELECT email FROM platform_admin_organization_contacts WHERE organization_id=$1', [id])).rows[0].email, 'commercial@example.com');
    assert.deepEqual(await subscription(id), original);
    assert.equal((await db.query('SELECT name FROM organizations WHERE id=$1', [other])).rows[0].name, 'Fixture');
    assert.equal((await db.query('SELECT count(*)::integer n FROM auth.users')).rows[0].n, 1);
  });
  await test('manual grant creates missing subscription and aligns tenant projection without a payment', async () => {
    const id = await seed(); await mutate(await command(id, 'assign_manual_plan', { planCode: 'profesional', endsAt: future }));
    const sub = await subscription(id); assert.equal(sub.provider, 'manual'); assert.equal(sub.current_plan_code, 'profesional');
    const org = (await db.query(`SELECT plan,plan_expires_at::text expiry FROM organizations WHERE id=$1`, [id])).rows[0];
    assert.equal(org.plan, 'profesional'); assert(org.expiry.startsWith('2099-01-01'), `Unexpected expiry: ${org.expiry}; sub: ${JSON.stringify(sub)}`);
    assert.equal((await db.query('SELECT count(*)::integer n FROM subscription_payments')).rows[0].n, 0);
    assert.equal((await db.query('SELECT amount_ars::text amount,price_version FROM subscription_plans WHERE code=$1', ['profesional'])).rows[0].amount, '30000.00');
  });
  await test('indefinite manual grant clears current billing snapshot but preserves it in audit', async () => {
    const id = await seed({ provider: 'manual', status: 'active', current_plan_code: 'basico', effective_plan_code: 'basico', billing_plan_code: 'basico', billing_amount_ars: 30000, billing_price_version: 1, last_payment_at: '2025-01-01T00:00:00Z', metadata: { preserved: 'fixture' } });
    const input = await command(id, 'assign_manual_plan', { planCode: 'premium', endsAt: null }); await mutate(input);
    const sub = await subscription(id);
    assert.equal(sub.current_period_end, null); assert.equal(sub.billing_plan_code, null); assert.equal(sub.billing_amount_ars, null);
    assert.equal(sub.billing_price_version, null); assert(sub.last_payment_at.startsWith('2025-01-01')); assert.equal(sub.metadata.preserved, 'fixture');
    const audit = (await db.query('SELECT previous_state FROM platform_admin_audit_log WHERE request_id=$1', [input.request])).rows[0].previous_state;
    assert.equal(audit.billingAmountArs, 30000); assert.equal(audit.billingPriceVersion, 1); assert.equal(audit.billingPlanCode, 'basico');
  });
  await test('same request is a no-op replay despite old CAS; changed payload/key is refused', async () => {
    const id = await seed(); const input = await command(id, 'assign_manual_plan', { planCode: 'basico', endsAt: null });
    assert.equal((await mutate(input)).replayed, false); const original = await subscription(id);
    assert.equal((await mutate(input)).replayed, true); assert.deepEqual(await subscription(id), original);
    assert.equal((await db.query('SELECT count(*)::integer n FROM platform_admin_audit_log WHERE request_id=$1', [input.request])).rows[0].n, 1);
    await assert.rejects(mutate({ ...input, changes: { planCode: 'premium', endsAt: null } }), /COMMERCIAL_REQUEST_CONFLICT/);
  });
  await test('org/sub CAS rejects stale timestamps, including microsecond differences', async () => {
    const id = await seed({ ...trial }); const input = await command(id, 'extend_trial', { endsAt: future });
    await failure({ ...input, revision: { ...input.revision, org: '2026-09-01T00:00:00.380000Z' } }, 'COMMERCIAL_CONFLICT');
    await failure({ ...input, request: randomUUID(), revision: { ...input.revision, sub: null } }, 'COMMERCIAL_CONFLICT');
  });
  await test('expired provisioned trial extends and keeps the mirrored period/end projection consistent', async () => {
    const id = await seed({ ...trial }); await mutate(await command(id, 'extend_trial', { endsAt: future }));
    const sub = await subscription(id); assert.equal(sub.status, 'trialing'); assert.equal(sub.current_plan_code, null);
    assert(sub.trial_ends_at.startsWith('2099-01-01')); assert.equal(sub.current_period_end, sub.trial_ends_at);
    assert.equal((await db.query(`SELECT plan_expires_at::text expiry FROM organizations WHERE id=$1`, [id])).rows[0].expiry.startsWith('2099-01-01'), true);
  });
  await test('unmirrored trial accepts extension but keeps nullable periods nullable', async () => {
    const id = await seed({ ...trial, current_period_start: null, current_period_end: null });
    await mutate(await command(id, 'extend_trial', { endsAt: future })); assert.equal((await subscription(id)).current_period_end, null);
  });
  await test('trial cannot shorten or replace paid/manual access or an approved payment', async () => {
    for (const overrides of [{ status: 'active' }, { current_plan_code: 'basico' }, { last_payment_at: '2026-01-02T00:00:00Z' }, { current_period_end: future }]) {
      const id = await seed({ ...trial, ...overrides }); await failure(await command(id, 'extend_trial', { endsAt: future }), 'TRIAL_EXTENSION_NOT_ALLOWED');
    }
    const id = await seed({ ...trial, trial_ends_at: future, current_period_end: future });
    await failure(await command(id, 'extend_trial', { endsAt: '2098-01-01T00:00:00Z' }), 'TRIAL_EXTENSION_NOT_ALLOWED');
    const paid = await seed({ ...trial }); await db.query(`INSERT INTO subscription_payments(organization_id,status,amount_ars) VALUES ($1,'approved',1)`, [paid]);
    await failure(await command(paid, 'extend_trial', { endsAt: future }), 'TRIAL_EXTENSION_NOT_ALLOWED');
  });
  await test('every provider/checkout/previous-reference marker blocks manual grant and trial', async () => {
    for (const link of [{ mercadopago_preapproval_id: 'fixture-provider' }, { mercadopago_external_reference: 'fixture-reference' }, { mercadopago_status: 'cancelled' }, { mercadopago_init_point: 'fixture-link' }, { pending_plan_code: 'basico' }, { pending_checkout_amount_ars: 1 }, { pending_checkout_price_version: 1 }, { metadata: { previous_mercadopago_external_reference: 'fixture-ref' } }, { metadata: { pending_mercadopago_preapproval_id: 'fixture-ref' } }]) {
      const id = await seed({ ...trial, ...link });
      await failure(await command(id, 'assign_manual_plan', { planCode: 'basico', endsAt: null }), 'PROVIDER_RECONCILIATION_REQUIRED');
      await failure(await command(id, 'extend_trial', { endsAt: future }), 'PROVIDER_RECONCILIATION_REQUIRED');
    }
  });
  await test('worker pending/processing and compensation fences block access mutations', async () => {
    for (const [status, fence] of [['pending', false], ['processing', false], ['failed', true]]) {
      const id = await seed({ ...trial }); const sub = await subscription(id);
      await db.query('INSERT INTO subscription_price_change_items(subscription_id,status,requires_compensation) VALUES ($1,$2,$3)', [sub.id, status, fence]);
      await failure(await command(id, 'assign_manual_plan', { planCode: 'basico', endsAt: null }), 'OPERATION_IN_PROGRESS');
    }
  });
  await test('strict SQL rejects extra keys, invalid contact, missing dates and infinity', async () => {
    const id = await seed();
    for (const changes of [{ name: 'Fixture', phone: null, address: null, contactEmail: 'invalid' }, { name: 'Fixture', phone: null, address: null, contactEmail: null, slug: 'new' }]) await failure(await command(id, 'update_details', changes), 'INVALID_INPUT');
    for (const changes of [{ planCode: 'basico' }, { planCode: 'basico', endsAt: 'infinity' }, { planCode: 'basico', endsAt: 'bad-date' }]) await failure(await command(id, 'assign_manual_plan', changes), 'INVALID_INPUT');
  });
  await test('audit failure rolls back organization and private contact together', async () => {
    const id = await seed(); const input = await command(id, 'update_details', { name: 'Must rollback', phone: null, address: null, contactEmail: 'fixture@example.com' });
    await assert.rejects(mutate({ ...input, actor: randomUUID() }), /foreign key/);
    assert.equal((await db.query('SELECT name FROM organizations WHERE id=$1', [id])).rows[0].name, 'Fixture');
    assert.equal((await db.query('SELECT count(*)::integer n FROM platform_admin_organization_contacts WHERE organization_id=$1', [id])).rows[0].n, 0);
  });
  await test('anon/authenticated cannot execute RPC or read private commercial contacts', async () => {
    const id = await seed(); const input = await command(id, 'assign_manual_plan', { planCode: 'basico', endsAt: null });
    for (const role of ['anon', 'authenticated']) {
      await failure(input, 'permission denied', role);
      await assert.rejects(db.transaction(async tx => { await tx.exec(`SET LOCAL ROLE ${role}`); return tx.query('SELECT * FROM platform_admin_organization_contacts'); }), /permission denied/);
    }
  });
  console.log(`${passed} SQL integration tests passed (local synthetic PostgreSQL, no production access).`);
} catch (error) {
  console.error(`SQL test failure after ${passed} cases: ${error.message}`);
  process.exitCode = 1;
} finally { await db.close(); }
