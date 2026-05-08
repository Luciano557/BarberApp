La migración de base ya fue ejecutada (columna `assignment_scope`, backfill, RLS estricta para barberos). Falta aplicar los cambios de aplicación.

## 1. Hook `src/hooks/useTareas.ts`
- Agregar `assignment_scope: 'individual' | 'team'` al tipo `Tarea` y a `TareaInsert`.
- En `addTarea` (solo cuando `tipo === 'tarea'`):
  - Sin `asignado_a_id`: forzar `assignment_scope = 'team'`, `asignado_a_nombre = 'Todo el equipo'`, `asignado_a_id = null`, `sucursal_id = currentSucursal.id`.
  - Con `asignado_a_id`: `assignment_scope = 'individual'`.
- No tocar recurrencia, peticiones ni resto de la lógica.

## 2. Form `src/components/TareaFormDialog.tsx` (cambios mínimos)
- En el select "Asignar a" agregar como primera opción `Todo el equipo` con value sentinela `__team__`, seleccionado por defecto. Quitar el comportamiento "sin asignar".
- Al confirmar mapear `__team__` a la lógica del hook (id null + scope team + nombre fijo + sucursal del contexto).
- Validaciones inline (crear y editar, tareas y peticiones):
  - Título: requerido, trim, 3–80 chars, contador `n/80`, mensaje inline.
  - Descripción: opcional, trim, ≤500, contador `n/500`, mensaje inline.
- No rediseñar el dialog ni tocar RepeatPicker / CustomRepeatSheet.

## 3. Rediseño `src/components/TareasPanel.tsx`
Reescribir solo la presentación (mantener data, hooks, peticiones, PIN, contadores).

Header sobrio Vittro:
- H1 `Tareas` + subtítulo: "Gestioná las tareas internas del equipo, asigná responsables y revisá el estado de cada pendiente operativo."
- Botón principal a la derecha: `Nueva tarea` o `Nueva petición` según pestaña.

Tabs `Tareas` / `Peticiones` con contadores actuales.

Barra de filtros única (Select de shadcn):
- Estado, Responsable (Todos / Todo el equipo / barberos activos), Fecha, Sucursal (solo si el usuario opera en más de una).

Listado en grilla de `Card`:
- `grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3`.
- Card compacta: título, badge de estado (tokens `status-*` ya existentes), descripción 1–2 líneas, responsable (`Todo el equipo` o barbero), sucursal si aplica, fecha/hora, indicador de recurrencia, acciones según rol.
- Acciones:
  - Completar visible para owner/GM/manager siempre; para barbero solo en tareas individuales asignadas a él. En tareas `team` el barbero no la ve.
  - Eliminar: solo gestores.
  - Iniciar/otros estados: solo si ya existen hoy, no inventar nuevos.

Pestaña Peticiones: cards con misma estética, sin tocar lógica de PIN ni flujo.

Estado vacío: card sobria con texto y CTA cuando aplique.

Eliminar estética iOS: nada de chips redondos tipo Reminders, sheets full-screen, switches Apple, fondos translúcidos exagerados, esquinas extra grandes. Usar `bg-card`, `border`, `text-muted-foreground`, iconos `lucide-react`.

## 4. Memoria
Actualizar `mem://features/tasks/management` y `mem://features/tasks/logic-and-permissions` con: nuevo `assignment_scope`, "Todo el equipo" por defecto, RLS estricta para barberos, y eliminación de la estética iOS.

## Detalles técnicos
- Tipos de Supabase se regeneran solos tras la migración aplicada.
- Para barberos: la query de barberos activos del filtro ya restringe por RLS.
- Para detectar multi-sucursal: usar el contexto/hook actual de sucursales (no introducir nueva fuente).
- No agregar dependencias.
