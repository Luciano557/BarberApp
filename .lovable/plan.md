

# Resumen de cierres por rango de fechas + Fix build error

## Build error
En `src/hooks/usePinProtection.ts` línea 23, `NodeJS.Timeout` no es reconocido en el entorno del browser/Vite. Se reemplaza por `ReturnType<typeof setTimeout>`.

## Feature: Resumen multi-día

Agregar un botón "Resumen por rango" en la sección de Cierre de Caja que abra un dialog donde el usuario selecciona un rango de fechas (desde/hasta). Al confirmar, se consultan los cierres de `ingresos` en ese rango y se muestra un resumen agrupado por barbero con:
- Total efectivo
- Total Mercado Pago
- Total facturado
- Comisión total
- Cantidad de servicios

### Cambios técnicos

#### 1. `src/hooks/usePinProtection.ts`
- Línea 23: cambiar `NodeJS.Timeout` por `ReturnType<typeof setTimeout>`

#### 2. `src/components/MultiDayClosingSummary.tsx` (nuevo)
Componente con:
- Dialog activado por botón "Resumen por rango"
- Dos date pickers (Desde / Hasta)
- Consulta a `ingresos` filtrando por `created_at` en el rango, `estado != 'eliminado'`
- Agrupa resultados por `barbero_id` + `barbero`
- Muestra cards por barbero con totales de efectivo, MP, facturado, comisión y servicios
- Card final con totales generales
- Protegido por PIN (usa el mismo patrón existente)

#### 3. `src/components/DailySummary.tsx`
- Importar y agregar el botón `MultiDayClosingSummary` en la barra de acciones junto a "Historial"

