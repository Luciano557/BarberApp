## Plan de corrección

Voy a ajustar solamente la navegación visual de tabs en `MiNegocioPanel.tsx`, manteniendo intacta la UI y la lógica interna de cada sucursal.

### 1. Hacer que `activeTab` sea la única fuente visual
- Mantener `<Tabs value={activeTab} onValueChange={handleTabChange}>` como componente controlado.
- Evitar que `activeTab` se derive nuevamente de `currentSucursal` después de la inicialización.
- No usar `defaultValue` ni agregar `key` dinámicos que remonten el árbol de tabs.

### 2. Separar inicialización de validación
- Inicializar `activeTab` una sola vez por organización.
- Prioridad de inicialización:
  1. tab guardada en `localStorage` si sigue siendo válida;
  2. `currentSucursal` si existe y es visible;
  3. primera sucursal visible;
  4. `General` solo si no hay sucursales visibles y el rol puede verla.
- Después de inicializar, no recalcular la tab activa por cambios normales en `currentSucursal`, `visibleSucursales`, `allSucursales` u `organization`.

### 3. Validar sin volver a General automáticamente
- Agregar una validación defensiva que solo cambie `activeTab` si la tab activa actual dejó de ser válida, por ejemplo:
  - sucursal eliminada/desactivada;
  - cambio de organización;
  - cambio real de permisos.
- Si la tab activa sigue siendo una sucursal visible, no tocarla.
- Si hace falta fallback, priorizar una sucursal visible antes que `General`.
- `General` será fallback únicamente cuando no haya sucursales visibles o cuando la tab guardada explícitamente sea `__general__` y el usuario tenga permiso.

### 4. Handler de cambio de tab estable
- En `handleTabChange(value)`:
  - actualizar `activeTab` inmediatamente;
  - guardar el valor válido en `localStorage` por organización;
  - si `value === '__general__'`, no llamar `setCurrentSucursal(null)`;
  - si `value` es una sucursal válida, llamar `setCurrentSucursal(value)` sin permitir que el delay de esa sincronización revierta la tab visual.

### 5. Readiness de General
- Mantener `MiNegocioGeneralTabContent` listo solamente cuando `activeTab === '__general__'`.
- No depender de `currentSucursal === null` para habilitar la vista General.
- Solo tocar `MiNegocioGeneralTabContent.tsx` si al implementar detecto que la prop de readiness necesita un ajuste menor; si no, queda sin cambios.

## Alcance respetado

Archivos a modificar:
- `src/components/MiNegocioPanel.tsx`

Solo si fuera estrictamente necesario:
- `src/components/MiNegocioGeneralTabContent.tsx`

No voy a tocar:
- `SucursalTabContent`
- `CobrarConfig`
- `ServicesConfig`
- `ExtrasConfig`
- `DiscountsConfig`
- `ProductosGlobalConfig`
- `PaymentRegistration`
- `ProductoPickerDialog`
- `useTransactions`
- `useSupabaseData`
- RLS
- edge functions

## Resultado esperado

- Owner / General Manager pueden navegar libremente entre General y cualquier sucursal.
- Al tocar una sucursal válida, esa tab queda activa y no vuelve sola a General.
- Cambiar entre sucursales no reinicializa `activeTab`.
- Recargar recuerda la última tab válida por organización.
- Manager sigue sin ver General y mantiene el comportamiento actual por sucursal.