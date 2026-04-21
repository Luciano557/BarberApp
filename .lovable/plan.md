

## Plan: agrupar todo lo no-efectivo como "Digital" en Caja

### Diagnóstico — dónde está el bug

`useTransactions.ts` ya agrega correctamente: la variable `totalMercadoPago` que devuelve el summary suma `mercado_pago + transferencia + debito + credito` (line 397-398). El bug es 100% de presentación dentro de `DailySummary.tsx`, que:

1. **Filtra por método exacto `'mercado_pago'`** en la agregación por barbero (`barberSummaries`, lines 192-195) → cobros con débito/crédito/transferencia no entran al total digital del barbero (queda en $0).
2. **Filtra por método exacto `'mercado_pago'`** para construir `barberTransactions.mercadoPago` (lines 93-102) → en el modal "Cerrar Caja" esos cobros no aparecen en ninguna lista.
3. **Suma solo `'mercado_pago'`** en `mpAmt` para el desglose por fila (line 620) y en la sección de transacciones del modal de cierre (lines 782, 818).
4. **Muestra el label "Mercado Pago"** en 3 lugares: card general (435), card por barbero (509), card del modal de cierre (760), título de la sección de transacciones (811).
5. **Detecta "mixto" comparando solo a `efectivo`/`mercado_pago`** → un cobro split efectivo + débito no se reconoce como mixto.

### Cambios a aplicar — solo `src/components/DailySummary.tsx`

**Helpers:** definir un único criterio:

```ts
const isDigital = (m: PaymentMethod) => m !== 'efectivo';
```

(usando el helper `isDigitalMethod` ya existente en `src/types/barbershop.ts`).

**Agregaciones a corregir:**

- `barberTransactions` (lines 87-103): renombrar `mercadoPago` → `digital`; filtrar con `isDigital(p.method)`.
- `barberSummaries` (lines 192-195): sumar `else existing.totalMercadoPago += p.amount` para cualquier método que cumpla `isDigital`. (Mantengo el nombre del campo `totalMercadoPago` en la interfaz interna `BarberSummary` para no propagar el rename a `useCashClosing` y otros lugares; solo cambia el label visible).
- En la lista de transacciones (lines 619-620): `digitalAmt = txPayments.filter(p => isDigital(p.method)).reduce(...)`.
- Sección "Mercado Pago Transactions" del modal de cierre (lines 806-840): renombrar lista a `digital`, sumar todos los digitales.

**Labels visibles a actualizar a "Digital":**

- Line 435 — card general superior.
- Line 509 — card por barbero.
- Line 676 — desglose mixto inline (`Dig. $X` en lugar de `MP $X`).
- Line 760 — card del modal "Cerrar Caja".
- Line 811 — header de la sección de transacciones digitales del modal.

**Iconos:** mantener `CreditCard` (genérico para digital) — ya es apropiado.

### Lo que NO se toca

- `useTransactions`, `useCashClosing`, `useBackfillClosing`, `useBarbershopStore` (este último es legacy local, sin uso real de DB).
- Persistencia: campos `efectivo` y `mp` en `ingresos` siguen guardando lo mismo (BASE efectivo / BASE digital agregado).
- Comisiones, sueldos, `total_final`, `recargo_total`, `total_cobrado`, historial.
- Nombre del campo interno `totalMercadoPago` en `BarberSummary` y en el resumen de `useTransactions` (refactor cosmético costoso, sin valor funcional). Solo cambia lo visible y la lógica de filtrado.

### Verificación

1. Cobro con débito → en card general "Digital" suma; en card del barbero "Digital" suma; en el modal "Cerrar Caja" aparece bajo la sección "Digital".
2. Cobro mixto efectivo + crédito → badge "Mixto" aparece, desglose dice "Ef. $X / Dig. $Y", y aparece en ambas listas del modal.
3. Cobro QR (`mercado_pago`) → sigue contando en "Digital" como antes.
4. En toda la pantalla de Caja no aparece más el texto "Mercado Pago" ni "MP".
5. Sueldos, comisiones y cierres ya guardados siguen idénticos.

