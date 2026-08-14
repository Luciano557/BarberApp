# Barberos comisionables: propiedad derivada en el store de equipo

## Hallazgo previo que cambia el punto de partida

`useBarbershopStore.ts` no tiene ningún consumidor. Es un store local en memoria, sin Supabase, sin ninguna importación en toda la app. La propiedad derivada no puede vivir ahí porque nadie la leería.

El store real de equipo es `useSupabaseData.ts`, que expone `barbers` (activos de la sucursal) y `allBarbers` (todos), y alimenta Resumen, Finanzas/Sueldos, Tareas y Mi Negocio.

## Qué se construye

### 1. Nueva propiedad derivada en `useSupabaseData.ts`

Se agrega `barbersComisionables`: los miembros activos de la sucursal cuyo `roles_equipo` incluye `barber`. Se usa ese criterio y no "rol principal = barbero" porque en producción hay integrantes con multirol real (encargados y dueños que además atienden y cobran comisión); excluirlos les rompería el cálculo de sueldo.

Las propiedades existentes `barbers` y `allBarbers` quedan intactas: hay pantallas que necesitan ver a todo el equipo a propósito (gestión de equipo, tareas, historial).

### 2. Migrar los consumidores que hoy usan la lista sin filtrar para calcular plata

- **Cierre diferido**: `DailySummary.tsx` pasa la lista cruda a `BackfillWizard`; pasa a pasar la lista de comisionables. Es el caso reportado.
- **Sueldos**: `SueldosPanel.tsx` calcula comisión, sueldo fijo, bono y comisión de equipo sobre todo el personal activo. Pasa a recibir la lista filtrada desde `FinanzasPanel`.
- **Historial de cierres**: el selector "filtrar por barbero" en `CashClosingHistory.tsx` lista todo el personal; pasa a listar solo comisionables.
- **Comisión de equipo**: la query de "barberos origen" en `ComisionEquipoConfig.tsx` trae todo el staff activo de la organización; se le agrega el filtro por rol en la propia consulta.
- **Ocupación en Estadísticas**: el conteo de barberos activos que sirve de capacidad instalada en `useEstadisticasData.ts` incluye encargados y otros, deformando el porcentaje; se le agrega el filtro por rol.

### 3. Limpieza

Se elimina `useBarbershopStore.ts` por ser código muerto.

## Qué NO se toca

- `barbers` y `allBarbers` conservan su comportamiento actual: `EquipoUnificado`, `MiNegocioPanel`, `TareasPanel` y `UserManagement` necesitan ver dueños, encargados y "otros" de forma intencional.
- Sin cambios de base de datos, RLS ni edge functions. El filtro es de presentación y cálculo en el cliente.
- Las pantallas que ya filtran bien (Cobrar, Agenda, ranking de Equipo en Estadísticas, portal público) se dejan como están.

## Detalle técnico

- Criterio canónico: `(b.rolesEquipo ?? []).includes('barber')`, ya usado en `useCobrarBarbers.ts:109`, `useEquipoData.ts:73-113`, `useOcupacionResumen.ts:67-101` y `TurnosAgendaPanel.tsx:152-154`.
- `useSupabaseData.ts:119-122` ya normaliza `roles_equipo`; cuando el array viene vacío deriva los roles desde `rol_equipo`, así que el filtro funciona también sobre las filas legadas (hay una fila con `roles_equipo` vacío en producción).
- Los cambios en `ComisionEquipoConfig.tsx:98-113` y `useEstadisticasData.ts:107-129` se hacen en la query, con `.contains('roles_equipo', ['barber'])`, para no traer filas de más.
- La cadena de props a ajustar es `Index.tsx` → `FinanzasPanel` → `SueldosPanel`, y `DailySummary` → `BackfillWizard` / `CashClosingHistory`.
