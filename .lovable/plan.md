# Etapa 2 — Build

Dependencias ya instaladas: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
RPC `reorder_lineas` ya aplicada y tipada en `types.ts`.

## 1. `src/types/barbershop.ts`
- `Line`: agregar `descripcion?: string` y `orden?: number`.
- `Service`: agregar `descripcion?: string`.

## 2. `src/hooks/useSupabaseData.ts`

**Mappers:**
- `dbToLine`: incluir `descripcion: row.descripcion ?? undefined` y `orden: row.orden`.
- `dbToService`: incluir `descripcion: row.descripcion ?? undefined`.

**Fetch:** cambiar `from('lineas').select('*').eq('eliminado', false).order('nombre')` → `.order('orden', { ascending: true }).order('nombre', { ascending: true })`.

**`addLine`:** antes del INSERT, `SELECT MAX(orden) FROM lineas WHERE organization_id = org.id AND eliminado = false`, calcular `nextOrden = (max ?? 0) + 10`, e incluir `orden: nextOrden` + `descripcion: trim || null` (solo si viene en payload).

**`updateLine`:** si `updates.descripcion !== undefined`, mapear a `dbUpdates.descripcion = trim || null`.

**`addService` / `updateService` / `addServiceGlobal` / `updateServiceGlobal`:** si `updates.descripcion !== undefined`, mapear a `dbUpdates.descripcion = trim || null`. Aditivo: sin descripcion en payload, no se toca la columna.

**Nueva `reorderLines(ids: string[])`:**
- Optimistic: reordenar `lines` state (asignar orden 10, 20, 30…).
- `await supabase.rpc('reorder_lineas', { p_org_id: organization.id, p_ids: ids })`.
- Si falla: revertir state + `toast.error`.
- Exportar en el return.

## 3. `src/components/MiNegocioPanel.tsx`
- Desestructurar `reorderLines` del hook y pasar `onReorderLines={reorderLines}` a `MiNegocioGeneralTabContent`.

## 4. `src/components/MiNegocioGeneralTabContent.tsx`
- Agregar prop opcional `onReorderLines?: (ids: string[]) => Promise<void>`.
- Pasarla a `<LinesConfig onReorder={guarded(onReorderLines)} />`.

## 5. `src/components/config/LinesConfig.tsx`

**Descripción en formulario:**
- Estado local `descripcion` (string).
- Init en `startEdit(line)`: `setDescripcion(line.descripcion ?? '')`.
- Reset en `resetForm()`.
- En el DrawerForm, debajo del color:
  ```tsx
  <div className="space-y-2">
    <label className="text-sm font-medium">Descripción (opcional)</label>
    <Textarea maxLength={240} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
      placeholder="Ej: Servicios premium con detalles de terminación." />
    <p className="text-xs text-muted-foreground text-right">{descripcion.length}/240</p>
    <p className="text-xs text-muted-foreground">Este texto se mostrará en tu portal de reservas.</p>
  </div>
  ```
- `handleAdd` y `handleUpdate` pasan `descripcion: descripcion.trim() || undefined`.

**Reorden DnD (solo tab "Activas"):**
- Nueva prop `onReorder?: (ids: string[]) => Promise<void>`.
- Ordenar `active` por `orden` (fallback nombre): `[...lines.filter(l=>l.active)].sort((a,b) => (a.orden??0)-(b.orden??0) || a.name.localeCompare(b.name,'es'))`.
- Envolver lista en `<DndContext sensors={[PointerSensor distance:6, KeyboardSensor coords:sortableKeyboardCoordinates]} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>` + `<SortableContext items={activeIds} strategy={verticalListSortingStrategy}>`.
- `renderLine` se vuelve un componente `SortableLineItem` con `useSortable({id: line.id})`. Handle `GripVertical` a la izquierda (antes del `EntityColorBar`), `cursor-grab`, `aria-label="Reordenar"`, `{...listeners} {...attributes}` solo en el handle (no en toda la fila — preserva el click del botón "opciones").
- `handleDragEnd`: si `over && active.id !== over.id`, calcular `newIds` con `arrayMove`, update optimista local + `await onReorder?.(newIds)`. Si falla, el `reorderLines` del hook ya revierte.
- Solo se monta `DndContext` en tab activas y solo si `onReorder` está definido.

## 6. `src/components/config/ServicesConfig.tsx`

**Descripción en formulario (crear + editar):**
- Estado `descripcion` + `editDescripcion` (mantener separación para alinear con el patrón existente).
- En `handleAdd`: pasar `descripcion: descripcion.trim() || undefined` y resetear.
- En `startEdit`: `setEditDescripcion(service.descripcion ?? '')`.
- En `handleUpdate`: `updates.descripcion = editDescripcion.trim() || undefined`.
- Reset en `onOpenChange={false}` y en cancelar.
- Textarea + contador 240 + texto auxiliar gris, ubicado **debajo de Duración** en ambos bloques (crear y editar), mismo patrón exacto que GastosPanel.

**LineQuickEditPopover:** no se toca (justificado en auditoría).

## Candado (NO TOCAR)
- `Reservar.tsx`, `ServicioStep.tsx`, `BookingStepper.tsx`.
- Edge function `get-org-public`.
- `usePointerDragDrop` y la agenda.
- Lógica de precios/sucursales.
- `LineQuickEditPopover`.

## Verificación post-build
- `tsgo` debe pasar.
- Probar: crear línea nueva → `orden` siguiente; reordenar con drag → persiste; reordenar con teclado (Tab al handle, Space, ↑/↓, Space) → persiste; agregar descripción y guardar; editar descripción existente; vaciar descripción guarda null.

Pasame a build mode y ejecuto.