

## Plan: Corregir fecha de cierre, duplicados y agregar timestamp de registro

### Problema
Cuando se cierra la caja de un dia anterior, el sistema guarda `created_at` con la fecha/hora actual del sistema en lugar de la fecha del dia seleccionado. Esto causa:
- El cierre no aparece como "caja cerrada" al ver ese dia
- La validacion de duplicados falla (busca en la fecha equivocada)
- En Sueldos aparece duplicado el mismo dia

Ademas, el usuario quiere saber **cuando fue realizado** el cierre (no solo la fecha del dia comercial).

### Solucion

#### 1. Migracion: agregar columna `closed_at` a `ingresos`
- Nueva columna `closed_at TIMESTAMPTZ DEFAULT now()` que registra el momento real en que se hizo el cierre
- Esto separa dos conceptos: `created_at` = fecha del dia comercial, `closed_at` = cuando se ejecuto la accion

#### 2. Limpieza de datos
Marcar el registro duplicado de Sebastian Tello como eliminado:
```sql
UPDATE ingresos SET estado = 'eliminado' WHERE id = 600;
```

#### 3. Corregir `useCashClosing.ts`
- Cambiar `created_at` de `new Date().toISOString()` a la fecha del dia comercial seleccionado usando `getEndOfDayLocal(date)`
- Agregar `closed_at: new Date().toISOString()` para guardar cuando se realizo el cierre

#### 4. Corregir `DailySummary.tsx` - migrar de nombres a UUIDs
- En `checkClosedBarbers`: cambiar la query de `.select('id, barbero')` a `.select('id, barbero_id')` y filtrar por `barbero_id` en vez de `barbero`
- Actualizar el `Set` y el `Map` para usar `barbero_id` como clave
- Cambiar `closedBarbers.has(barber.barberName)` a `closedBarbers.has(barber.barberId)` en las lineas 117, 394 y 400
- Llamar a `checkClosedBarbers()` despues de un cierre exitoso para refrescar el estado inmediatamente

#### 5. Mostrar fecha de registro en `CashClosingHistory.tsx`
- Agregar `closed_at` al SELECT de la query
- Mostrar debajo de cada registro una linea con "Registrado el [fecha y hora]" cuando `closed_at` difiera de `created_at`, para que el usuario sepa exactamente cuando se ejecuto el cierre

### Detalle tecnico

| Campo | Significado | Ejemplo |
|-------|-------------|---------|
| `created_at` | Fecha del dia comercial | 2026-02-10T23:59:59 (lunes 10) |
| `closed_at` | Momento real del registro | 2026-02-11T14:30:00 (martes 11 a las 14:30) |

Archivos modificados:
- Nueva migracion SQL (agregar `closed_at`, limpiar duplicado)
- `src/hooks/useCashClosing.ts`
- `src/components/DailySummary.tsx`
- `src/components/CashClosingHistory.tsx`

