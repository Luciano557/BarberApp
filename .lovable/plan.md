# Fix Mi Negocio: tabs vuelven a General + handlers globales seguros

## Diagnóstico

Dos problemas se combinan:

1. **Acoplamiento tab ↔ `currentSucursal`** en `MiNegocioPanel.tsx`:
   - `computedDefault` deriva la tab inicial de `currentSucursal`. Si éste es `null`, default = `__general__`.
   - Un `useEffect` llama `setCurrentSucursal(null)` al entrar a General, lo que `SucursalContext.setCurrentSucursal` **persiste como `default_sucursal_id = null` en `profiles`**. En cualquier remount/refresh el panel arranca con `currentSucursal = null` y vuelve a `__general__`.

2. **Handlers de catálogo dependen de `currentSucursal`** en `useSupabaseData.ts`:
   - `updateService`, `updateExtra`, `updateDiscount`, `setDiscountActive` ramifican por `sucursalId = currentSucursal?.id`. Si la tab es General pero `currentSucursal` aún apunta a una sucursal, esos handlers ejecutan RPCs `set_*_sucursal_*` y modifican `servicios_sucursales` / `extras_sucursales` / `descuentos_sucursales` en vez de la tabla global.
   - Lo mismo aplica a `addService`, `addExtra`, `addDiscount` para campos como `active`/`price`/branch row lookup.

Por eso el fix necesita **dos cosas**: desacoplar la tab y proveer handlers globales explícitos que ignoren `currentSucursal`.

## Cambios

### 1. `src/hooks/useSupabaseData.ts` — exponer handlers globales

Agregar nuevos handlers que **nunca** miran `sucursalId` ni tocan tablas `*_sucursales` ni RPCs de sucursal. Solo escriben en las tablas globales.

- `addServiceGlobal(service)`:
  - Insert en `servicios` con `nombre`, `linea_id`, `duracion_min`, `activo: service.active ?? true`, `precio: 0`, `sucursal_id: null`, `organization_id`.
  - Si hay un trigger que crea filas en `servicios_sucursales`, no interferimos: no aplicamos precio ni active por sucursal.
  - Refrescar state global agregando el row nuevo (sin enrich por sucursal).

- `updateServiceGlobal(id, updates)`:
  - Actualiza en `servicios` solo: `nombre` (normalizado), `linea_id`, `duracion_min`, `activo` (cuando viene `updates.active`).
  - **Nunca** toca precio ni RPCs de sucursal.
  - Merge en `services` state: `name`, `lineId/lineName`, `durationMin`, `globalActive`, y recalcular `active = globalActive && (branchActive ?? true)`.

- `addExtraGlobal(extra)` / `updateExtraGlobal(id, updates)`: análogo a servicios pero sobre `extras` (campos: `nombre`, `activo`).

- `addDiscountGlobal(discount)`:
  - Insert en `descuentos` con todos los campos globales (label, valor, tipo, redondeo, redondeo_unidad, metodo_pago, aplica_a, activo: true, organization_id).
  - No mira `sucursalId`.
  - Push al state global.

- `updateDiscountGlobal(id, updates)`:
  - Update en `descuentos` con: `nombre`, `valor`, `tipo`, `redondeo`, `redondeo_unidad`, `metodo_pago`, `aplica_a`, `activo` (si viene `updates.active`).
  - **Nunca** toca `descuentos_sucursales`.
  - Merge en state.

- `setDiscountActiveGlobal(id, activo)`:
  - Update directo en `descuentos.activo`. Sin RPC de sucursal.
  - Merge en state: `globalActive`, recalcular `active = globalActive && (branchActive ?? true)`.

- `deleteDiscountGlobal(id)`:
  - Llama `setDiscountActiveGlobal(id, false)` (mantiene política de soft delete).

Exportar todos en el return del hook.

`addLine` / `updateLine` ya son globales: se reutilizan tal cual.

### 2. `src/components/MiNegocioPanel.tsx` — fix de tabs

a) **Estado de tab desacoplado** y persistido por organización:

```ts
const storageKey = organization?.id
  ? `vittro:miNegocio:activeTab:${organization.id}`
  : null;
```

b) **Inicialización de `activeTab`** (corre una sola vez cuando `activeTab === ''` y `organization` está listo):

- Leer `localStorage[storageKey]` si existe.
- Validar que la tab guardada sea usable:
  - Si es `__general__`: válido sólo si `showGeneralTab`.
  - Si es id de sucursal: válido sólo si está en `visibleSucursales`.
- Si guardada inválida o ausente, aplicar default:
  - Manager: primera `visibleSucursales` (no ve General).
  - Owner/GM:
    - si `currentSucursal` está en `visibleSucursales` → su id;
    - si no, primera `visibleSucursales`;
    - si no hay sucursales → `__general__`.
- Nunca defaultear a `__general__` solo porque `currentSucursal === null`.

c) **Handler único de cambio de tab** (reemplaza el `useEffect` de sincronización, que se elimina):

```ts
const handleTabChange = (value: string) => {
  setActiveTab(value);
  if (storageKey) localStorage.setItem(storageKey, value);
  if (value === GENERAL_TAB) {
    // NO llamar setCurrentSucursal(null): evita persistir default_sucursal_id = null
    return;
  }
  if (currentSucursal?.id !== value) {
    setCurrentSucursal(value);
  }
};
```

`<Tabs value={activeTab} onValueChange={handleTabChange}>`.

d) **`generalIsReady`** pasa a depender solo de la tab activa:

```ts
const generalIsReady = activeTab === GENERAL_TAB;
```

e) **Pasar handlers globales** al `MiNegocioGeneralTabContent` en lugar de los del catálogo por sucursal:

- `onAddService={addServiceGlobal}`
- `onUpdateService={updateServiceGlobal}`
- `onAddExtra={addExtraGlobal}`
- `onUpdateExtra={updateExtraGlobal}`
- `onAddDiscount={addDiscountGlobal}`
- `onUpdateDiscount={updateDiscountGlobal}`
- `onDeleteDiscount={deleteDiscountGlobal}`
- `onToggleDiscountActive={setDiscountActiveGlobal}`
- `onAddLine={addLine}` (ya es global).

Para `services`/`extras`/`discounts` la tab General sigue recibiendo `allServices`/`allExtras`/`discounts` que ya muestran datos globales.

Las tabs por sucursal (`SucursalTabContent`) se mantienen exactamente igual, usando los handlers actuales (`addService`, `updateService`, etc.) que sí usan `currentSucursal`. No se tocan.

### 3. `src/components/MiNegocioGeneralTabContent.tsx` — ajuste menor

- `isReady` ahora viene como `activeTab === GENERAL_TAB`. La semántica del `guarded` se mantiene (bloquear si `!isReady`), pero ya no espera sincronización de `currentSucursal`. En la práctica `isReady` será `true` salvo durante el primer paint inicial.
- Como los handlers que llegan ya escriben siempre global, el `guarded` deja de ser crítico para correctness. Lo dejamos como salvaguarda por si algún consumidor futuro pasara handlers no-globales por error.

## Resultado esperado

- Owner / GM ven General + sucursales y pueden navegar libremente entre ellas.
- Click en sucursal mantiene la sucursal seleccionada; no rebota a General.
- La última tab elegida se recuerda por organización vía `localStorage`.
- Entrar a General no persiste `default_sucursal_id = null`.
- Manager sigue sin ver General y arranca en su sucursal.
- Mutaciones en General escriben **siempre** en tablas globales (`servicios`, `extras`, `descuentos`, `lineas`, `productos` vía `ProductosGlobalConfig`), sin tocar `*_sucursales` ni RPCs de sucursal.
- Tabs de sucursal y `SucursalTabContent` quedan idénticos.
- No se tocan: `SucursalTabContent`, `CobrarConfig`, `PaymentRegistration`, `ProductoPickerDialog`, `useTransactions`, RLS, edge functions, módulos de stock/agenda/cierres.

## Archivos a modificar

- `src/hooks/useSupabaseData.ts` — agregar handlers globales (`addServiceGlobal`, `updateServiceGlobal`, `addExtraGlobal`, `updateExtraGlobal`, `addDiscountGlobal`, `updateDiscountGlobal`, `setDiscountActiveGlobal`, `deleteDiscountGlobal`) y exportarlos.
- `src/components/MiNegocioPanel.tsx` — desacoplar tab, persistir en localStorage, eliminar effect que llama `setCurrentSucursal(null)`, cablear handlers globales a la tab General.
- `src/components/MiNegocioGeneralTabContent.tsx` — ajuste menor de semántica de `isReady`.

Aprobá y paso a default mode para implementar.
