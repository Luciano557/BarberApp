

## Resumen

Panel "Gestion de Turnos y Agenda" dentro de cada tab de sucursal en Mi Negocio. 3 secciones: Configuracion, Horarios, Bloqueos. Sin migraciones (tablas existentes). Corregidos los 4 problemas reportados.

## Archivos nuevos

### `src/components/config/AgendaManagement.tsx`
- Contenedor Accordion con 3 secciones
- Props: `sucursalId`, `organizationId`, `barbers`

### `src/components/config/AgendaConfigSection.tsx`
- Fetch/upsert `agenda_config` para la sucursal
- Campos: `duracion_base_min`, `buffer_antes_min`, `buffer_despues_min`, `cancelacion_limite_hs`, `modificacion_limite_hs`, `dias_anticipacion`
- Inputs numericos + boton Guardar con toast

### `src/components/config/HorariosTrabajoSection.tsx`
- **Dos tabs**: "Horario Sucursal" y "Horarios por Barbero"
- **Tab Sucursal**: grilla 7 dias, cada dia con toggle activo + rangos hora inicio/fin + boton agregar rango. Guarda en `horarios_trabajo` con `barbero_id = NULL`. Sin bulk copy, sin dummy IDs.
- **Tab Barberos**: selector de barbero. Al seleccionar uno:
  - Si no tiene registros propios en `horarios_trabajo` → mostrar badge "Usa horario de sucursal" + boton "Crear horario propio"
  - Si tiene registros propios → mostrar grilla editable (misma UI) + boton "Volver a horario de sucursal" (elimina sus registros)
  - Esto da visibilidad clara de quien tiene override y quien no
- Validacion: no permitir rangos solapados en mismo dia

### `src/components/config/BloqueosSection.tsx`
- Lista de bloqueos con info clara por cada uno:
  - Badge "Sucursal" o nombre del barbero
  - Rango de fechas formateado
  - "Todo el dia" o rango horario
  - Motivo
- Formulario crear: fecha inicio/fin, toggle todo_el_dia, hora inicio/fin (si no todo el dia), motivo, selector barbero (opcional, null = sucursal)
- Boton eliminar bloqueo

## Archivo modificado

### `src/components/SucursalTabContent.tsx`
- Agregar seccion "Gestion de Turnos y Agenda" al final
- Renderizar `<AgendaManagement sucursalId={sucursal.id} organizationId={organization?.id} barbers={barbers} />`

## Detalles tecnicos

- Horarios sucursal = `barbero_id IS NULL` en `horarios_trabajo`. Sin dummy, sin bulk.
- El motor de disponibilidad ya soporta este modelo (sucursal base + barbero override)
- `dia_semana`: 1=Lun a 7=Dom
- Queries directas con Supabase client, RLS ya cubre owner/GM/manager
- No se necesitan migraciones

## Orden

1. AgendaConfigSection
2. HorariosTrabajoSection
3. BloqueosSection
4. AgendaManagement (contenedor)
5. Integrar en SucursalTabContent

