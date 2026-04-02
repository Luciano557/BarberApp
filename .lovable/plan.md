

## Resumen

3 cambios: fusionar Fecha+Horario en un solo paso, limpiar estado al volver atras, actualizar mensaje de sin disponibilidad.

## Cambio 1: Fusionar FechaStep y HorarioStep en un nuevo `FechaHorarioStep`

Crear `src/components/reservar/FechaHorarioStep.tsx` que combina calendario + grilla de horarios en una sola vista:

- Arriba: calendario (compact) con fecha seleccionada (default: hoy)
- Abajo: grilla de slots disponibles para la fecha seleccionada (se recarga al cambiar fecha, sin avanzar de paso)
- Al seleccionar un slot se avanza al siguiente paso
- Si no hay slots para hoy, mostrar: "No hay turnos disponibles para el dia de hoy. Probá seleccionando otro dia en el calendario."
- Si no hay slots para otra fecha: "No hay turnos disponibles para el [fecha legible]."
- Mantener botones de "Elegir otro barbero" cuando no hay slots
- Props: mismas que HorarioStep actual + sin `onChangeFecha` (ya no hace falta, el calendario esta integrado)

## Cambio 2: Limpiar estado al volver atras

En `BookingStepper.tsx`, modificar `goBack` para resetear los campos del paso al que se vuelve:

```text
goBack():
  if step > 0:
    newStep = step - 1
    resetear campos desde newStep en adelante:
      step 0 (sucursal): limpiar sucursal + servicio + barbero + fecha/hora
      step 1 (servicio): limpiar servicio + barbero + fecha/hora
      step 2 (barbero): limpiar barbero + fecha/hora
      step 3 (fecha+horario): limpiar fecha (reset a hoy) + hora
    setStep(newStep)
```

Tambien actualizar los badges para que solo muestren lo que corresponde al paso actual.

## Cambio 3: Ajustar stepper por fusion

En `BookingStepper.tsx`:

- Steps pasan de 7 a 6 (o 5 si autenticado): Sucursal → Servicio → Barbero → Fecha+Horario → Datos → Confirmar
- Eliminar imports de FechaStep y HorarioStep separados
- Importar nuevo FechaHorarioStep
- `actualStep === 3` renderiza `FechaHorarioStep` (reemplaza steps 3 y 4)
- Steps 4+ se ajustan (auth = 4, confirm = 5)
- Actualizar `STEP_LABELS`, `totalSteps`, `getActualStep`, progress bar
- Badge de fecha+hora: mostrar solo cuando `step > 3` (despues de fecha+horario)

## Archivos

1. **Crear** `src/components/reservar/FechaHorarioStep.tsx` — componente fusionado
2. **Editar** `src/components/reservar/BookingStepper.tsx` — nuevo flujo de pasos + reset al volver
3. `FechaStep.tsx` y `HorarioStep.tsx` quedan sin eliminar (HorarioStep se usa en RescheduleFlow)

