## Diagnóstico

Revisé `Login.tsx`, `handle_new_user`, `organizations`, `plan_features` y `OrganizationContext`.

**Estado actual:**
- En el form de registro, los planes se etiquetan como `Básico / Profesional / Premium` pero los IDs internos son `free / basic / premium`. Eso se manda a `raw_user_meta_data.business_plan` y queda guardado en `organizations.plan`.
- `plan_features` y `OrganizationContext` tipan el plan como `'free' | 'basic' | 'premium'`.
- El `handle_new_user` ya hace whitelist y cae a `free` si no coincide.
- Precios actuales en UI: 30.000 / 50.000 / 100.000 (ya correctos).

**Bug de registro vinculando barbería de otro email:** sigue presente. Se aborda en este mismo plan.

**Faltan:** renombrar los IDs internos a `basico/profesional/premium`, persistir explícitamente plan, fecha de registro, fecha de último pago y vencimiento de suscripción, y forzar `signOut` previo al registro.

## Cambios

### 1. Migración SQL

**Tabla `organizations`:**
- Agregar columna `last_payment_at timestamptz NULL`.
- Mantener `plan_expires_at` como vencimiento de la suscripción.
- Mantener `created_at` como fecha de registro.
- Migrar valores de `plan`: `free → basico`, `basic → profesional`, `premium → premium`.
- Default de `plan` pasa a `'basico'`.

**Tabla `plan_features`:**
- Reescribir filas con los tres nuevos planes y precios:
  - `basico` → `price_monthly = 30000`
  - `profesional` → `price_monthly = 50000`
  - `premium` → `price_monthly = 100000`
- Mantener columnas existentes (`max_barbers`, `max_services`, etc.).

**Backfill de fechas en orgs existentes:**
```sql
UPDATE public.organizations
   SET plan_expires_at = COALESCE(plan_expires_at, created_at + interval '30 days'),
       last_payment_at = COALESCE(last_payment_at, created_at);
```

**Función `handle_new_user`:**
- Whitelist nueva: `('basico','profesional','premium')`, fallback `'basico'`.
- Al crear la organización, setear:
  - `plan_expires_at = now() + interval '30 days'`
  - `last_payment_at = now()`

**Función `check_org_limit`:** sin cambios (sigue leyendo `plan_features` por nombre).

### 2. `src/pages/Login.tsx`

- `PLANS` pasa a:
  ```ts
  { id: 'basico', label: 'Básico', price: '$30.000' },
  { id: 'profesional', label: 'Profesional', price: '$50.000' },
  { id: 'premium', label: 'Premium', price: '$100.000' },
  ```
- Default `plan` inicial = `'basico'`.
- En `handleRegister`, antes de `signUp`: `await supabase.auth.signOut()` para evitar arrastrar la sesión previa (causa del bug "Y queda en barbería de X").
- Resto del flujo intacto (verify-email / auth-callback).

### 3. `src/pages/AuthCallback.tsx`

- Tras `refreshSession`, si `pending_verification_email` en localStorage no coincide con `user.email`, forzar `signOut` y redirigir a `/verify-email`. Blindaje extra del bug.

### 4. `src/contexts/OrganizationContext.tsx` y types

- Cambiar tipo `plan: 'free' | 'basic' | 'premium'` → `'basico' | 'profesional' | 'premium'`.
- Buscar usos del literal de plan en el resto del código y actualizar (probable: `Plans Rules` memory y validaciones de límite).

### 5. Memoria de proyecto

- Actualizar `mem://features/config/plans-and-corrections` con los nuevos IDs y precios.

## Detalles técnicos

```sql
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS last_payment_at timestamptz;

UPDATE public.organizations SET plan = 'basico'      WHERE plan = 'free';
UPDATE public.organizations SET plan = 'profesional' WHERE plan = 'basic';

ALTER TABLE public.organizations ALTER COLUMN plan SET DEFAULT 'basico';

DELETE FROM public.plan_features;
INSERT INTO public.plan_features (plan, max_barbers, max_services, can_export_reports, can_view_analytics, price_monthly)
VALUES
  ('basico',      <valores actuales>, 30000),
  ('profesional', <valores actuales>, 50000),
  ('premium',     <valores actuales>, 100000);

UPDATE public.organizations
   SET plan_expires_at = COALESCE(plan_expires_at, created_at + interval '30 days'),
       last_payment_at = COALESCE(last_payment_at, created_at);
```

(Los valores `max_barbers` / `max_services` se respetan según los registros actuales para no romper límites.)

## QA

- Registrar email Y → org nueva con `plan = 'basico'|'profesional'|'premium'` según selección, `created_at`, `last_payment_at` y `plan_expires_at` poblados.
- Registrar Y estando logueado como X → entra a la org de Y (o `/verify-email`), nunca a la de X.
- UI muestra "Básico / Profesional / Premium" con precios 30.000 / 50.000 / 100.000.
- Login con cuenta vieja sigue funcionando, planes migrados correctamente.
- `check_org_limit` sigue evaluando bien contra `plan_features`.
