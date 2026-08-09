# Turnos en tiempo real (Agenda interna + Cobrar)

Que los turnos se actualicen solos cuando otra persona crea, edita, mueve o cancela un turno, sin tener que refrescar la pantalla.

## Alcance

- Agenda interna (`AgendaPanel`, dentro de Turnos).
- Vista de turnos del día dentro de Cobrar (`DailyTurnosViewer`).
- Comportamiento: al detectar un cambio, la vista vuelve a pedir los datos del rango visible y se actualiza sola, sin avisos ni banners.

Fuera de alcance: bloqueos de agenda, servicios, horarios, notificaciones y cualquier cambio de lógica de negocio o de permisos.

## Cambios

### 1. Base de datos (una migración)

- Agregar `turnos` a la publicación de Realtime.
- Pasar `turnos` a REPLICA IDENTITY FULL, para que los eventos de edición y borrado traigan la fila completa (sucursal, fecha, estado) y no solo el id.

No se tocan las políticas de acceso: Realtime ya las respeta y filtra por organización y sucursal según el rol de cada usuario. No se tocan los triggers existentes.

### 2. Hook de suscripción reutilizable

Nuevo `src/hooks/useTurnosRealtime.ts`, calcado del patrón ya usado en `src/hooks/useBarberosSucursalesRealtime.ts`:

- `useEffect` con guard, nombre de canal único, tres `.on('postgres_changes', ...)` (INSERT / UPDATE / DELETE) sobre `public.turnos`, filtro `sucursal_id=eq.<id>`, y `supabase.removeChannel` en el cleanup.
- Con REPLICA IDENTITY FULL el DELETE también puede filtrarse por sucursal, así que las tres suscripciones van filtradas.
- Un único callback `onChange`, con un pequeño debounce (~300 ms) para no disparar varios refetch seguidos cuando llegan cambios en ráfaga.

### 3. Agenda interna

- `useAgendaData` expone ya `refetch`; se conecta el hook nuevo pasándole `sucursalId` y `onChange: refetch` (envuelto en `useCallback`).
- Salvaguarda: no refrescar mientras hay un turno siendo arrastrado o un diálogo de conflicto abierto; en ese caso el cambio se aplica al cerrar. Evita que la vista se mueva bajo el dedo del usuario.

### 4. Vista dentro de Cobrar

- `DailyTurnosViewer` ya tiene su propio `fetchTurnos`; se le conecta el mismo hook con la sucursal actual y `onChange: fetchTurnos`.

## Detalles técnicos

- Filtro de canal: siempre por `sucursal_id`, porque las dos vistas trabajan sobre una sola sucursal (no existe modo "Todas" en Agenda).
- El refetch reusa las queries actuales (rango de fechas visible en Agenda, día actual en Cobrar), así que el resultado respeta los filtros ya existentes, incluida la exclusión de turnos cancelados.
- No se migra nada a React Query: ambos hooks siguen con `useState` + `useCallback`, igual que hoy.
