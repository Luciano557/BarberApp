# Auditoría + Plan — Badge "Cierre desactualizado" en Caja

## Parte 1 — Auditoría

### 1. Dónde se renderiza el badge
- `src/components/DailySummary.tsx` líneas 579–620.
- Se muestra cuando `closedBarbers.has(barber.barberId) && staleByBarber[barber.barberId]`.

### 2. Lógica que marca "desactualizado"
- `src/components/DailySummary.tsx` líneas 320–345 (`staleByBarber`).
- Para cada barbero con cierre, filtra `summary.transactions` cuyo `createdAt > closed_at` y `estado !== 'anulado'`. Si hay al menos una, marca el cierre como desactualizado.
- Compara timestamps absolutos (ms) — no valida que `tx.createdAt` y `closed_at` pertenezcan al mismo día calendario en el timezone de la organización.

### 3. Origen de las fechas comparadas
- `closed_at` viene de `ingresos` cargados en `checkClosedBarbers` (líneas 115–146) usando `validDate` (= `selectedDate`) con `getStartOfDayLocal/getEndOfDayLocal` y el timezone de la organización.
- `summary.transactions` viene de `useTransactions` (`src/hooks/useTransactions.ts`):
  - `selectedDate` se inicializa con `new Date()` UNA sola vez al montar el hook (línea 52).
  - `loadTransactionsByDate(selectedDate)` recarga solo cuando cambia `selectedDate` o `currentSucursal` (líneas 201–203).
  - `addTransaction` agrega la nueva venta al state local sin importar a qué día pertenezca su `fecha_hora`.

### 4. ¿Hay re-cálculo automático al cambiar el día?
- No. Ni `useTransactions` ni `DailySummary` escuchan `visibilitychange`, `focus`, ni un timer de medianoche. El único disparador es cambiar manualmente `selectedDate` (navegación o F5, que re-monta y vuelve a hacer `useState(new Date())`).

### 5. Variable de "día activo"
- `selectedDate` en `useTransactions`. Representa el día de Caja, pero queda congelado al valor con el que montó el hook. Si la app permaneció abierta y cruzó medianoche, sigue apuntando a "ayer" hasta que algo lo cambie.

### Causa raíz del bug
La app abierta el lunes a la noche cierra caja → `closed_at = lunes 22:00`. Pasa la medianoche con la app abierta. El usuario sigue operando el martes: cada nueva venta (`fecha_hora = martes`) entra al state vía `addTransaction`, **pero `selectedDate` sigue siendo lunes**. `staleByBarber` compara `closed_at` del lunes contra `createdAt` del martes y, como martes > lunes 22:00, marca el cierre del lunes como desactualizado. F5 lo arregla porque `useState(new Date())` reinicia `selectedDate` al día real, recarga ventas del martes y deja Caja vacía sin cierres a evaluar.

---

## Parte 2 — Plan de fix (sin tocar lógica de cierres/montos)

Dos capas: la primera resuelve el problema de fondo (rollover de día), la segunda blinda el badge contra cualquier comparación cruzada futura.

### A. Rollover automático del día activo de Caja
Archivo: `src/hooks/useTransactions.ts`.

1. Mantener una ref con el "día de calendario" (en timezone de la organización) correspondiente al `selectedDate` actual.
2. Agregar un `useEffect` que:
   - Suscribe a `document.visibilitychange` y `window.focus`.
   - Programa un timer que se dispara al próximo cambio de día local (calculado vs `organization.timezone`).
   - Cuando se dispara, si `selectedDate` era "hoy" antes del cruce, llama `setSelectedDate(new Date())` para forzar reload de ventas y closures.
3. Importante: solo auto-actualizar si el usuario estaba en el día de hoy. Si navegó a una fecha pasada, no tocar `selectedDate`.

Esto garantiza que tras un cambio de día la lista de transacciones se recargue contra el nuevo día calendario, alineada con los cierres del mismo día.

### B. Blindaje del badge (defensa en profundidad)
Archivo: `src/components/DailySummary.tsx`, función `staleByBarber` (líneas 320–345).

1. Calcular el rango `[startOfDayLocal(validDate), endOfDayLocal(validDate)]` (ya disponibles vía `getStartOfDayLocal/getEndOfDayLocal` + `organization.timezone`).
2. Antes de comparar `createdAt > closed_at`, exigir además que `tx.createdAt` caiga dentro de ese rango. Si no, ignorar la transacción para el cálculo del badge.
3. Mantener intacta la condición original `createdAt > closed_at` y el filtro `estado !== 'anulado'`.

Con esto, aunque por alguna otra ruta queden transacciones de otro día en memoria, el badge no se dispara por comparación cruzada de días.

### Orden de aplicación
1. Aplicar A (rollover) — resuelve el bug reportado en la práctica.
2. Aplicar B (blindaje del badge) — evita reapariciones del falso positivo en escenarios análogos.

### Lo que NO se toca
- Lógica de `saveCashClosing`, `handleVoidClosure`, `handleRegularize`, montos, comisiones.
- Query de `ingresos` ni de `venta`.
- Comportamiento de Caja para el día de hoy (la navegación manual, el cierre, anulaciones y regularizar siguen igual).
- `closed_at`, `createdAt` ni el modelo de datos.

### Riesgos / efectos colaterales
- A puede provocar un reload visible justo después de medianoche si la pestaña vuelve a foco; es el comportamiento deseado y equivale a un F5 automático.
- Si el usuario tenía una venta a medio cobrar al cruzar medianoche, el reload no debe ejecutarse mientras haya un diálogo de cobro abierto: condicionar el auto-rollover a que no esté abierto el flujo de cobrar/cerrar (`closingBarber`, dialogs activos). Verificar al implementar.
- B es puramente un filtro extra; no puede generar falsos negativos para cierres del mismo día (siempre que el TZ usado sea el de la organización, igual que en `checkClosedBarbers`).
