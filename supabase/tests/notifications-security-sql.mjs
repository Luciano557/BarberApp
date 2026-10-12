// Local PostgreSQL/WASM only. No URLs, credentials or production data; every user, name and amount is synthetic.
// Install the isolated test dependency once (see docs/MODULOS/notificaciones.md):
//   npm install --prefix node_modules/.admin-sql-test --no-package-lock --no-save @electric-sql/pglite@0.5.8
// Run from the repository root:  node supabase/tests/notifications-security-sql.mjs
//
// Phase 1 rebuilds the CURRENT (pre-hardening) notifications schema by running the real historic migrations
// and proves the vulnerabilities exist ("baseline"). Phase 2 applies the three Etapa 1 migrations
// and proves they are closed while every producer keeps working ("hardened").
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(pathToFileURL(resolve('node_modules/.admin-sql-test/node_modules/@electric-sql/pglite/dist/index.js')).href);

const DIR = 'supabase/migrations';
const M1 = '20261012100000_notifications_security_functions.sql';
const M2 = '20261012100100_notifications_security_rls.sql';
const M3 = '20261012100200_organizations_timezone_validation.sql';
const files = (await readdir(DIR)).filter(f => f.endsWith('.sql')).sort();
const cache = new Map();
async function read(name) {
  if (!cache.has(name)) cache.set(name, (await readFile(`${DIR}/${name}`, 'utf8')).replace(/\r/g, ''));
  return cache.get(name);
}
const mig = prefix => {
  const name = files.find(f => f.startsWith(prefix));
  assert(name, `Missing migration ${prefix}`);
  return read(name);
};
function extractFunction(sql, name) {
  const start = sql.search(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(`, 'i'));
  assert(start >= 0, `Missing function ${name}`);
  const rest = sql.slice(start);
  const open = rest.match(/\bAS\s+(\$[A-Za-z_]*\$)/i);
  assert(open, `No body for ${name}`);
  const bodyStart = open.index + open[0].length;
  const end = rest.indexOf(open[1], bodyStart);
  assert(end > 0, `Unterminated body for ${name}`);
  return `${rest.slice(0, end + open[1].length)};`;
}

const ROLLBACK = Symbol('rollback');
let passed = 0;
async function test(name, work) { await work(); passed++; console.log(`ok ${passed} - ${name}`); }

// ---------------------------------------------------------------------------------------------------------
// Synthetic environment. Objects are owned by a NON-superuser (like `postgres` in Supabase) so EXECUTE/ACL
// semantics are real, and Supabase's default privileges (anon/authenticated/service_role) are emulated.
// ---------------------------------------------------------------------------------------------------------
const SETUP = `
  SET TIME ZONE 'UTC';
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE ROLE app_owner NOLOGIN;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, app_owner;
  GRANT USAGE, CREATE ON SCHEMA public TO app_owner;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
`;
// Only the columns the real functions/triggers touch are modelled.
const SCHEMA = `
  CREATE TYPE public.app_role AS ENUM ('owner','manager','barber','general_manager','otros','sucursal_account');
  CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
  CREATE TABLE public.organizations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
    timezone text DEFAULT 'America/Argentina/Buenos_Aires', tareas_vencimiento_dias_default integer,
    peticiones_vencimiento_dias integer, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
  CREATE TABLE public.profiles (id uuid PRIMARY KEY, organization_id uuid, barbero_id uuid, full_name text, email text);
  CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, role public.app_role NOT NULL);
  CREATE TABLE public.sucursales (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, nombre text, timezone text);
  CREATE TABLE public.user_sucursales (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, sucursal_id uuid NOT NULL, organization_id uuid NOT NULL);
  CREATE TABLE public.sucursal_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
    sucursal_id uuid NOT NULL UNIQUE, user_id uuid UNIQUE, email text);
  CREATE TABLE public.barberos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, nombre text, apellido text,
    sucursal_id uuid, activo boolean NOT NULL DEFAULT true);
  CREATE TABLE public.barberos_sucursales (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
    barbero_id uuid NOT NULL, sucursal_id uuid NOT NULL, disponible boolean NOT NULL DEFAULT true, updated_at timestamptz DEFAULT now());
  CREATE TABLE public.servicios (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nombre text);
  CREATE TABLE public.turnos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, sucursal_id uuid,
    barbero_id uuid, servicio_id uuid, fecha date, hora_inicio time, hora_fin time, estado text DEFAULT 'confirmado', cliente_nombre text);
  CREATE TABLE public.tareas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, sucursal_id uuid,
    tipo text NOT NULL DEFAULT 'tarea', estado text NOT NULL DEFAULT 'pendiente', titulo text, descripcion text, assignment_scope text,
    asignado_a_id uuid, asignado_a_nombre text, creado_por_id uuid, creado_por_nombre text, fecha_inicio timestamptz,
    vencimiento_dias integer, created_at timestamptz DEFAULT now());
  CREATE TABLE public.ingresos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, sucursal_id uuid, closed_at timestamptz,
    identificador uuid, entry_mode text, backfilled_at timestamptz, backfilled_by uuid, dia date, total_cobrado numeric);
  CREATE TABLE public.anulaciones_cierre (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, ingreso_id uuid,
    motivo text, fecha_cierre date, barbero_nombre text, anulado_por_id uuid);
  CREATE TABLE public.venta (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, sucursal_id uuid, estado text DEFAULT 'activo',
    anulado_por_id text, total_cobrado numeric, metodo_pago text, tipo_venta text, barbero_nombre text, fecha_hora timestamptz DEFAULT now());
  CREATE TABLE public."Egresos" (id bigserial PRIMARY KEY, organization_id uuid, sucursal_id uuid, estado text DEFAULT 'activo',
    "Monto" numeric, "Categoria" text, "Descripcion" text, "Fecha" timestamptz DEFAULT now(), tipo_costo text, anulado_motivo text, anulado_por uuid);
  CREATE TABLE public.inversiones (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, sucursal_id uuid, nombre text,
    monto_total numeric, categoria text, meses_amortizacion integer, fecha_compra date);
  CREATE TABLE public.deudas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, sucursal_id uuid, acreedor text,
    monto_total numeric, cuotas_totales integer, fecha_inicio date);
  CREATE TABLE public.pagos_sueldos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, sucursal_id uuid, concepto text,
    monto numeric, barbero_nombre text, fecha timestamptz DEFAULT now());
  CREATE TABLE public.sucursal_action_pin_config (organization_id uuid, sucursal_id uuid, action_key text, requires_pin boolean);
`;

// Historic migrations that define the notification objects, in chronological order.
// The bodies come from the repository files; only two environment-specific lines are cut (pg_cron / Realtime).
const HISTORY = [
  ['20260515004612', s => s],
  ['20260515013926', s => s],
  ['20260515153052', s => s],
  ['20260515210540', s => s],
  ['20260515212453', s => s],
  ['20260515220322', s => s],
  ['20260515222233', s => s],
  ['20260602052143', s => s.replace('CREATE EXTENSION IF NOT EXISTS pg_cron;', '')],
  ['20260607200114', s => s],
  ['20260608120225', s => s.slice(0, s.lastIndexOf('\n', s.indexOf('Bloque B')))],
];

async function asOwner(db, sql) {
  await db.transaction(async tx => { await tx.exec('SET LOCAL ROLE app_owner'); await tx.exec(sql); });
}
async function buildBaseline() {
  const db = await PGlite.create();
  await db.exec(SETUP);
  await asOwner(db, SCHEMA);
  await asOwner(db, extractFunction(await mig('20260109143656'), 'has_role'));
  await asOwner(db, extractFunction(await mig('20260109213200'), 'get_user_organization_id'));
  for (const [prefix, adapt] of HISTORY) await asOwner(db, adapt(await mig(prefix)));
  // The client-callable RPC as it stands in HEAD (replaced the 20-arg version created in 20260515210540).
  await asOwner(db, extractFunction(await mig('20260602052818'), 'upsert_notification'));
  const orgPolicy = (await mig('20260315195351')).match(/CREATE POLICY "Owner and GM can update own organization"[\s\S]*?;/)[0];
  await asOwner(db, `
    ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "synthetic select own organization" ON public.organizations FOR SELECT TO authenticated
      USING (id = public.get_user_organization_id(auth.uid()));
    ${orgPolicy}`);
  return db;
}

// The baseline is only trustworthy if no later migration redefines the objects under test.
await test('baseline fidelity: the historic files loaded here are the only definitions of the notification objects in HEAD', async () => {
  const loaded = new Set([...HISTORY.map(([p]) => p), '20260602052818', '20260724121341', '20260724123919']);
  const relevant = /(?:CREATE(?: OR REPLACE)? FUNCTION|DROP FUNCTION(?: IF EXISTS)?) public\.(_notif_\w+|notif_emit_\w+|upsert_notification\w*|process_vencimientos_tareas|trg_\w*notif\w*)\(/gi;
  for (const name of files) {
    // Etapa 1 itself and everything after it (e.g. Etapa 2) is not part of the pre-hardening baseline.
    if (name === M1 || name === M2 || name === M3 || name > M3) continue;
    const hits = [...(await read(name)).matchAll(relevant)].map(m => m[1]);
    if (hits.length) assert(loaded.has(name.slice(0, 14)), `${name} redefines ${hits.join(', ')} but is not part of the baseline`);
  }
  // notif_emit_crm_sync_fallo was created and dropped again inside HEAD; it does not exist.
  assert((await read(files.find(f => f.startsWith('20260724123919')))).includes('DROP FUNCTION IF EXISTS public.notif_emit_crm_sync_fallo'));
});

// ---------------------------------------------------------------------------------------------------------
// Synthetic world: organizations A and B, every role, and a few legitimately emitted notifications.
// ---------------------------------------------------------------------------------------------------------
const db = await buildBaseline();
const id = () => randomUUID();
const W = {
  orgA: id(), orgB: id(), S1: id(), S2: id(), SB1: id(),
  ownerA: id(), gmA: id(), mgrS1: id(), mgrS2: id(), barberS1: id(), saS1: id(), otrosA: id(), noOrg: id(),
  ownerB: id(), barberB: id(), saB: id(), bar1: id(), barB1: id(),
};
const LABEL = Object.fromEntries(Object.entries(W).map(([k, v]) => [v, k]));
const A_USERS = ['ownerA', 'gmA', 'mgrS1', 'mgrS2', 'barberS1', 'saS1', 'otrosA'];
const B_USERS = ['ownerB', 'barberB', 'saB'];

async function seedWorld() {
  await db.exec('SET session_replication_role = replica');
  const users = [['ownerA', 'A'], ['gmA', 'A'], ['mgrS1', 'A'], ['mgrS2', 'A'], ['barberS1', 'A'], ['saS1', 'A'], ['otrosA', 'A'],
    ['noOrg', null], ['ownerB', 'B'], ['barberB', 'B'], ['saB', 'B']];
  await db.query(`INSERT INTO organizations(id,name) VALUES ($1,'Org A sintetica'),($2,'Org B sintetica')`, [W.orgA, W.orgB]);
  await db.query(`INSERT INTO sucursales(id,organization_id,nombre) VALUES ($1,$4,'S1'),($2,$4,'S2'),($3,$5,'SB1')`, [W.S1, W.S2, W.SB1, W.orgA, W.orgB]);
  for (const [name, org] of users) {
    await db.query('INSERT INTO auth.users(id) VALUES ($1)', [W[name]]);
    await db.query('INSERT INTO profiles(id,organization_id,barbero_id,full_name,email) VALUES ($1,$2,$3,$4,$5)', [
      W[name], org === 'A' ? W.orgA : org === 'B' ? W.orgB : null,
      name === 'barberS1' ? W.bar1 : name === 'barberB' ? W.barB1 : null, `Nombre ${name}`, `${name.toLowerCase()}@example.invalid`]);
  }
  const roles = { ownerA: 'owner', gmA: 'general_manager', mgrS1: 'manager', mgrS2: 'manager', barberS1: 'barber', saS1: 'sucursal_account',
    otrosA: 'otros', ownerB: 'owner', barberB: 'barber', saB: 'sucursal_account' };
  for (const [name, role] of Object.entries(roles)) await db.query('INSERT INTO user_roles(user_id,role) VALUES ($1,$2)', [W[name], role]);
  await db.query('INSERT INTO user_sucursales(user_id,sucursal_id,organization_id) VALUES ($1,$2,$3),($4,$5,$3)', [W.mgrS1, W.S1, W.orgA, W.mgrS2, W.S2]);
  await db.query('INSERT INTO sucursal_accounts(organization_id,sucursal_id,user_id,email) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)',
    [W.orgA, W.S1, W.saS1, 'sa1@example.invalid', W.orgB, W.SB1, W.saB, 'sab@example.invalid']);
  await db.query('INSERT INTO barberos(id,organization_id,nombre,apellido,sucursal_id) VALUES ($1,$2,$3,$4,$5),($6,$7,$8,$9,$10)',
    [W.bar1, W.orgA, 'Barbero', 'Uno', W.S1, W.barB1, W.orgB, 'Barbero', 'B', W.SB1]);
  await db.query('INSERT INTO barberos_sucursales(organization_id,barbero_id,sucursal_id) VALUES ($1,$2,$3),($4,$5,$6)',
    [W.orgA, W.bar1, W.S1, W.orgB, W.barB1, W.SB1]);
  await db.exec('SET session_replication_role = origin');
}
await seedWorld();

const withJwt = async (tx, uid, role) => {
  await tx.exec(`SET LOCAL ROLE ${role}`);
  await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
};
/** Runs `work` as a database role with the JWT of `user` (like PostgREST) and always rolls back. */
async function probe(user, work, role = 'authenticated') {
  let out;
  try {
    await db.transaction(async tx => { await withJwt(tx, user ? W[user] : null, role); out = await work(tx); throw ROLLBACK; });
  } catch (error) { if (error !== ROLLBACK) throw error; }
  return out;
}
/** Same, but commits (used only to create the legitimate fixtures). */
async function commitAs(user, work, role = 'authenticated') {
  await db.transaction(async tx => { await withJwt(tx, W[user], role); await work(tx); });
}

// Legitimate events, produced by the real triggers exactly as the app would.
await commitAs('ownerA', async tx => {
  await tx.query(`INSERT INTO pagos_sueldos(organization_id,sucursal_id,concepto,monto,barbero_nombre) VALUES ($1,$2,'Concepto sintetico',123456,'Barbero Uno')`, [W.orgA, W.S1]);
  await tx.query(`INSERT INTO "Egresos"(organization_id,sucursal_id,"Monto","Categoria","Descripcion",tipo_costo) VALUES ($1,$2,5000,'Categoria','Gasto sintetico','fijo')`, [W.orgA, W.S1]);
  await tx.query(`INSERT INTO tareas(organization_id,sucursal_id,tipo,titulo,assignment_scope,creado_por_id,creado_por_nombre) VALUES ($1,$2,'tarea','Tarea de equipo sintetica','team',$3,'Owner Sintetico')`, [W.orgA, W.S1, W.ownerA]);
});
await commitAs('ownerB', async tx => {
  await tx.query(`INSERT INTO pagos_sueldos(organization_id,sucursal_id,concepto,monto,barbero_nombre) VALUES ($1,$2,'Concepto B',777,'Barbero B')`, [W.orgB, W.SB1]);
});
const salaryA = (await db.query(`SELECT id,event_key FROM notifications WHERE type='pago_sueldo_registrado' AND organization_id=$1`, [W.orgA])).rows[0];
const salaryB = (await db.query(`SELECT id FROM notifications WHERE type='pago_sueldo_registrado' AND organization_id=$1`, [W.orgB])).rows[0];
const gastoA = (await db.query(`SELECT id FROM notifications WHERE type='gasto_registrado'`)).rows[0];
const teamA = (await db.query(`SELECT id FROM notifications WHERE type='tarea_equipo_asignada'`)).rows[0];

const deliveriesOf = async name => (await db.query(`SELECT notification_id FROM notification_deliveries WHERE user_id=$1 ORDER BY 1`, [W[name]])).rows.map(r => r.notification_id);
const visibleTo = (user) => probe(user, async tx => (await tx.query('SELECT id, type FROM notifications ORDER BY id')).rows);
const recipientsOf = async notificationId => (await db.query('SELECT user_id FROM notification_deliveries WHERE notification_id=$1', [notificationId])).rows.map(r => LABEL[r.user_id]).sort();

// ---------------------------------------------------------------------------------------------------------
// Helper signatures (exact, taken from the migrations) and call templates.
// ---------------------------------------------------------------------------------------------------------
const HELPERS = [
  ['public._notif_emit(uuid,text,text,uuid,text,text,uuid,text,text,text,text,jsonb,uuid,text,uuid[],boolean)', () =>
    `SELECT public._notif_emit('${W.orgA}'::uuid,'evento_inyectado','inyectado:1',NULL::uuid,'tareas',NULL::text,NULL::uuid,'Aviso inyectado',NULL::text,NULL::text,NULL::text,'{}'::jsonb,NULL::uuid,NULL::text,ARRAY['${W.ownerA}']::uuid[],true)`],
  ['public._notif_emit_sensitive(uuid,text,text,uuid,text,text,uuid,text,text,text,jsonb,uuid,uuid[],boolean,text)', () =>
    `SELECT public._notif_emit_sensitive('${W.orgA}'::uuid,'evento_inyectado','inyectado:2',NULL::uuid,'finanzas',NULL::text,NULL::uuid,'Aviso inyectado',NULL::text,'finanzas','{}'::jsonb,NULL::uuid,ARRAY['${W.ownerA}']::uuid[],false,'always')`],
  ['public._notif_org_admins(uuid)', () => `SELECT * FROM public._notif_org_admins('${W.orgA}'::uuid)`],
  ['public._notif_sucursal_managers(uuid,uuid)', () => `SELECT * FROM public._notif_sucursal_managers('${W.orgA}'::uuid,'${W.S1}'::uuid)`],
  ['public._notif_sucursal_barbers(uuid,uuid)', () => `SELECT * FROM public._notif_sucursal_barbers('${W.orgA}'::uuid,'${W.S1}'::uuid)`],
  ['public._notif_sucursal_account(uuid,uuid)', () => `SELECT * FROM public._notif_sucursal_account('${W.orgA}'::uuid,'${W.S1}'::uuid)`],
  ['public._notif_actor_name(uuid)', () => `SELECT public._notif_actor_name('${W.ownerA}'::uuid)`],
  ['public._notif_actor_account_type(uuid)', () => `SELECT public._notif_actor_account_type('${W.ownerA}'::uuid)`],
  ['public._notif_pref_mode(uuid,text,text)', () => `SELECT public._notif_pref_mode('${W.ownerA}'::uuid,'gasto_registrado','always')`],
  ['public._notif_turno_dispatch(public.turnos,text,text)', () => `SELECT public._notif_turno_dispatch(NULL::public.turnos,'creado','creado')`],
  ['public._notif_turno_metadata(public.turnos)', () => `SELECT public._notif_turno_metadata(NULL::public.turnos)`],
  ['public._notif_turno_title(public.turnos,text)', () => `SELECT public._notif_turno_title(NULL::public.turnos,'creado')`],
];
const UNUSED_RPCS = [
  ['public.notif_emit_login_sucursal_account(uuid)', () => `SELECT public.notif_emit_login_sucursal_account('${W.S1}'::uuid)`],
  ['public.notif_emit_action_blocked(text,uuid)', () => `SELECT public.notif_emit_action_blocked('accion','${W.S1}'::uuid)`],
  ['public.notif_emit_pin_authorized(text,uuid,uuid,text)', () => `SELECT public.notif_emit_pin_authorized('accion','${W.S1}'::uuid,'${W.ownerA}'::uuid,'Nombre')`],
];
const OLD_RPCS = [
  'public.upsert_notification(uuid,text,text,text,text,uuid,text,text,timestamptz,jsonb,uuid,text,text,uuid,text,text,uuid,text,timestamptz,boolean)',
  'public.upsert_notification_delivery(uuid,uuid)',
];
const canExecute = async (role, signature) =>
  (await db.query(`SELECT has_function_privilege($1, to_regprocedure($2), 'EXECUTE') AS ok`, [role, signature])).rows[0].ok;
const publicExecute = async signature => (await db.query(`
  SELECT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                 WHERE p.oid = to_regprocedure($1) AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') AS ok`, [signature])).rows[0].ok;
// Counted as the database owner: the caller (e.g. a sucursal account) is not supposed to see notices addressed to others.
const countNotifications = async tx => {
  const { u } = (await tx.query('SELECT current_user AS u')).rows[0];
  await tx.exec('RESET ROLE');
  const n = Number((await tx.query('SELECT count(*)::int AS n FROM notifications')).rows[0].n);
  if (u !== (await tx.query('SELECT session_user AS u')).rows[0].u) await tx.exec(`SET LOCAL ROLE ${u}`);
  return n;
};

// ---------------------------------------------------------------------------------------------------------
// PHASE 1 - BASELINE: the vulnerabilities exist in HEAD. These are the findings that Etapa 1 closes.
// ---------------------------------------------------------------------------------------------------------
await test('[baseline] fixtures: sueldos reaches only owner+GM through deliveries; gasto adds the sucursal manager; B is isolated', async () => {
  assert.deepEqual(await recipientsOf(salaryA.id), ['gmA', 'ownerA']);
  assert.deepEqual(await recipientsOf(gastoA.id), ['gmA', 'mgrS1', 'ownerA']);
  assert.deepEqual(await recipientsOf(salaryB.id), ['ownerB']);
});
await test('[baseline] SEG-01 any member of the organisation reads notifications that were not delivered to them (sueldos, gastos)', async () => {
  for (const user of ['barberS1', 'saS1', 'otrosA', 'mgrS2']) {
    const types = (await visibleTo(user)).map(r => r.type);
    assert(types.includes('pago_sueldo_registrado'), `${user} reads the salary payment without a delivery`);
    assert(types.includes('gasto_registrado'));
  }
  const cross = await probe('ownerB', async tx => (await tx.query('SELECT 1 FROM notifications WHERE organization_id=$1', [W.orgA])).rows.length);
  assert.equal(cross, 0, 'tenant isolation by organisation already held');
});
await test('[baseline] SEG-01 a client can insert and rewrite notifications that other people then see', async () => {
  const result = await probe('barberS1', async tx => {
    await tx.query(`INSERT INTO notifications(organization_id,event_key,type,source_module,title) VALUES ($1,'cliente:forjado','forjado','tareas','Aviso forjado')`, [W.orgA]);
    const updated = await tx.query(`UPDATE notifications SET title='Reescrito por un barbero' WHERE id=$1`, [salaryA.id]);
    return updated.affectedRows;
  });
  assert.equal(result, 1);
});
await test('[baseline] SEG-01b the owner of a delivery can repoint it to any notification of the organisation', async () => {
  const result = await probe('barberS1', async tx => {
    const own = (await tx.query('SELECT id FROM notification_deliveries WHERE user_id=auth.uid() LIMIT 1')).rows[0].id;
    return (await tx.query('UPDATE notification_deliveries SET notification_id=$1 WHERE id=$2', [salaryA.id, own])).affectedRows;
  });
  assert.equal(result, 1);
});
await test('[baseline] SEG-02 anonymous callers can run the internal helpers: enumerate admins, read an e-mail, inject a notification into any organisation', async () => {
  for (const role of ['anon', 'authenticated']) {
    const admins = await probe(null, async tx => (await tx.query(`SELECT * FROM public._notif_org_admins('${W.orgA}'::uuid)`)).rows.length, role);
    assert.equal(admins, 2, `${role} enumerates organisation admins`);
    const email = await probe(null, async tx => (await tx.query(`SELECT public._notif_actor_name('${W.ownerA}'::uuid) AS v`)).rows[0].v, role);
    assert(email.startsWith('Nombre'));
    const injected = await probe(null, async tx => {
      await tx.query(HELPERS[0][1]());
      await tx.exec('RESET ROLE'); // the caller cannot read it back; verify as the owner
      return (await tx.query(`SELECT count(*)::int AS n FROM notification_deliveries d JOIN notifications n ON n.id=d.notification_id WHERE n.type='evento_inyectado' AND d.user_id=$1`, [W.ownerA])).rows[0].n;
    }, role);
    assert.equal(injected, 1, `${role} plants a notification in the owner's bell`);
  }
});
await test('[baseline] SEG-03/04 the old RPCs let a member self-subscribe to any notification and overwrite it through its event_key', async () => {
  const subscribed = await probe('barberS1', async tx =>
    (await tx.query(`SELECT (public.upsert_notification_delivery($1::uuid, auth.uid())).notification_id AS v`, [salaryA.id])).rows[0].v);
  assert.equal(subscribed, salaryA.id);
  const title = await probe('barberS1', async tx => {
    await tx.query(`SELECT public.upsert_notification($1::uuid,$2,'pago_sueldo_registrado','sueldos',NULL::text,NULL::uuid,'Titulo pisado',NULL::text,now(),'{}'::jsonb)`, [W.orgA, salaryA.event_key]);
    return (await tx.query('SELECT title FROM notifications WHERE id=$1', [salaryA.id])).rows[0].title;
  });
  assert.equal(title, 'Titulo pisado');
});
await test('[baseline] SEG-05 an organisation owner can store a timezone that makes the global cron fail', async () => {
  const error = await probe('ownerA', async tx => {
    assert.equal((await tx.query(`UPDATE organizations SET timezone='Mars/Phobos' WHERE id=$1`, [W.orgA])).affectedRows, 1);
    await tx.exec('RESET ROLE');
    await tx.query(`INSERT INTO tareas(organization_id,sucursal_id,tipo,titulo,assignment_scope,fecha_inicio) VALUES ($1,$2,'tarea','Vencida','team','2020-01-01')`, [W.orgA, W.S1]);
    try { await tx.query('SELECT public.process_vencimientos_tareas()'); return null; } catch (e) { return e.message; }
  });
  assert.match(error, /time zone/i);
});
await test('[baseline] SEG-06 process_vencimientos_tareas is executable by anon and authenticated (only PUBLIC was revoked)', async () => {
  assert.equal(await canExecute('anon', 'public.process_vencimientos_tareas()'), true);
  assert.equal(await canExecute('authenticated', 'public.process_vencimientos_tareas()'), true);
});
await test('[baseline] notif_emit_view_event accepts a sucursal that is not the caller\'s own', async () => {
  const created = await probe('saS1', async tx => {
    const before = await countNotifications(tx);
    await tx.query(`SELECT public.notif_emit_view_event('gastos', $1::uuid)`, [W.S2]);
    return (await countNotifications(tx)) - before;
  });
  assert.equal(created, 1);
});
await test('[baseline] anon holds table privileges on notification_reads and user_notification_preferences (RLS was the only barrier)', async () => {
  for (const table of ['notification_reads', 'user_notification_preferences'])
    assert.equal((await db.query(`SELECT has_table_privilege('anon', $1, 'SELECT') AS ok`, [`public.${table}`])).rows[0].ok, true);
});

// Producer scenarios: each runs in its own rolled-back transaction, so baseline and hardened runs are comparable.
const A = W.orgA, S1 = W.S1;
const prep = { off: 'SET LOCAL session_replication_role = replica', on: 'SET LOCAL session_replication_role = origin' };
const SCENARIOS = [
  { name: 'Tareas · tarea individual', as: 'ownerA', act: [`INSERT INTO tareas(organization_id,sucursal_id,tipo,titulo,assignment_scope,asignado_a_id,asignado_a_nombre,creado_por_id,creado_por_nombre) VALUES ('${A}','${S1}','tarea','T','individual','${W.barberS1}','Barbero','${W.ownerA}','Owner')`],
    expect: { tarea_asignada: ['barberS1', 'gmA', 'mgrS1', 'ownerA'] } },
  { name: 'Tareas · tarea de equipo', as: 'ownerA', act: [`INSERT INTO tareas(organization_id,sucursal_id,tipo,titulo,assignment_scope,creado_por_id,creado_por_nombre) VALUES ('${A}','${S1}','tarea','T','team','${W.ownerA}','Owner')`],
    expect: { tarea_equipo_asignada: ['barberS1', 'gmA', 'mgrS1', 'ownerA', 'saS1'] } },
  { name: 'Tareas · petición nueva (cuenta de sucursal)', as: 'saS1', act: [`INSERT INTO tareas(organization_id,sucursal_id,tipo,titulo,creado_por_id,creado_por_nombre) VALUES ('${A}','${S1}','peticion','P','${W.saS1}','Cuenta')`],
    expect: { peticion_nueva: ['gmA', 'mgrS1', 'ownerA', 'saS1'] } },
  { name: 'Tareas · petición aprobada', as: 'ownerA',
    prepare: [prep.off, `INSERT INTO tareas(organization_id,sucursal_id,tipo,titulo,creado_por_id,creado_por_nombre) VALUES ('${A}','${S1}','peticion','P2','${W.saS1}','Cuenta')`, prep.on],
    act: [`UPDATE tareas SET estado='aprobada' WHERE titulo='P2'`], expect: { peticion_aprobada: ['gmA', 'mgrS1', 'ownerA', 'saS1'] } },
  { name: 'Turnos · crear', as: 'ownerA', act: [`INSERT INTO turnos(organization_id,sucursal_id,barbero_id,fecha,hora_inicio,hora_fin,cliente_nombre) VALUES ('${A}','${S1}','${W.bar1}','2030-01-01','10:00','10:30','Cliente Sintetico')`],
    expect: { turno_creado_propio: ['barberS1'], turno_creado: ['gmA', 'mgrS1', 'ownerA', 'saS1'] } },
  { name: 'Turnos · cancelar', as: 'ownerA',
    prepare: [prep.off, `INSERT INTO turnos(organization_id,sucursal_id,barbero_id,fecha,hora_inicio,hora_fin) VALUES ('${A}','${S1}','${W.bar1}','2030-01-02','10:00','10:30')`, prep.on],
    act: [`UPDATE turnos SET estado='cancelado' WHERE fecha='2030-01-02'`], expect: { turno_cancelado_propio: ['barberS1'], turno_cancelado: ['gmA', 'mgrS1', 'ownerA', 'saS1'] } },
  { name: 'Caja · cierre de caja', as: 'ownerA', act: [`INSERT INTO ingresos(organization_id,sucursal_id,closed_at,identificador,entry_mode,dia,total_cobrado) VALUES ('${A}','${S1}',now(),gen_random_uuid(),'normal','2030-01-01',100)`],
    expect: { cierre_caja_realizado: ['gmA', 'mgrS1', 'ownerA'] } },
  { name: 'Caja · anulación de cierre', as: 'ownerA',
    prepare: [prep.off, `INSERT INTO ingresos(id,organization_id,sucursal_id) VALUES ('${'00000000-0000-4000-8000-000000000001'}','${A}','${S1}')`, prep.on],
    act: [`INSERT INTO anulaciones_cierre(organization_id,ingreso_id,motivo,fecha_cierre,barbero_nombre) VALUES ('${A}','00000000-0000-4000-8000-000000000001','Motivo sintetico','2030-01-01','Barbero Uno')`],
    expect: { anulacion_cierre: ['gmA', 'mgrS1', 'ownerA'] } },
  { name: 'Caja · transacción anulada', as: 'ownerA',
    prepare: [prep.off, `INSERT INTO venta(organization_id,sucursal_id,total_cobrado,metodo_pago,tipo_venta,barbero_nombre) VALUES ('${A}','${S1}',10,'efectivo','servicio','Barbero Uno')`, prep.on],
    act: [`UPDATE venta SET estado='anulado' WHERE organization_id='${A}'`], expect: { transaccion_anulada: ['gmA', 'mgrS1', 'ownerA'] } },
  { name: 'Finanzas · gasto registrado', as: 'ownerA', act: [`INSERT INTO "Egresos"(organization_id,sucursal_id,"Monto","Categoria","Descripcion",tipo_costo) VALUES ('${A}','${S1}',1,'C','D','fijo')`],
    expect: { gasto_registrado: ['gmA', 'mgrS1', 'ownerA'] } },
  { name: 'Finanzas · gasto editado', as: 'ownerA',
    prepare: [prep.off, `INSERT INTO "Egresos"(organization_id,sucursal_id,"Monto","Categoria","Descripcion",tipo_costo) VALUES ('${A}','${S1}',1,'C','Editable','fijo')`, prep.on],
    act: [`UPDATE "Egresos" SET "Monto"=2 WHERE "Descripcion"='Editable'`], expect: { gasto_editado: ['gmA', 'mgrS1', 'ownerA'] } },
  { name: 'Finanzas · gasto anulado', as: 'ownerA',
    prepare: [prep.off, `INSERT INTO "Egresos"(organization_id,sucursal_id,"Monto","Categoria","Descripcion",tipo_costo) VALUES ('${A}','${S1}',1,'C','Anulable','fijo')`, prep.on],
    act: [`UPDATE "Egresos" SET estado='anulado', anulado_motivo='x' WHERE "Descripcion"='Anulable'`], expect: { gasto_anulado: ['gmA', 'mgrS1', 'ownerA'] } },
  { name: 'Finanzas · inversión', as: 'ownerA', act: [`INSERT INTO inversiones(organization_id,sucursal_id,nombre,monto_total,categoria,meses_amortizacion,fecha_compra) VALUES ('${A}','${S1}','Inversion',1,'C',12,'2030-01-01')`],
    expect: { inversion_creada: ['gmA', 'ownerA'] } },
  { name: 'Finanzas · deuda', as: 'ownerA', act: [`INSERT INTO deudas(organization_id,sucursal_id,acreedor,monto_total,cuotas_totales,fecha_inicio) VALUES ('${A}','${S1}','Acreedor',1,3,'2030-01-01')`],
    expect: { deuda_creada: ['gmA', 'ownerA'] } },
  { name: 'Finanzas · Sueldos · pago registrado', as: 'ownerA', act: [`INSERT INTO pagos_sueldos(organization_id,sucursal_id,concepto,monto,barbero_nombre) VALUES ('${A}','${S1}','C',1,'Barbero Uno')`],
    expect: { pago_sueldo_registrado: ['gmA', 'ownerA'] } },
  { name: 'Configuración · cambio de cargo', as: 'ownerA', act: [`INSERT INTO user_roles(user_id,role) VALUES ('${W.otrosA}','barber')`], expect: { cambio_roles: ['gmA', 'ownerA'] } },
  { name: 'Configuración · cambio de acceso a sucursal', as: 'ownerA', act: [`INSERT INTO user_sucursales(user_id,sucursal_id,organization_id) VALUES ('${W.otrosA}','${S1}','${A}')`],
    expect: { cambio_permisos: ['gmA', 'mgrS1', 'ownerA'] } },
  { name: 'Configuración · PIN crítico', as: 'ownerA', act: [`INSERT INTO sucursal_action_pin_config(organization_id,sucursal_id,action_key,requires_pin) VALUES ('${A}','${S1}','ver_gastos',true)`],
    expect: { cambio_configuracion_critica: ['gmA', 'ownerA'] } },
  { name: 'Equipo · barbero deshabilitado en sucursal', as: 'ownerA', act: [`UPDATE barberos_sucursales SET disponible=false WHERE sucursal_id='${S1}' AND organization_id='${A}'`],
    expect: { barbero_removido_sucursal: ['gmA', 'mgrS1'] } },
  { name: 'Tareas · cron de vencimientos (service_role)', as: 'ownerA', role: 'service_role',
    prepare: [prep.off, `INSERT INTO tareas(organization_id,sucursal_id,tipo,titulo,assignment_scope,fecha_inicio) VALUES ('${A}','${S1}','tarea','Vencida','team','2020-01-01')`, prep.on],
    act: [`SELECT public.process_vencimientos_tareas()`], expect: { tarea_vencida: ['barberS1', 'gmA', 'mgrS1', 'ownerA', 'saS1'] } },
  { name: 'Finanzas · cuenta de sucursal desbloquea Gastos (RPC)', as: 'saS1', act: [`SELECT public.notif_emit_view_event('gastos','${S1}')`],
    expect: { visualizacion_gastos: ['gmA', 'mgrS1', 'ownerA'] } },
  { name: 'Finanzas · cuenta de sucursal desbloquea Sueldos (RPC)', as: 'saS1', act: [`SELECT public.notif_emit_view_event('sueldos','${S1}')`],
    expect: { visualizacion_sueldos: ['gmA', 'mgrS1', 'ownerA'] } },
];
async function runScenario(s) {
  let out;
  try {
    await db.transaction(async tx => {
      for (const sql of s.prepare ?? []) await tx.exec(sql);
      const before = (await tx.query('SELECT id FROM notifications')).rows.map(r => r.id);
      await withJwt(tx, W[s.as], s.role ?? 'authenticated');
      for (const sql of s.act) await tx.query(sql);
      await tx.exec('RESET ROLE');
      const rows = (await tx.query(`SELECT n.type, d.user_id FROM notifications n LEFT JOIN notification_deliveries d ON d.notification_id=n.id
        WHERE n.id <> ALL($1::uuid[]) ORDER BY 1`, [`{${before.join(',')}}`])).rows;
      out = {};
      for (const r of rows) (out[r.type] ??= []).push(r.user_id ? LABEL[r.user_id] : null);
      for (const k of Object.keys(out)) out[k].sort();
      throw ROLLBACK;
    });
  } catch (error) { if (error !== ROLLBACK) throw error; }
  return out;
}
const baselineProducers = {};
await test('[baseline] every producer emits the expected deliveries (so the hardened run can be compared against it)', async () => {
  for (const s of SCENARIOS) {
    baselineProducers[s.name] = await runScenario(s);
    assert.deepEqual(baselineProducers[s.name], s.expect, `baseline scenario: ${s.name}`);
  }
});

// ---------------------------------------------------------------------------------------------------------
// Apply the three Etapa 1 migrations exactly as shipped.
// ---------------------------------------------------------------------------------------------------------
const migrationSql = {};
for (const name of [M1, M2, M3]) migrationSql[name] = await read(name);
await test('migrations M1, M2, M3 apply cleanly in order on the baseline', async () => {
  for (const name of [M1, M2, M3]) await asOwner(db, migrationSql[name]);
});
await test('no historic migration was edited: M1-M3 are new files, later than every existing one', async () => {
  // Nothing may sit between or before-and-after M1-M3 except migrations that were added AFTER them (Etapa 2 onwards).
  const others = files.filter(f => ![M1, M2, M3].includes(f));
  assert(others.every(f => f < M1 || f > M3), 'a migration was slotted in between M1 and M3');
});

// ---------------------------------------------------------------------------------------------------------
// PHASE 2 - HARDENED
// ---------------------------------------------------------------------------------------------------------
await test('M1 internal helpers: no EXECUTE for PUBLIC, anon, authenticated or service_role; still SECURITY DEFINER; owner unchanged', async () => {
  const owners = new Set();
  for (const [signature] of HELPERS) {
    for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(await canExecute(role, signature), false, `${role} must not execute ${signature}`);
    assert.equal(await publicExecute(signature), false, `PUBLIC must not execute ${signature}`);
    const { rows } = await db.query(`SELECT prosecdef, pg_get_userbyid(proowner) AS owner FROM pg_proc WHERE oid = to_regprocedure($1)`, [signature]);
    assert.equal(rows[0].prosecdef, true); owners.add(rows[0].owner);
  }
  assert.deepEqual([...owners], ['app_owner']);
});
await test('M1 internal helpers return "permission denied" to anon, authenticated and service_role (injection, e-mail leak, enumeration)', async () => {
  for (const [signature, call] of HELPERS) {
    for (const role of ['anon', 'authenticated', 'service_role'])
      await assert.rejects(probe(role === 'authenticated' ? 'ownerA' : null, tx => tx.query(call()), role), /permission denied for function/, `${role} -> ${signature}`);
  }
  assert.equal(Number((await db.query(`SELECT count(*)::int AS n FROM notifications WHERE type='evento_inyectado'`)).rows[0].n), 0);
});
await test('M1 SEG-03/04 the old RPCs are gone: exact signatures resolve to NULL and no overload with those names remains', async () => {
  for (const signature of OLD_RPCS) assert.equal((await db.query('SELECT to_regprocedure($1) AS r', [signature])).rows[0].r, null, signature);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('upsert_notification','upsert_notification_delivery')`)).rows[0].n, 0);
  await assert.rejects(probe('barberS1', tx => tx.query(`SELECT public.upsert_notification_delivery('${salaryA.id}'::uuid, auth.uid())`)), /does not exist/);
});
await test('M1 the three RPCs without a consumer are closed to PUBLIC, anon, authenticated and service_role', async () => {
  for (const [signature, call] of UNUSED_RPCS) {
    assert.equal(await publicExecute(signature), false); assert.equal(await canExecute('anon', signature), false); assert.equal(await canExecute('authenticated', signature), false);
    assert.equal(await canExecute('service_role', signature), false);
    await assert.rejects(probe(null, tx => tx.query(call()), 'anon'), /permission denied for function/);
    await assert.rejects(probe(null, tx => tx.query(call()), 'service_role'), /permission denied for function/);
    await assert.rejects(probe('ownerA', tx => tx.query(call())), /permission denied for function/);
  }
});
await test('M1 SEG-06 process_vencimientos_tareas: anon/authenticated denied, service_role and the owner (cron user) keep running it', async () => {
  const signature = 'public.process_vencimientos_tareas()';
  assert.equal(await canExecute('anon', signature), false); assert.equal(await canExecute('authenticated', signature), false);
  assert.equal(await publicExecute(signature), false); assert.equal(await canExecute('service_role', signature), true);
  await assert.rejects(probe(null, tx => tx.query('SELECT public.process_vencimientos_tareas()'), 'anon'), /permission denied for function/);
  await assert.rejects(probe('ownerA', tx => tx.query('SELECT public.process_vencimientos_tareas()')), /permission denied for function/);
  const seed = tx => tx.query(`INSERT INTO tareas(organization_id,sucursal_id,tipo,titulo,assignment_scope,fecha_inicio) VALUES ($1,$2,'tarea','Vencida','team','2020-01-01')`, [W.orgA, W.S1]);
  for (const role of ['service_role', 'app_owner']) {
    const result = await probe(null, async tx => {
      await seed(tx); await withJwt(tx, null, role);
      const n = (await tx.query('SELECT public.process_vencimientos_tareas() AS n')).rows[0].n;
      await tx.exec('RESET ROLE');
      return { n, delivered: (await tx.query(`SELECT count(*)::int AS c FROM notification_deliveries d JOIN notifications n ON n.id=d.notification_id WHERE n.type='tarea_vencida'`)).rows[0].c };
    }, 'app_owner');
    assert.equal(result.n, 1, role); assert(result.delivered >= 4, role);
  }
});
await test('M1 notif_emit_view_event: SECURITY DEFINER, empty search_path, executable only by authenticated', async () => {
  const signature = 'public.notif_emit_view_event(text,uuid)';
  const { rows } = await db.query(`SELECT prosecdef, proconfig FROM pg_proc WHERE oid = to_regprocedure($1)`, [signature]);
  assert.equal(rows[0].prosecdef, true); assert(rows[0].proconfig.some(c => /^search_path=("")?$/.test(c)), JSON.stringify(rows[0].proconfig));
  assert.equal(await canExecute('authenticated', signature), true);
  for (const role of ['anon', 'service_role']) assert.equal(await canExecute(role, signature), false);
  assert.equal(await publicExecute(signature), false);
});
await test('M1 notif_emit_view_event: anon is denied; a normal authenticated user and users without organisation emit nothing', async () => {
  await assert.rejects(probe(null, tx => tx.query(`SELECT public.notif_emit_view_event('gastos','${W.S1}'::uuid)`), 'anon'), /permission denied for function/);
  for (const user of ['ownerA', 'gmA', 'mgrS1', 'barberS1', 'otrosA', 'noOrg']) {
    const created = await probe(user, async tx => { const b = await countNotifications(tx); await tx.query(`SELECT public.notif_emit_view_event('gastos', $1::uuid)`, [W.S1]); return (await countNotifications(tx)) - b; });
    assert.equal(created, 0, user);
  }
});
await test('M1 notif_emit_view_event: only the sucursal account of THAT sucursal emits; other sucursal, other organisation and unknown ids emit nothing', async () => {
  const run = (user, sucursal, module = 'gastos') => probe(user, async tx => {
    const b = await countNotifications(tx);
    await tx.query(`SELECT public.notif_emit_view_event($1, $2::uuid)`, [module, sucursal]);
    const created = (await countNotifications(tx)) - b;
    await tx.exec('RESET ROLE');
    const rows = (await tx.query(`SELECT n.type, n.actor_user_id, (SELECT array_agg(d.user_id ORDER BY d.user_id) FROM notification_deliveries d WHERE d.notification_id=n.id) AS dest
      FROM notifications n WHERE n.type LIKE 'visualizacion_%'`)).rows;
    return { created, rows };
  });
  assert.equal((await run('saS1', W.S2)).created, 0, 'own account, other sucursal of the same organisation');
  assert.equal((await run('saS1', W.SB1)).created, 0, 'own account, sucursal of another organisation');
  assert.equal((await run('saS1', id())).created, 0, 'unknown sucursal');
  assert.equal((await run('saS1', null)).created, 0, 'no sucursal');
  assert.equal((await run('saB', W.S1)).created, 0, 'account of organisation B naming a sucursal of A');
  const own = await run('saS1', W.S1);
  assert.equal(own.created, 1); assert.equal(own.rows[0].type, 'visualizacion_gastos'); assert.equal(own.rows[0].actor_user_id, W.saS1);
  assert.deepEqual(own.rows[0].dest.map(u => LABEL[u]).sort(), ['gmA', 'mgrS1', 'ownerA']);
  assert.equal((await run('saS1', W.S1, 'sueldos')).rows[0].type, 'visualizacion_sueldos');
  const other = await run('saB', W.SB1);
  assert.equal(other.created, 1); assert.deepEqual(other.rows[0].dest.map(u => LABEL[u]), ['ownerB']);
  await assert.rejects(probe('saS1', tx => tx.query(`SELECT public.notif_emit_view_event('otro', $1::uuid)`, [W.S1])), /Módulo inválido/);
  // A NULL module from a valid sucursal account is rejected the same way and leaves no notification or delivery behind.
  const totals = async () => (await db.query('SELECT (SELECT count(*)::int FROM notifications) AS n, (SELECT count(*)::int FROM notification_deliveries) AS d')).rows[0];
  const beforeNull = await totals();
  await assert.rejects(probe('saS1', tx => tx.query(`SELECT public.notif_emit_view_event(NULL, $1::uuid)`, [W.S1])), /Módulo inválido/);
  assert.deepEqual(await totals(), beforeNull);
  const twice = await probe('saS1', async tx => {
    await tx.query(`SELECT public.notif_emit_view_event('gastos', $1::uuid)`, [W.S1]); const b = await countNotifications(tx);
    await tx.query(`SELECT public.notif_emit_view_event('gastos', $1::uuid)`, [W.S1]); return (await countNotifications(tx)) - b;
  });
  assert.equal(twice, 0, 'hourly dedupe by event_key is preserved');
});

await test('M2 SEG-01 a notification is readable only through a delivery of its own: no delivery, no read (sueldos, gastos, tareas)', async () => {
  assert.deepEqual((await visibleTo('ownerA')).map(r => r.id).sort(), [...new Set(await deliveriesOf('ownerA'))].sort());
  const salaryReaders = [], gastoReaders = [];
  for (const user of [...A_USERS, ...B_USERS, 'noOrg']) {
    const rows = await visibleTo(user);
    if (rows.some(r => r.id === salaryA.id)) salaryReaders.push(user);
    if (rows.some(r => r.id === gastoA.id)) gastoReaders.push(user);
  }
  assert.deepEqual(salaryReaders.sort(), ['gmA', 'ownerA'], 'sueldos: only owner and general manager');
  assert.deepEqual(gastoReaders.sort(), ['gmA', 'mgrS1', 'ownerA'], 'gastos: admins and the manager of that sucursal');
  assert.equal((await visibleTo('mgrS2')).some(r => r.id === gastoA.id), false, 'manager of another sucursal');
  assert.equal((await visibleTo('barberS1')).some(r => r.id === teamA.id), true, 'team task still reaches the barber');
  assert.equal((await visibleTo('saS1')).some(r => r.id === teamA.id), true, 'and the sucursal account');
  assert.equal((await visibleTo('otrosA')).length, 0);
});
await test('M2 invariant: for every user, readable notifications == delivered notifications; the bell join loses nothing legitimate', async () => {
  for (const user of [...A_USERS, ...B_USERS, 'noOrg']) {
    const delivered = [...new Set(await deliveriesOf(user))].sort();
    assert.deepEqual((await visibleTo(user)).map(r => r.id).sort(), delivered, user);
    const bell = await probe(user, async tx => (await tx.query(`SELECT d.id FROM notification_deliveries d JOIN notifications n ON n.id=d.notification_id WHERE d.user_id=auth.uid() AND d.hidden_at IS NULL`)).rows.length);
    assert.equal(bell, delivered.length, `${user} keeps every legitimate notification in the bell`);
  }
});
await test('M2 tenant isolation: A never reads B, B never reads A, by scan or by id', async () => {
  for (const user of A_USERS) assert.equal((await visibleTo(user)).some(r => r.id === salaryB.id), false, user);
  for (const user of B_USERS) {
    const rows = await visibleTo(user);
    for (const n of [salaryA, gastoA, teamA]) assert.equal(rows.some(r => r.id === n.id), false, user);
    assert.equal(await probe(user, async tx => (await tx.query('SELECT 1 FROM notifications WHERE id=$1', [salaryA.id])).rows.length), 0);
    assert.equal(await probe(user, async tx => (await tx.query('SELECT 1 FROM notification_deliveries WHERE notification_id=$1', [salaryA.id])).rows.length), 0);
  }
});
await test('M2 clients cannot create, edit or delete notifications, nor create or delete deliveries', async () => {
  for (const user of ['ownerA', 'barberS1', 'ownerB']) {
    await assert.rejects(probe(user, tx => tx.query(`INSERT INTO notifications(organization_id,event_key,type,source_module,title) VALUES ($1,'forjado','x','tareas','x')`, [W.orgA])), /permission denied for table notifications/);
    await assert.rejects(probe(user, tx => tx.query(`UPDATE notifications SET title='x'`)), /permission denied for table notifications/);
    await assert.rejects(probe(user, tx => tx.query(`DELETE FROM notifications`)), /permission denied for table notifications/);
    await assert.rejects(probe(user, tx => tx.query(`TRUNCATE notifications`)), /permission denied for table notifications/);
    await assert.rejects(probe(user, tx => tx.query(`INSERT INTO notification_deliveries(notification_id,organization_id,user_id) VALUES ($1,$2,auth.uid())`, [salaryA.id, W.orgA])), /permission denied for table notification_deliveries/);
    await assert.rejects(probe(user, tx => tx.query(`DELETE FROM notification_deliveries`)), /permission denied for table notification_deliveries/);
  }
});
await test('M2 SEG-01b the user may change only read_at / hidden_at of their own delivery (read, unread, hide, restore)', async () => {
  const result = await probe('barberS1', async tx => {
    const own = (await tx.query('SELECT id FROM notification_deliveries WHERE user_id=auth.uid() LIMIT 1')).rows[0].id;
    const upd = async sql => (await tx.query(sql, [own])).affectedRows;
    const steps = [];
    steps.push(await upd(`UPDATE notification_deliveries SET read_at=now() WHERE id=$1`));
    steps.push(await upd(`UPDATE notification_deliveries SET read_at=NULL WHERE id=$1`));
    steps.push(await upd(`UPDATE notification_deliveries SET hidden_at=now() WHERE id=$1`));
    steps.push(await upd(`UPDATE notification_deliveries SET hidden_at=NULL WHERE id=$1`));
    return steps;
  });
  assert.deepEqual(result, [1, 1, 1, 1]);
});
await test('M2 SEG-01b notification_id, user_id, organization_id, id and created_at are immutable, even to a notification the user could already read', async () => {
  const attempts = [
    [`notification_id = '${salaryA.id}'`, 'notification_id'], [`user_id = '${W.ownerA}'`, 'user_id'], [`organization_id = '${W.orgB}'`, 'organization_id'],
    [`id = '${id()}'`, 'id'], [`created_at = now() - interval '1 day'`, 'created_at'],
  ];
  for (const [set, column] of attempts) {
    await assert.rejects(probe('barberS1', async tx => {
      const own = (await tx.query('SELECT id FROM notification_deliveries WHERE user_id=auth.uid() LIMIT 1')).rows[0].id;
      await tx.query(`UPDATE notification_deliveries SET ${set} WHERE id=$1`, [own]);
    }), /solo read_at y hidden_at/, column);
  }
  const { rows } = await db.query(`SELECT prosecdef, proconfig FROM pg_proc WHERE proname = 'notification_deliveries_guard_immutable'`);
  assert.equal(rows.length, 1); assert.equal(rows[0].prosecdef, false, 'the guard must be SECURITY INVOKER');
});
await test('M2 nobody can touch the deliveries of someone else (same organisation or another one)', async () => {
  const mine = await probe('ownerA', async tx => (await tx.query(`UPDATE notification_deliveries SET read_at=now() WHERE user_id <> auth.uid()`)).affectedRows);
  assert.equal(mine, 0);
  const cross = await probe('ownerB', async tx => (await tx.query(`UPDATE notification_deliveries SET read_at=now() WHERE notification_id=$1`, [salaryA.id])).affectedRows);
  assert.equal(cross, 0);
});
await test('M2 anon has no access to the four notification tables', async () => {
  for (const table of ['notifications', 'notification_deliveries', 'notification_reads', 'user_notification_preferences']) {
    for (const sql of [`SELECT * FROM ${table}`, `DELETE FROM ${table}`, `UPDATE ${table} SET created_at = now()`])
      await assert.rejects(probe(null, tx => tx.query(sql), 'anon'), new RegExp(`permission denied for table ${table}`), `${table}: ${sql}`);
    assert.equal((await db.query(`SELECT has_table_privilege('anon', $1, 'INSERT') AS ok`, [`public.${table}`])).rows[0].ok, false);
  }
});
await test('M2 notification_reads / user_notification_preferences behave as before for authenticated users (own rows only)', async () => {
  const prefs = await probe('barberS1', async tx => {
    await tx.query(`INSERT INTO user_notification_preferences(organization_id,user_id,event_type,enabled) VALUES ($1,auth.uid(),'tarea_asignada',false)`, [W.orgA]);
    return (await tx.query('SELECT count(*)::int AS n FROM user_notification_preferences')).rows[0].n;
  });
  assert.equal(prefs, 1);
  assert.equal(await probe('barberS1', async tx => (await tx.query('SELECT count(*)::int AS n FROM notification_reads')).rows[0].n), 0);
});
await test('M2 no recursive RLS: reading notifications through deliveries (the bell query) and the reverse both work in one statement', async () => {
  const rows = await probe('ownerA', async tx => (await tx.query(`SELECT n.id FROM notifications n WHERE EXISTS (SELECT 1 FROM notification_deliveries d WHERE d.notification_id=n.id)`)).rows.length);
  assert(rows > 0);
  const policies = (await db.query(`SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('notifications','notification_deliveries') ORDER BY 1,2`)).rows;
  assert.deepEqual(policies.map(p => `${p.tablename}:${p.policyname}`),
    ['notification_deliveries:select own deliveries', 'notification_deliveries:update own deliveries', 'notifications:select notifications with own delivery']);
});
await test('M2 the read policy is TO authenticated and uses the cached (select auth.uid()) form over the existing unique index', async () => {
  const { rows } = await db.query(`SELECT roles, cmd, qual FROM pg_policies WHERE tablename='notifications'`);
  assert.deepEqual(rows[0].roles, ['authenticated']); assert.equal(rows[0].cmd, 'SELECT');
  assert(/notification_deliveries/.test(rows[0].qual) && /auth\.uid\(\)/.test(rows[0].qual) && /organization_id/.test(rows[0].qual));
  const indexes = (await db.query(`SELECT indexdef FROM pg_indexes WHERE tablename='notification_deliveries'`)).rows.map(r => r.indexdef);
  assert(indexes.some(d => /UNIQUE.*\(notification_id, user_id\)/.test(d)), 'the policy EXISTS probes the existing UNIQUE (notification_id, user_id)');
});

await test('D1 history is preserved: losing role or sucursal keeps delivered notices and stops new ones; leaving the organisation closes access', async () => {
  const result = await probe(null, async tx => {
    await tx.exec('RESET ROLE');
    const countFor = async () => {
      await withJwt(tx, W.barberS1, 'authenticated');
      const n = (await tx.query('SELECT count(*)::int AS n FROM notifications')).rows[0].n; await tx.exec('RESET ROLE'); return n;
    };
    const before = await countFor();
    await tx.query(`DELETE FROM user_roles WHERE user_id=$1`, [W.barberS1]);
    await tx.query(`DELETE FROM barberos_sucursales WHERE barbero_id=$1`, [W.bar1]);
    const afterLoss = await countFor();
    await tx.query(`INSERT INTO tareas(organization_id,sucursal_id,tipo,titulo,assignment_scope,creado_por_id) VALUES ($1,$2,'tarea','Nueva','team',$3)`, [W.orgA, W.S1, W.ownerA]);
    const afterNew = await countFor();
    await tx.query(`UPDATE profiles SET organization_id=NULL WHERE id=$1`, [W.barberS1]);
    return { before, afterLoss, afterNew, afterLeaving: await countFor() };
  }, 'app_owner');
  assert(result.before > 0); assert.equal(result.afterLoss, result.before, 'historic notices survive the loss of role and sucursal');
  assert.equal(result.afterNew, result.before, 'no new notice is delivered once the barber no longer belongs to the sucursal');
  assert.equal(result.afterLeaving, 0, 'leaving the organisation closes access to its notices');
});

await test('M3 SEG-05 invalid timezones are rejected on write; IANA names (every one the app and handle_new_user write), UTC and NULL are accepted', async () => {
  const valid = ['America/Argentina/Buenos_Aires', 'America/Mexico_City', 'America/Bogota', 'America/Santiago', 'America/Lima', 'America/Guayaquil', 'America/Montevideo',
    'America/Asuncion', 'America/La_Paz', 'America/Caracas', 'Europe/Madrid', 'America/Sao_Paulo', 'America/Costa_Rica', 'America/Panama', 'America/Santo_Domingo',
    'America/Guatemala', 'America/Tegucigalpa', 'America/El_Salvador', 'America/Managua', 'America/Puerto_Rico', 'America/Havana', 'UTC'];
  for (const tz of valid) assert.equal(await probe('ownerA', async tx => (await tx.query(`UPDATE organizations SET timezone=$1 WHERE id=$2`, [tz, W.orgA])).affectedRows), 1, tz);
  assert.equal(await probe('ownerA', async tx => (await tx.query(`UPDATE organizations SET timezone=NULL WHERE id=$1`, [W.orgA])).affectedRows), 1);
  for (const tz of ['Mars/Phobos', 'UTC+3', '', ' America/Bogota', 'Buenos Aires'])
    await assert.rejects(probe('ownerA', tx => tx.query(`UPDATE organizations SET timezone=$1 WHERE id=$2`, [tz, W.orgA])), /Zona horaria inválida/, JSON.stringify(tz));
  await assert.rejects(probe(null, tx => tx.query(`INSERT INTO organizations(name,timezone) VALUES ('Alta','Mars/Phobos')`), 'app_owner'), /Zona horaria inválida/);
  assert.equal(await probe(null, async tx => (await tx.query(`INSERT INTO organizations(name) VALUES ('Alta con valor por defecto') RETURNING timezone`)).rows[0].timezone, 'app_owner'), 'America/Argentina/Buenos_Aires');
  // The validator is the only change: nothing is normalised and the policy still blocks the other roles.
  assert.equal(await probe('barberS1', async tx => (await tx.query(`UPDATE organizations SET timezone='America/Bogota' WHERE id=$1`, [W.orgA])).affectedRows), 0);
  assert.equal(await probe('ownerB', async tx => (await tx.query(`UPDATE organizations SET timezone='America/Bogota' WHERE id=$1`, [W.orgA])).affectedRows), 0);
  const { rows } = await db.query(`SELECT prosecdef, proconfig FROM pg_proc WHERE proname='validate_organization_timezone'`);
  assert.equal(rows[0].prosecdef, false, 'the validator must be SECURITY INVOKER');
  assert.equal(await canExecute('anon', 'public.validate_organization_timezone()'), false);
});

await test('H.6 catalog regression: the only notification function a client can execute is notif_emit_view_event (authenticated)', async () => {
  const { rows } = await db.query(`
    SELECT p.oid::regprocedure::text AS sig,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
           EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type='EXECUTE') AS pub
    FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname ~ '^(_notif|notif_|upsert_notification)'`);
  assert(rows.length >= 16, `expected the notification functions to be present, got ${rows.length}`);
  for (const r of rows) {
    const allowed = /^(public\.)?notif_emit_view_event\(/.test(r.sig);
    assert.equal(r.pub, false, `${r.sig} is executable by PUBLIC`);
    assert.equal(r.anon, false, `${r.sig} is executable by anon`);
    assert.equal(r.auth, allowed, `${r.sig} authenticated=${r.auth}`);
  }
});

await test('advisor-equivalent (lint 0011): every function created or replaced by M1-M3 pins its search_path and none is SECURITY DEFINER-and-anon-executable', async () => {
  for (const signature of ['public.notif_emit_view_event(text,uuid)', 'public.notification_deliveries_guard_immutable()', 'public.validate_organization_timezone()']) {
    const { rows } = await db.query(`SELECT proconfig, prosecdef FROM pg_proc WHERE oid = to_regprocedure($1)`, [signature]);
    assert(rows[0].proconfig?.some(c => c.startsWith('search_path=')), `${signature} must pin search_path`);
    assert.equal(await canExecute('anon', signature), false, `${signature} must not be executable by anon`);
  }
});
await test('every producer keeps emitting exactly the same deliveries after the hardening (22 scenarios, triggers + cron + RPC)', async () => {
  for (const s of SCENARIOS) {
    const hardened = await runScenario(s);
    assert.deepEqual(hardened, s.expect, `hardened scenario: ${s.name}`);
    assert.deepEqual(hardened, baselineProducers[s.name], `unchanged by the hardening: ${s.name}`);
  }
});
await test('producers never deliver outside their own organisation (no B user receives anything emitted for A)', async () => {
  for (const s of SCENARIOS) for (const recipients of Object.values(await runScenario(s))) for (const who of recipients) assert(!B_USERS.includes(who), `${s.name} -> ${who}`);
});

// ---------------------------------------------------------------------------------------------------------
// Safety nets inside the migrations themselves (fresh databases, so nothing above is disturbed).
// ---------------------------------------------------------------------------------------------------------
await test('M1 aborts, changing nothing, if a helper has a different owner than its callers (REVOKE would break the triggers)', async () => {
  const fresh = await buildBaseline();
  await fresh.exec(`CREATE ROLE other_owner NOLOGIN; ALTER FUNCTION public._notif_org_admins(uuid) OWNER TO other_owner;`);
  await assert.rejects(asOwner(fresh, migrationSql[M1]), /owner/i);
  assert.notEqual((await fresh.query('SELECT to_regprocedure($1) AS r', [OLD_RPCS[1]])).rows[0].r, null, 'rolled back');
  assert.equal(await fresh.query(`SELECT has_function_privilege('anon', to_regprocedure('public._notif_org_admins(uuid)'), 'EXECUTE') AS ok`).then(r => r.rows[0].ok), true, 'rolled back');
  await fresh.close();
});
await test('M1 aborts if an unknown SECURITY INVOKER function calls the helpers (it would lose access when EXECUTE is revoked)', async () => {
  const fresh = await buildBaseline();
  await asOwner(fresh, `CREATE FUNCTION public.unknown_caller() RETURNS SETOF uuid LANGUAGE sql AS $$ SELECT * FROM public._notif_org_admins(gen_random_uuid()) $$;`);
  await assert.rejects(asOwner(fresh, migrationSql[M1]), /SECURITY INVOKER/i);
  await fresh.close();
});
await test('M1 aborts if a pg_cron job that runs process_vencimientos_tareas would lose EXECUTE, and passes when the job user keeps it', async () => {
  const fresh = await buildBaseline();
  await fresh.exec(`CREATE ROLE job_user NOLOGIN; CREATE SCHEMA cron; CREATE TABLE cron.job (jobname text, username text, command text);
    INSERT INTO cron.job VALUES ('process-vencimientos-tareas','job_user',' SELECT public.process_vencimientos_tareas(); ');
    GRANT USAGE ON SCHEMA cron TO app_owner; GRANT SELECT ON cron.job TO app_owner;`); // like `postgres` in Supabase
  await assert.rejects(asOwner(fresh, migrationSql[M1]), /pg_cron|cron/i);
  await fresh.exec(`UPDATE cron.job SET username='app_owner'`);
  await asOwner(fresh, migrationSql[M1]);
  await fresh.close();
});
await test('M2 aborts if an unexpected permissive policy would defeat the new model', async () => {
  const fresh = await buildBaseline();
  await asOwner(fresh, migrationSql[M1]);
  await asOwner(fresh, `CREATE POLICY "rogue read" ON public.notifications FOR SELECT TO authenticated USING (true);`);
  await assert.rejects(asOwner(fresh, migrationSql[M2]), /unexpected polic/i);
  await fresh.close();
  const second = await buildBaseline();
  await asOwner(second, migrationSql[M1]);
  await asOwner(second, `CREATE POLICY "rogue insert" ON public.notification_deliveries FOR INSERT TO authenticated WITH CHECK (true);`);
  await assert.rejects(asOwner(second, migrationSql[M2]), /unexpected polic/i);
  await second.close();
});
await test('M3 applies cleanly over historic invalid timezones, leaves them untouched and does not block unrelated updates', async () => {
  const fresh = await buildBaseline();
  const bad = id();
  await fresh.query(`INSERT INTO organizations(id,name,timezone) VALUES ($1,'Historica','Mars/Phobos')`, [bad]);
  await asOwner(fresh, migrationSql[M1]); await asOwner(fresh, migrationSql[M2]); await asOwner(fresh, migrationSql[M3]);
  assert.equal((await fresh.query('SELECT timezone FROM organizations WHERE id=$1', [bad])).rows[0].timezone, 'Mars/Phobos');
  await fresh.query(`UPDATE organizations SET name='Renombrada' WHERE id=$1`, [bad]);
  await assert.rejects(fresh.query(`UPDATE organizations SET timezone='Mars/Phobos' WHERE id=$1`, [bad]), /Zona horaria inválida/);
  await fresh.close();
});

console.log(`${passed} SQL integration tests passed (local synthetic PostgreSQL, no production access).`);
await db.close();
