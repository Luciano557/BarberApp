## Cambios

### 1. `src/components/MiNegocioPanel.tsx`
- Eliminar el helper `getDiscountsForSucursal` (filtraba por `d.sucursalId === sucursalId`).
- Eliminar el wrapper `addDiscountForSucursal`.
- Pasar `discounts` (completo) y `addDiscount` (directo) a cada `SucursalTabContent`.

### 2. `src/hooks/useSupabaseData.ts`
- En `addDiscount`, no enviar `sucursal_id` en el insert. Mantener: `organization_id`, `activo: true`, `aplica_a`, `nombre`, `tipo`, `valor`, `metodo_pago`, `redondeo`, `redondeo_unidad`.

### 3. Verificación
- `DiscountsConfig.tsx`: ya filtra solo por `activo` y `aplica_a`. Sin cambios.
- `CobrarConfig.tsx` / `PaymentRegistration.tsx`: no filtran descuentos por sucursal. Sin cambios.
- Fetch `from('descuentos').select('*')`: trae descuentos de la org vía RLS. Sin cambios.

## Resultado
- Los descuentos son globales por organización: visibles en cualquier sucursal.
- Activos/Inactivos y filtro Todos/Servicios/Productos funcionan igual en cualquier tab.
- Desactivar un descuento lo oculta de Cobrar en todas las sucursales; reactivarlo lo vuelve a mostrar.
