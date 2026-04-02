

## Resumen

7 cambios en Mi Negocio: fix equipo (cargos + invitar sin usuario vinculado), fix placeholder servicios, fix domingo en horarios, renombrar bloqueos, filtrar vencidos, nueva sección "Visualizar agenda".

## 1. Equipo: permitir cargos e invitar sin usuario vinculado

**Problema**: Los checkboxes de "Cargos" y el botón "Invitar" solo se muestran si `linkedUser` existe (línea 449 y 488-500 de EquipoUnificado.tsx). Un barbero recién creado no tiene usuario vinculado.

**Fix en `EquipoUnificado.tsx`**:
- Mostrar botón "Invitar" siempre (sin depender de `hasSystemAccess` que requiere linkedUser). Solo ocultarlo si ya tiene usuario vinculado.
- Para cargos sin usuario vinculado: los cargos se asignan en el formulario de creación/edición (ya funciona en StaffForm). El problema es que en la vista de detalle no se ven. Mostrar badge "Sin invitar — Invitalo para asignar cargos del sistema" pero mostrar el botón Invitar.
- Cambiar línea 488-500: mostrar "Invitar" cuando `!linkedUser` (barbero sin cuenta). Cuando `linkedUser` existe, mostrar "Invitar" solo si no tiene acceso.

## 2. Servicios: placeholder "Tiempo" en vez de "Min"

**Fix en `ServicesConfig.tsx`**:
- Línea 182: cambiar `placeholder="Min"` a `placeholder="Tiempo"`
- Línea 119: cambiar `placeholder="Min"` a `placeholder="Tiempo"`

## 3. Horarios: fix domingo (dia_semana 7 vs constraint 0-6)

**Causa raíz**: La DB tiene `CHECK (dia_semana BETWEEN 0 AND 6)` donde 0=Domingo. Pero la UI usa `DIAS` con Domingo=7 (línea 36). Al insertar dia_semana=7, la DB rechaza.

**Fix**:
- Migración: `ALTER TABLE horarios_trabajo DROP CONSTRAINT ..., ADD CONSTRAINT ... CHECK (dia_semana BETWEEN 0 AND 7)` — o mejor, cambiar a 1-7 en la constraint.
  
  Alternativa más limpia: actualizar la UI para mapear Domingo a 0 al insertar/leer. Pero esto rompería datos existentes (Lunes=1 etc ya insertados como 1-6).

  **Mejor approach**: nueva migración que amplía constraint a `BETWEEN 0 AND 7` para soportar ambas convenciones. Y también actualizar `get-availability` que ya usa 7 para domingo.

- Migración SQL:
```sql
ALTER TABLE horarios_trabajo DROP CONSTRAINT IF EXISTS horarios_trabajo_dia_semana_check;
ALTER TABLE horarios_trabajo ADD CONSTRAINT horarios_trabajo_dia_semana_check CHECK (dia_semana BETWEEN 1 AND 7);
```
  Esto normaliza a 1=Lunes, 7=Domingo (ISO). La edge function ya usa esta convención.

## 4. Renombrar "Bloqueos y excepciones" → "Gestionar ausencias y cierres"

**Fix en**:
- `AgendaManagement.tsx` línea 49: cambiar texto del AccordionTrigger
- `BloqueosSection.tsx` línea 136: cambiar CardTitle
- Botón "Nuevo bloqueo" → "Nueva ausencia"
- Toast "Bloqueo creado" → "Ausencia registrada"
- Texto vacío → "No hay ausencias o cierres registrados"

## 5. Filtrar bloqueos vencidos

**Fix en `BloqueosSection.tsx`**:
- En `fetchBloqueos`, agregar filtro `.gte('fecha_fin', new Date().toISOString().split('T')[0])` para solo traer bloqueos cuya fecha_fin >= hoy.

## 6. Nueva sección "Visualizar agenda"

**Nuevo archivo** `src/components/config/AgendaViewer.tsx`:

- AccordionItem en `AgendaManagement.tsx` con valor "agenda-view"
- Muestra una vista semanal (Lun-Dom) con columnas por barbero activo
- Ribbon de navegación: `< Semana anterior | Lun DD/MM – Dom DD/MM | Semana siguiente >`
- Botón de selector de fecha (datepicker) para saltar a la semana de esa fecha
- Query a tabla `turnos` filtrando por `sucursal_id`, `fecha BETWEEN lunes AND domingo`, estado != 'cancelado'
- Cada turno se muestra como un bloque con hora, cliente y servicio
- Vista compacta tipo lista agrupada por día, con sub-agrupación por barbero

**Props**: `sucursalId`, `organizationId`, `barbers`

**Estructura visual**:
```text
  [< Sem anterior]  Lun 31/03 – Dom 06/04  [Sem siguiente >]  [📅 Ir a fecha]
  
  Lunes 31/03
    Juan Pérez
      09:00 - 09:30 | Carlos M. | Corte clásico
      10:00 - 10:45 | María L.  | Corte + Barba
    Pedro López
      11:00 - 11:30 | Ana R.    | Corte
  
  Martes 01/04
    (sin turnos)
```

## Archivos a modificar

1. **`src/components/config/EquipoUnificado.tsx`** — fix invitar/cargos
2. **`src/components/config/ServicesConfig.tsx`** — placeholder "Tiempo"
3. **`supabase/migrations/nuevo.sql`** — constraint dia_semana 1-7
4. **`src/components/config/BloqueosSection.tsx`** — renombrar + filtrar vencidos
5. **`src/components/config/AgendaManagement.tsx`** — renombrar accordion + agregar AgendaViewer
6. **`src/components/config/AgendaViewer.tsx`** — NUEVO, vista semanal de turnos
7. **`supabase/functions/get-availability/index.ts`** — sin cambios (ya usa 7 para domingo)

