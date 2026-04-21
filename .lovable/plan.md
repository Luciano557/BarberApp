

## Plan: Recargos por método de pago (sin tocar sueldos) — v5

### Principio rector (sin cambios)

Aislar tres montos por venta:

```text
a) BASE SALARIAL (comisionable)  = servicePrice + extras − descuento general
b) RECARGO POR MÉTODO DE PAGO    = sumatoria de recargos prorrateados por pago
c) TOTAL FINAL COBRADO AL CLIENTE = a + b   ← lo que entra a caja
```

- (a) sigue alimentando `tx.total → summary.total → ingresos.sueldo`. **Sueldos no cambian.**
- (b) y (c) se persisten en columnas **nuevas**, sin reinterpretar campos existentes.

### Métodos de pago

Internamente: `efectivo`, `mercado_pago` (legacy/QR), `transferencia`, `debito`, `credito`.
**En UI siempre "QR"** donde hoy dice "Mercado Pago". La columna `metodo_pago = 'mercado_pago'` se conserva por compatibilidad histórica; sólo cambia el label.

Split en cobro: **Efectivo + 1 método electrónico**, 1-a-1 (mismo flujo actual).

---

### 1. Cambios de DB

#### 1.1 `payment_methods_config` — unicidad con índices parciales + constraints

```sql
CREATE TABLE payment_methods_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sucursal_id     uuid NULL REFERENCES sucursales(id) ON DELETE CASCADE,  -- NULL = config general
  metodo_pago     text NOT NULL,
  activo          boolean NOT NULL DEFAULT true,
  recargo_pct     numeric(5,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Validación de método contra lista cerrada (sin enum, mantiene flexibilidad)
  CONSTRAINT pmc_metodo_pago_valido
    CHECK (metodo_pago IN ('efectivo','mercado_pago','transferencia','debito','credito')),

  -- Recargo en rango razonable: 0 a 100%
  CONSTRAINT pmc_recargo_pct_rango
    CHECK (recargo_pct >= 0 AND recargo_pct <= 100)
);

-- Unicidad para configuración GENERAL (sucursal_id IS NULL): una fila por (org, método)
CREATE UNIQUE INDEX payment_methods_config_general_uidx
  ON payment_methods_config (organization_id, metodo_pago)
  WHERE sucursal_id IS NULL;

-- Unicidad para OVERRIDE por sucursal: una fila por (org, sucursal, método)
CREATE UNIQUE INDEX payment_methods_config_sucursal_uidx
  ON payment_methods_config (organization_id, sucursal_id, metodo_pago)
  WHERE sucursal_id IS NOT NULL;
```

#### 1.2 `sucursal_payment_settings` (toggle "usar config general")

```sql
CREATE TABLE sucursal_payment_settings (
  sucursal_id          uuid PRIMARY KEY REFERENCES sucursales(id) ON DELETE CASCADE,
  organization_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  usar_config_general  boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
```

**Default por ausencia de fila (regla formal):**
- Si **no existe fila** en `sucursal_payment_settings` para una sucursal, el sistema asume `usar_config_general = true`.
- No se requiere crear filas para sucursales que usan la general.
- Sólo se inserta fila cuando la sucursal define un override (`usar_config_general = false`) o explícitamente la fija en `true` desde la UI.
- El hook `usePaymentMethodsConfig` y todo consumidor debe implementar este default sin depender de la presencia del registro.

#### 1.3 Cambios en `venta` — conservadores

```sql
ALTER TABLE venta
  ADD COLUMN recargo_total numeric NOT NULL DEFAULT 0 CHECK (recargo_total >= 0),
  ADD COLUMN total_cobrado numeric CHECK (total_cobrado IS NULL OR total_cobrado >= 0);
-- total_final SIGUE significando base salarial / comisionable. No se renombra ni reinterpreta.
-- total_cobrado = total_final + recargo_total para ventas nuevas.
-- Histórico: recargo_total = 0, total_cobrado = total_final.
```

#### 1.4 Cambios en `venta_pagos`

```sql
ALTER TABLE venta_pagos
  ADD COLUMN recargo_pct   numeric(5,2) NOT NULL DEFAULT 0
    CHECK (recargo_pct >= 0 AND recargo_pct <= 100),
  ADD COLUMN recargo_monto numeric NOT NULL DEFAULT 0
    CHECK (recargo_monto >= 0),
  ADD COLUMN base_pago     numeric
    CHECK (base_pago IS NULL OR base_pago >= 0);
-- monto = base_pago + recargo_monto (lo que entra físicamente a caja)
```

Verificar que `venta_pagos.metodo_pago` quede consistente con la lista cerrada de métodos. Si la columna ya existe sin check, agregar:
```sql
ALTER TABLE venta_pagos
  ADD CONSTRAINT venta_pagos_metodo_pago_valido
  CHECK (metodo_pago IN ('efectivo','mercado_pago','transferencia','debito','credito'));
```

#### 1.5 Cambios en `ingresos` — cierre como foto persistida del día (obligatorio)

El cierre **no se reconstruye** desde `venta_pagos` posteriormente. Al cerrar, se persisten los montos snapshot necesarios.

```sql
ALTER TABLE ingresos
  ADD COLUMN recargos_total       numeric NOT NULL DEFAULT 0 CHECK (recargos_total >= 0),
  ADD COLUMN total_cobrado        numeric CHECK (total_cobrado IS NULL OR total_cobrado >= 0),
  ADD COLUMN efectivo_cobrado     numeric CHECK (efectivo_cobrado IS NULL OR efectivo_cobrado >= 0),
  ADD COLUMN digital_cobrado      numeric CHECK (digital_cobrado IS NULL OR digital_cobrado >= 0);

-- Opcional / mejora futura (etapa 2):
-- ADD COLUMN digital_breakdown jsonb;
```

**Convivencia con campos históricos (sin perder significado):**

| Campo | Significado | Estado |
|---|---|---|
| `total_facturado` | BASE salarial del día | **Sin cambios** |
| `sueldo` | Comisión devengada sobre BASE | **Sin cambios** |
| `efectivo` | BASE cobrada en efectivo (legacy) | **Sin cambios** |
| `mp` | BASE cobrada por método electrónico (legacy) | **Sin cambios** |
| `recargos_total` | Suma de recargos cobrados ese día | NUEVO obligatorio |
| `total_cobrado` | Total real entrado a caja | NUEVO obligatorio |
| `efectivo_cobrado` | Efectivo real (snapshot) | NUEVO obligatorio |
| `digital_cobrado` | Digital agregado real (snapshot) | NUEVO obligatorio |

**Reglas de uso:**
- Sueldos / facturación base → `total_facturado`, `sueldo`, `efectivo`, `mp` (intactos).
- Arqueo y vista de cierre → `efectivo_cobrado`, `digital_cobrado`, `recargos_total`, `total_cobrado` (snapshot leído tal cual, sin recálculos).
- Histórico previo a la migración: backfill setea `recargos_total = 0`, `total_cobrado = total_facturado`, `efectivo_cobrado = efectivo`, `digital_cobrado = mp`.

**RLS**: patrón estándar de la org (owner/GM/manager full, barber lectura propia donde aplique) en ambas tablas nuevas.

---

### 2. Cambios en código

**`src/types/barbershop.ts`**
- `PaymentMethod = 'efectivo' | 'mercado_pago' | 'transferencia' | 'debito' | 'credito'`.
- `Transaction`: agregar `recargoTotal`, `totalCobrado`. `total` sigue siendo BASE.
- `payments[]`: `{ method, amount, recargoPct, recargoMonto, basePago }` con `amount = basePago + recargoMonto`.
- Helper `getMethodLabel(m)` → `'QR'` para `mercado_pago`.

**Nuevo hook `src/hooks/usePaymentMethodsConfig.ts`**
- Resuelve config con **default sano**: si no hay fila en `sucursal_payment_settings` para la sucursal, asume `usar_config_general = true`.
- Si `usar_config_general = true` lee filas con `sucursal_id IS NULL`; si `false`, lee filas con `sucursal_id = X` con fallback a general por método si falta override.
- Devuelve `{ methods: [{ id, label, activo, recargoPct }], getRecargoPct(method) }`.

**`src/components/PaymentRegistration.tsx`** — UI mínima
- Selector de métodos con labels (QR, Efectivo, …).
- Resumen visible:
  ```
  Subtotal:                $X.XXX
  Descuento:              −$X.XXX
  Recargo (QR 10%):       +$X.XXX     ← sólo si recargo > 0
  ─────────────────────────────────
  Total a cobrar:          $X.XXX
  ```
- Sin fila "Base".
- Mixto: cajero ingresa porciones de BASE; el sistema muestra junto a cada input el monto final con recargo si aplica (`$7.000 → $7.700`).

**`src/hooks/useTransactions.ts`**
- `addTransaction`: por pago calcular `basePago`, `recargoMonto = round(basePago * recargoPct/100)`, `montoCobrado`. Persistir `venta.total_final = sum(basePago)`, `venta.recargo_total = sum(recargoMonto)`, `venta.total_cobrado = total_final + recargo_total`. `venta_pagos.monto = montoCobrado` + `base_pago`, `recargo_pct`, `recargo_monto`.
- `loadTransactionsByDate`: `tx.total = total_final` (BASE), exponer `recargoTotal`, `totalCobrado`. Backward compat con ventas históricas.

**`src/hooks/useCashClosing.ts`** — persistir el snapshot completo
- Calcular en el momento del cierre:
  - `total_facturado = sum(tx.total)` (BASE) — sin cambios.
  - `efectivo` = BASE en efectivo — sin cambios.
  - `mp` = BASE en electrónico (legacy) — sin cambios.
  - `sueldo = total_facturado * commissionPct / 100` — **sin cambios**.
  - **Nuevos snapshots obligatorios**:
    - `recargos_total = sum(tx.recargoTotal)`.
    - `efectivo_cobrado = sum(payments[m=efectivo].amount)`.
    - `digital_cobrado = sum(payments[m∈{mercado_pago,transferencia,debito,credito}].amount)`.
    - `total_cobrado = efectivo_cobrado + digital_cobrado`.
- Todo se guarda en la fila de `ingresos`. **No hay cálculo posterior** sobre `venta_pagos`.

**`src/components/DailySummary.tsx` y vistas de cierre histórico** — UI simple
```
Efectivo:        $X.XXX     ← efectivo_cobrado
Digital:         $X.XXX     ← digital_cobrado
─────────────────────
Total facturado: $X.XXX     ← total_facturado (BASE)
Recargos:       +$X.XXX     ← recargos_total (sólo si > 0)
Total cobrado:   $X.XXX     ← total_cobrado
```
Comisiones siguen sobre `summary.total` (BASE).

**`src/components/SueldosPanel.tsx`** — **CERO cambios** (visuales y de lógica).

**Nuevo `src/components/config/PaymentMethodsConfig.tsx`**
- Switch "Usar configuración general" (por sucursal) → `sucursal_payment_settings`. Por default ON aunque no exista fila aún.
- Tabla de 5 métodos con label visible (QR, Efectivo, …): switch activo + input `%` recargo.
- Persistencia inline en `payment_methods_config` (general u override según contexto).

**`src/components/SucursalTabContent.tsx`** y **`src/components/OrganizationSettings.tsx`**
- Insertar `<PaymentMethodsConfig sucursalId={...} />` (override por sucursal) y `<PaymentMethodsConfig sucursalId={null} />` (general en Mi Negocio).

---

### 3. Seed de configuración inicial

**Organizaciones nuevas (requisito formal del onboarding):**

Cada organización nueva nace con la configuración general completa:
- 5 filas en `payment_methods_config` con `sucursal_id IS NULL`:
  - `efectivo` — activo, recargo_pct = 0
  - `mercado_pago` — activo, recargo_pct = 0 (visible como QR)
  - `transferencia` — activo, recargo_pct = 0
  - `debito` — activo, recargo_pct = 0
  - `credito` — activo, recargo_pct = 0

Implementación: extender la lógica de creación de organización (trigger `handle_new_user` o función equivalente) para insertar estas filas de forma atómica con la creación de la org.

No se crean filas de `sucursal_payment_settings` por defecto: el default por ausencia ya cubre el caso ("usar general").

**Organizaciones existentes (backfill simple, una sola vez):**

Migración única que inserta la config general por defecto para toda org que aún no tenga filas. Luego se puede ajustar desde la UI.

```sql
INSERT INTO payment_methods_config (organization_id, sucursal_id, metodo_pago, activo, recargo_pct)
SELECT o.id, NULL, m, true, 0
FROM organizations o
CROSS JOIN unnest(ARRAY['efectivo','mercado_pago','transferencia','debito','credito']) m
WHERE NOT EXISTS (
  SELECT 1 FROM payment_methods_config pmc
  WHERE pmc.organization_id = o.id AND pmc.sucursal_id IS NULL
);
```

No se hace backfill de `sucursal_payment_settings`: el default por ausencia las hace usar la general automáticamente.

---

### 4. Migración de datos (idempotente)

```sql
-- Backfill ventas
UPDATE venta
   SET recargo_total = COALESCE(recargo_total, 0),
       total_cobrado = COALESCE(total_cobrado, total_final);

-- Backfill pagos
UPDATE venta_pagos
   SET base_pago     = COALESCE(base_pago, monto),
       recargo_pct   = COALESCE(recargo_pct, 0),
       recargo_monto = COALESCE(recargo_monto, 0);

-- Backfill cierres (snapshot obligatorio)
UPDATE ingresos
   SET recargos_total    = COALESCE(recargos_total, 0),
       efectivo_cobrado  = COALESCE(efectivo_cobrado, efectivo),
       digital_cobrado   = COALESCE(digital_cobrado, mp),
       total_cobrado     = COALESCE(total_cobrado, total_facturado);
```

---

### 5. Garantías y notas

**Lo que NO cambia:**
- Significado de `venta.total_final`, `ingresos.total_facturado`, `ingresos.sueldo`, `ingresos.efectivo`, `ingresos.mp`. Todos siguen siendo BASE.
- `SueldosPanel`, `MultiDayClosingSummary`, comisión equipo, bono fijo, sueldos fijos: 0 impacto.
- Reportes que leen `total_final` o `total_facturado`: idénticos.

**Robustez de DB añadida:**
- FKs a `organizations` y `sucursales` con `ON DELETE CASCADE` en las tablas nuevas.
- CHECKs en `recargo_pct` (0–100), `recargo_total`/`recargo_monto`/`base_pago`/`*_cobrado` (≥ 0), y lista cerrada de `metodo_pago` en `payment_methods_config` y `venta_pagos`.
- Índices únicos parciales que garantizan unicidad sin `COALESCE`.

**Default por ausencia en `sucursal_payment_settings`:**
- Sin fila ⇒ `usar_config_general = true`. Aplica en hook, UI de configuración (switch en ON por default) y cualquier consumidor.

**Cierre como foto persistida:**
- `efectivo_cobrado`, `digital_cobrado`, `recargos_total`, `total_cobrado` se calculan **una sola vez al cerrar** y se guardan en `ingresos`. La vista de cierre lee snapshot, no recalcula.
- `digital_breakdown` queda como campo opcional para etapa 2.

**Naming visible:**
- `mercado_pago` se renderiza como **"QR"** en toda UI. Helper centralizado.

**UI cierre:** efectivo + digital (digital agrega QR + transferencia + débito + crédito).

**Pagos mixtos (UX clara):**
- Internamente: prorrateo BASE → recargo por método → suma.
- En UI: cada input muestra `$base → $cobrado` cuando hay recargo, total a cobrar destacado.

---

### Orden de implementación (incremental)

1. **Migración DB**: tablas nuevas con FKs/CHECKs/índices únicos parciales + ALTERs con CHECKs en `venta`, `venta_pagos`, `ingresos` + RLS.
2. **Seed automático**: extender `handle_new_user` para crear `payment_methods_config` por defecto en orgs nuevas.
3. **Backfill orgs existentes**: insert idempotente de config general.
4. `usePaymentMethodsConfig` (con default por ausencia) + tipos + helper `getMethodLabel` + extender `useTransactions`.
5. UI mínima en `PaymentRegistration`.
6. UI de configuración en Mi Negocio (general + por sucursal con toggle, switch ON por default).
7. `useCashClosing` persiste snapshot completo; vistas de cierre leen snapshot.
8. Smoke test: cobrar con cada método, split mixto con recargo, descuentos restringidos, cerrar caja, **verificar `ingresos.sueldo` idéntico al previo** y que el cierre muestre exactamente el snapshot guardado.

