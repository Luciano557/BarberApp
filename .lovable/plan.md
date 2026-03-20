

# Fix: Transacciones desaparecen al día siguiente

## Diagnóstico

El problema es un **bug de timezone en las consultas a la base de datos**. Afecta la carga de transacciones, verificación de cierres de caja y resúmenes.

### Causa raíz

Las funciones `getStartOfDayLocal()` y `getEndOfDayLocal()` generan strings **sin zona horaria**:

```text
getStartOfDayLocal(20 marzo) → "2026-03-20T00:00:00"
getEndOfDayLocal(20 marzo)   → "2026-03-20T23:59:59"
```

Pero la columna `fecha_hora` en la tabla `venta` es `timestamp with time zone` (almacena en UTC). Cuando Supabase recibe un string sin timezone, **lo interpreta como UTC**.

Entonces si un barbero registra un corte a las **22:00 hora Argentina** (que es **01:00 UTC del día siguiente**), la transacción se guarda como `2026-03-21T01:00:00+00`. Al consultar el día 20 de marzo, el rango UTC `00:00-23:59` no incluye esa transacción. **Al día siguiente tampoco aparece** porque el usuario consulta el 21 de marzo local, pero la query busca `2026-03-21T00:00:00` a `2026-03-21T23:59:59` UTC, y la transacción cae en `01:00 UTC` del 21... en este caso sí aparecería, pero las del final del día 21 se perderían.

El efecto neto: **las transacciones registradas entre las 21:00 y las 23:59 hora Argentina "desaparecen"** del día en que fueron registradas y aparecen en el día siguiente, o viceversa según la hora.

## Solución

Modificar `getStartOfDayLocal` y `getEndOfDayLocal` para que reciban el timezone de la organización y generen strings con el offset correcto. Así PostgreSQL compara correctamente.

### Cambio 1: `src/lib/dateUtils.ts`

Actualizar las funciones para aceptar un parámetro `timezone` opcional y generar el offset correcto:

```text
getStartOfDayLocal(20 marzo, "America/Argentina/Buenos_Aires")
→ "2026-03-20T00:00:00-03:00"

getEndOfDayLocal(20 marzo, "America/Argentina/Buenos_Aires")  
→ "2026-03-20T23:59:59-03:00"
```

Esto le dice a PostgreSQL: "dame todo entre las 00:00 y 23:59 hora Argentina", que internamente convierte a UTC `03:00 del 20` a `02:59 del 21`.

### Cambio 2: Todos los call sites (6 archivos)

Pasar el `organization.timezone` a las funciones:

- `src/hooks/useTransactions.ts` — cargar ventas y verificar cierre
- `src/hooks/useCashClosing.ts` — verificar duplicados y guardar `created_at`
- `src/hooks/useBackfillClosing.ts` — verificar duplicados y guardar `created_at`
- `src/components/DailySummary.tsx` — verificar barberos con cierre
- `src/components/MultiDayClosingSummary.tsx` — resumen por rango

En cada caso, obtener `organization.timezone` desde `useOrganization()` (ya disponible en la mayoría de estos archivos).

### Detalle técnico

Para calcular el offset desde un timezone IANA (ej: `America/Argentina/Buenos_Aires`), se usará `Intl.DateTimeFormat` nativo del browser:

```typescript
function getTimezoneOffset(date: Date, tz: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'shortOffset',
  });
  // Extraer "+03:00" o "-03:00" del resultado
}
```

No requiere librerías externas.

## Archivos a modificar

- `src/lib/dateUtils.ts` — agregar parámetro `timezone` y cálculo de offset
- `src/hooks/useTransactions.ts` — pasar timezone
- `src/hooks/useCashClosing.ts` — pasar timezone
- `src/hooks/useBackfillClosing.ts` — pasar timezone
- `src/components/DailySummary.tsx` — pasar timezone
- `src/components/MultiDayClosingSummary.tsx` — pasar timezone

## Impacto

Este fix corrige de raíz el problema de transacciones que "desaparecen". Todas las consultas por fecha quedarán alineadas con la hora local del negocio, independientemente del dispositivo.

