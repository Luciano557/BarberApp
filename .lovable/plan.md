
# Fix: Cierre de caja normal solo para el dia actual

## Problema
Cuando navegas a una fecha pasada en "Cierre de Caja" y presionas "Cerrar Caja", el sistema guarda el cierre con la fecha pasada seleccionada (campo `created_at`). Esto provoca que un cierre hecho el miercoles 18/2 quede registrado como martes 17/2.

## Solucion
El boton "Cerrar Caja" solo debe estar disponible cuando estas viendo el dia de hoy. Para cerrar dias pasados, ya existe la herramienta de "Cierre Diferido" (Regularizar dia / BackfillWizard).

## Cambios tecnicos

### `src/components/DailySummary.tsx`
1. **Ocultar boton "Cerrar Caja" en fechas pasadas**: Cuando `isPastDate` es `true`, no mostrar el boton "Cerrar Caja" para ningun barbero. En su lugar, mostrar un mensaje indicando que para cerrar dias anteriores se debe usar la herramienta de cierre diferido.
2. El boton "Cerrar Caja" solo aparecera cuando `isToday(validDate)` sea verdadero.
3. La seccion de backfill (Regularizar dia) seguira apareciendo normalmente para fechas pasadas con cierres faltantes, que es la herramienta correcta para esos casos.

No se requieren cambios en la base de datos ni en otros archivos.
