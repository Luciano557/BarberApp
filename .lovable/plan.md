

## Diagnóstico

**Dónde falla exactamente:** la inserción en la tabla `venta` falla cuando el método primario es `transferencia`, `debito` o `credito`. La inserción en `venta_pagos` ya funciona (su CHECK acepta los 5).

**Causa raíz (DB, CHECK constraint):**
- Tabla `venta` tiene un CHECK constraint viejo:
  ```
  venta_metodo_pago_check
  CHECK (metodo_pago = ANY (ARRAY['efectivo','mercado_pago']))
  ```
- Tabla `venta_pagos` ya tiene el CHECK correcto con los 5 métodos (`venta_pagos_metodo_pago_valido`).
- Tabla `payment_methods_config` también ya está actualizada con los 5 (`pmc_metodo_pago_valido`).
- **No hay enum** de Postgres involucrado: `metodo_pago` es `text` con CHECK. El "enum" en `types.ts` de Supabase es solo el tipado generado del cliente, derivado del CHECK; se regenera automáticamente al cambiar el CHECK en DB.

**No es problema de:** enum Postgres, RLS, código frontend (`useTransactions` ya manda el método correcto), ni de `venta_pagos`.

## Cambio puntual

**Una sola migración de schema** que reemplaza el CHECK obsoleto en `venta`:

```sql
ALTER TABLE public.venta
  DROP CONSTRAINT venta_metodo_pago_check;

ALTER TABLE public.venta
  ADD CONSTRAINT venta_metodo_pago_valido
  CHECK (metodo_pago = ANY (ARRAY[
    'efectivo','mercado_pago','transferencia','debito','credito'
  ]));
```

- Mismo nombre de constraint nuevo (`venta_metodo_pago_valido`) que el de `venta_pagos` y `payment_methods_config` para mantener consistencia.
- Acepta los 5 métodos válidos del sistema.
- No toca columnas, datos, índices, triggers, ni RLS.
- Las ventas históricas con `efectivo` o `mercado_pago` siguen siendo válidas (están dentro del nuevo conjunto).

## Lo que NO se toca

- `useTransactions`, `useCashClosing`, `SueldosPanel`, comisiones, recargos, historial.
- `venta.total_final` (BASE), `recargo_total`, `total_cobrado`.
- `venta_pagos`, `payment_methods_config` (ya están bien).
- Frontend: ni una línea. El bug es 100% en DB.
- Tipos de Supabase: el archivo `src/integrations/supabase/types.ts` se regenera automáticamente tras la migración, sin intervención manual.

## Verificación post-cambio

1. **DB:** correr
   ```sql
   SELECT conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid = 'public.venta'::regclass
     AND conname LIKE '%metodo_pago%';
   ```
   debe devolver `venta_metodo_pago_valido` con los 5 métodos.

2. **App — flujo manual:** activar transferencia/débito/crédito en *Configuración → Métodos de pago y recargos*, ir a *Cobrar*, registrar una venta con cada uno de los 3 métodos antes rotos. Cada cobro debe persistir sin error y aparecer en *Resumen del día*.

3. **App — split:** registrar venta mixta efectivo + débito (o + transferencia / crédito). Debe guardar correctamente en `venta` y `venta_pagos`.

4. **Historial intacto:** ventas viejas con `mercado_pago` siguen visibles y editables como hasta ahora.

