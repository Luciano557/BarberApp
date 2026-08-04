# Mover Horarios de trabajo a Mi Negocio

Reubicación 100% de UI y navegación. No se toca la base de datos, ni RLS, ni edge functions, ni la lógica de resolución horario base/override.

## Punto de fricción resuelto

No existe hoy una ficha individual navegable por barbero (en Equipo por sucursal cada barbero es una tarjeta con un drawer de disponibilidad). Por eso se descarta meter horarios ahí: `EquipoSucursalPanel.tsx` no se toca. Todo el horario, sucursal y barberos, vive en una sección propia de la ficha de sucursal.

## Qué ve el usuario al terminar

**Mi Negocio → ficha de Sucursal → nueva sección "Horarios de atención"**
Una card más de la ficha, al mismo nivel que las otras, con la descripción: "Horario de atención de la sucursal y de cada barbero del equipo." Adentro, dos pestañas:

- **Sucursal**: resumen legible del horario base agrupando días con el mismo rango: "Lun a Vie 09:00 a 18:00", "Sáb 09:00 a 13:00", "Dom cerrado". Botón "Editar horario" que abre el panel lateral con el editor completo actual. Si no hay nada cargado: "Todavía no cargaste el horario de atención" con el mismo botón como acción principal.
- **Barberos**: selector de barbero activo con su pill de estado ("Horario propio" / "Usa sucursal"), igual que hoy. Elegido un barbero:
  - Sin horario propio: pill neutro, resumen del horario de sucursal en gris y botón "Crear horario propio" (misma acción actual: copia el horario de sucursal).
  - Con horario propio: pill "Horario propio", resumen en el mismo formato, botón "Editar horario" y acción secundaria "Volver al horario de la sucursal".

**Turnos → Configuración → Configuración de reservas**
Donde hoy está la tarjeta grande, queda una fila compacta: ícono de reloj, título "Horarios de trabajo", texto "Ahora se configuran desde Mi Negocio, en la ficha de cada sucursal" y un botón "Ir a horarios" que lleva a Mi Negocio, abre la pestaña de la sucursal activa y hace scroll con resalte a la sección "Horarios de atención". Reglas de reserva y Ausencias y cierres quedan igual, arriba y abajo de ese bloque.

**Aviso roto**
El aviso "No hay barberos activos" pasa a estar en Mi Negocio, donde el equipo ya está en la misma ficha, así que el botón que hoy solo tira un toast se convierte en un scroll real a la sección Equipo de esa ficha.


## Detalle técnico

### Archivos nuevos
- `src/components/config/horarios/ScheduleSummary.tsx` — resumen en modo lectura, puro presentacional. Props: `horarios: HorarioRow[]`, `emptyLabel?: string`. Agrupa por rango idéntico y devuelve líneas "Lun a Vie 09:00 a 18:00". Sin fetch propio.
- `src/components/config/horarios/useHorariosTrabajo.ts` — hook con el fetch actual de `horarios_trabajo` por `sucursal_id` (misma query, mismo orden), más los derivados que hoy están inline: `sucursalHorarios`, `horariosDeBarbero(id)`, `barbersWithOverride`, `createOverride`, `removeOverride`, `refetch`. Se extrae tal cual del root actual, sin cambiar ninguna consulta.
- `src/components/config/horarios/HorarioSucursalCard.tsx` — tarjeta de la ficha de sucursal: resumen + botón que abre el `DrawerForm` con `ScheduleEditor` (`barberoId = null`).
- `src/components/config/horarios/HorarioBarberoBlock.tsx` — bloque para el drawer de barbero: estado override/base, botones crear/quitar override y apertura del editor (`barberoId = <id>`).
- `src/components/config/HorariosAccesoDirectoCard.tsx` — bloque compacto de acceso directo en Turnos.

### Archivos que se editan
- `src/components/config/HorariosTrabajoSection.tsx` — se conserva el archivo y se le extraen `ScheduleEditor`, `QuickApplyCard` y helpers a `src/components/config/horarios/ScheduleEditor.tsx` (movimiento literal, sin reescribir la lógica de guardado, borrado, validación de solapamiento ni `QuickApplyCard`). El componente root con las dos pestañas se elimina una vez que ya no lo usa nadie.
- `src/components/config/AgendaManagement.tsx` — reemplaza `<HorariosTrabajoSection ... />` por `<HorariosAccesoDirectoCard ... />`. `AgendaConfigSection` y `BloqueosSection` quedan intactos en el mismo orden.
- `src/components/config/SucursalTabContent.tsx` — monta `HorarioSucursalCard` con `sucursalId` y `organizationId`, con `id`/`data-onboarding-id="horarios-section"` para el scroll, y suma la entrada "Horario" al nav de anclas de desktop.
- `src/components/config/EquipoSucursalPanel.tsx` — monta `HorarioBarberoBlock` dentro del drawer del barbero.
- `src/pages/Index.tsx` — nueva función `navigateToMiNegocioHorarios(sucursalId)`, copiando el patrón exacto de `navigateToMiNegocioEquipo`: si ya está en Mi Negocio usa el handle imperativo del panel; si no, deja la clave de sucursal activa y una clave `vittro:miNegocio:highlightHorarios:{orgId}` en localStorage y cambia de pestaña.
- `src/components/MiNegocioPanel.tsx` — agrega `navigateToSucursalHorarios(sucursalId)` al handle imperativo, junto al de Equipo.
- `src/components/config/TurnosAgendaPanel.tsx` — pasa hacia abajo el callback de navegación para que el acceso directo lo pueda disparar.

### Reutilización, no duplicación
`ScheduleEditor` se **mueve** sin modificar su firma (`horarios`, `sucursalId`, `organizationId`, `barberoId`, `onRefresh`). Ya está parametrizado por `barberoId`, así que sirve igual para sucursal y para barbero. Lo único que cambia es quién lo monta y dentro de qué contenedor. El fetch, que hoy vive en el root con las pestañas, pasa al hook para que los dos puntos de montaje compartan la misma consulta y las mismas reglas de override.

### Permisos
El gate actual del horario es el de "Configuración" de Turnos (owner, gerente general, encargado). En Mi Negocio, la ficha de sucursal es visible a más gente, así que el bloque de horarios se envuelve en la misma condición de rol para que nadie gane acceso que hoy no tiene. Es una condición de UI: **no se toca RLS**.

## Validación manual después del build

1. Portal público de reservas: elegir sucursal y servicio, verificar que los días y horarios disponibles son los mismos que antes del cambio.
2. Un barbero con horario propio: confirmar que en el portal sigue mostrando su horario y no el de la sucursal.
3. Quitar y volver a crear un override desde el drawer del barbero, y verificar el efecto en la disponibilidad del portal.
4. Agenda interna: la grilla arranca y termina en las mismas horas.
5. Estadísticas → ocupación: el porcentaje de ocupación del mes en curso no cambia respecto de antes del build.
6. Turnos → Configuración de reservas: el acceso directo abre Mi Negocio en la sucursal correcta y resalta el bloque de horario.
7. Ausencias y cierres y reglas de reserva siguen funcionando desde Turnos.
8. Mobile 393 px: el resumen se lee bien y el editor dentro del panel lateral scrollea sin cortar el footer.

## Candado de alcance

No se tocan:
- `BloqueosSection.tsx` ni `AgendaConfigSection.tsx`.
- Ninguna edge function (`get-availability`, `get-available-dates`, `validate-turno`, `update-turno-internal`).
- La tabla `horarios_trabajo`: sin columnas nuevas, sin migraciones, sin cambios de RLS.
- La lógica de resolución override/base ni las consultas de `useAgendaData.ts`, `useOcupacionData.ts`, `useOcupacionResumen.ts`.
- El comportamiento interno del editor: validaciones, solapamientos, guardado y "aplicar a varios días" se mueven tal cual.

## Criterios visuales del resumen

Tokens semánticos (`muted-foreground`, `border`, `primary`), sin colores directos. Ícono de reloj de lucide, monocromo, sin emojis. Días abreviados en español rioplatense y horas en formato 24 h. Sin card anidada dentro de card: en la ficha de sucursal es una card al mismo nivel que las demás; en el drawer del barbero es un bloque separado por borde, no una card. El botón de edición es secundario (`outline`), no primario.
