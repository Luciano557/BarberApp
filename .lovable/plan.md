

## Resumen

5 ajustes al plan de pulido UX: fix timezone en Google Calendar, reducir delay de selección, sincronizar selectedSlot, corregir tilde, y animación en success screen.

## Cambios al plan anterior

### 1. `src/lib/dateUtils.ts` — `buildGoogleCalendarUrl`
- Generar fechas en UTC con sufijo `Z`: convertir fecha + hora local a UTC usando el timezone de la organización (disponible via `COUNTRY_TIMEZONES`)
- Formato final: `YYYYMMDDTHHmmssZ`
- La función recibe `timezone` como parámetro opcional; si no se pasa, usa hora local como fallback

### 2. `HorarioStep.tsx` — sin delay fijo
- Al hacer click: feedback visual inmediato (highlight del slot) + llamar `onSelect` directamente sin setTimeout
- El estado `selectedSlot` es puramente visual/transitorio — se setea en el click y el componente se desmonta al avanzar de step
- No hay riesgo de desincronización porque `selectedSlot` es local al componente y no compite con el booking state del stepper — el source of truth es `BookingStepper.booking` que se actualiza via `onSelect`

### 3. `AuthStep.tsx` — tilde corregida
- Copy: "Ya casi terminás. Confirmá tus datos para reservar el turno."

### 4. `BookingStepper.tsx` — success screen con animación
- Wrapper del bloque confirmed: `animate-in fade-in zoom-in-95 duration-300`
- Usar clases de Tailwind CSS animate (ya disponibles via tailwindcss-animate en el proyecto)

### Todo lo demás del plan anterior se mantiene igual

## Orden de implementación
1. Helpers en dateUtils (formatFechaLegible + buildGoogleCalendarUrl con UTC)
2. HorarioStep (selección visual sin delay)
3. AuthStep (copy + inputs mobile)
4. ConfirmacionStep (fecha legible + botón)
5. BookingStepper (success screen animado + calendar)
6. RescheduleFlow + BookingLanding + MisTurnosStep

