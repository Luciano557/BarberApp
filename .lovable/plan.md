## Objetivo

Hacer el apellido opcional en todo el módulo Clientes (DB, formularios, RPCs, importación) y aplicar los fixes de UX en la preview de importación: scroll en duplicados, filas corregidas sticky en "Con errores", buscador, y limpieza del título de grupos.

---

## 1. Migración de base de datos

Una sola migración con tres cambios:

1. `ALTER TABLE public.clientes ALTER COLUMN apellido DROP NOT NULL;` — no borrar datos.
2. Reemplazar `create_cliente_with_sucursal`:
   - Hacer `_apellido` `DEFAULT NULL`.
   - Quitar el chequeo `IF _apellido IS NULL OR length(btrim(_apellido)) = 0 THEN RAISE 'Apellido obligatorio'`.
   - Agregar validación: `IF (_telefono IS NULL OR btrim(_telefono)='') AND (_email IS NULL OR btrim(_email)='') THEN RAISE 'Teléfono o email obligatorio'`.
   - Insert: `apellido = NULLIF(btrim(COALESCE(_apellido,'')), '')`.
3. Reemplazar `import_clientes_with_sucursal`:
   - Sacar `IF _apellido = '' THEN _apellido := '-'` y guardar `NULL` cuando esté vacío.
   - Agregar tras el chequeo de nombre: `IF _telefono IS NULL AND _email IS NULL THEN _errors := _errors || jsonb_build_object('index', _idx, 'error', 'Teléfono o email requerido'); CONTINUE;`.

Las firmas de las funciones se mantienen (no se rompe el contrato con el frontend).

## 2. Frontend — Nuevo cliente y edición

`src/components/clientes/NuevoClienteDialog.tsx`:
- Quitar la validación bloqueante de apellido.
- Cambiar label `Apellido *` → `Apellido` (sin asterisco).
- Agregar validación: si `!telefono && !email` → toast "Ingresá teléfono o email" y abortar.
- Permitir enviar `apellido` vacío (RPC ya lo aceptará tras la migración).

`src/components/clientes/ClienteDetailDialog.tsx`:
- Línea 178-179: cambiar a "Nombre obligatorio" y validar contacto (teléfono o email). Permitir guardar con `apellido` vacío.
- En las cabeceras `${cliente.nombre} ${cliente.apellido}` usar `[nombre, apellido].filter(Boolean).join(' ')` para evitar el espacio sobrante.

## 3. Importación — `parseImportFile.ts`

- En `PreviewRow` agregar `wasErrored?: boolean`.
- En `validateRow`:
  - Mantener: nombre requerido.
  - Quitar: `if (row.apellido.length > 80) row.errors.push('Apellido supera 80 caracteres');` → pasarlo a `warnings`.
  - Si falta apellido → `warnings.push('Apellido faltante')` (no error).
  - Si no hay teléfono ni email → `errors.push('Falta teléfono o email')`. Quitar el warning duplicado "Sin teléfono ni email".
  - Mantener validaciones de email y fechas como están.
  - Al final: si `errors.length > 0`, setear `row.wasErrored = true` (sticky; no se baja a false).

`parseFreshaFile.ts` (línea 124): si fuerza apellido como error, ajustar a la misma regla (warning "Apellido faltante", no error). Cambio mínimo y aislado, justificado por la nueva validación.

## 4. Importación — `ImportPreviewStep.tsx`

**Filtro "Con errores" sticky**:
- `filteredRows` para `filter === 'errors'`: incluir filas con `errors.length > 0` **o** `wasErrored === true`, en ambos casos `!discarded`.

**Contador**:
- `counts.errores` sigue contando solo `errors.length > 0` (errores reales bloqueantes). Las "corregidas" no inflan el contador.

**Estado visual "Corregido"**:
- Para una fila con `wasErrored && errors.length === 0 && !duplicateGroupId && !discarded`, mostrar badge "Corregido" (verde sutil con `CheckCircle2`) en lugar de "Listo".

**Buscador**:
- Agregar `<Input>` arriba del listado, placeholder "Buscar por nombre, teléfono o email…", `maxLength={80}`. Estado local `query`.
- Filtrar `filteredRows` adicionalmente por match case-insensitive en `nombre`, `apellido`, `telefono`, `email`.
- Pasar `query` también a `<DuplicatesGroupView>`.

**Acción "Conservar con contacto"**:
- Botón en el banner de errores, junto a "Ver errores" / "Descartar errores".
- Al click: para cada fila con `errors.length > 0 && !discarded && nombre && (telefono || email)`:
  - Llamar a `updateRow` (la nueva regla de `validateRow` la dejará sin errores y con warning "Apellido faltante" si corresponde). `wasErrored` ya está marcado.

**Scroll en vista de duplicados**:
- Envolver `<DuplicatesGroupView>` en `<div className="h-[420px] overflow-y-auto rounded-md border p-2">…</div>`. Igual altura que la lista normal.
- En `DuplicatesGroupView`, asegurar que la barra de acciones masivas no use `sticky` interno conflictivo (queda como Card normal dentro del scroll del padre).

## 5. `DuplicatesGroupView.tsx`

- Quitar `Grupo #{i + 1} —` del título. Mostrar solo `principalName`.
- Aceptar prop opcional `query?: string`. Filtrar grupos: incluir solo aquellos donde alguna fila matchea el query en nombre/apellido/teléfono/email.

## 6. `ImportClientesDialog.tsx`

- `<DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">`.
- Envolver el contenido del paso preview en `<div className="flex-1 min-h-0 overflow-y-auto">`.
- `DialogFooter` queda fuera del scroll (sticky por flex), por lo que los botones no se tapan.
- `validRows` y `blockingCount` ya usan `errors.length === 0`, así que las filas corregidas dejan de bloquear automáticamente. Sin cambios funcionales aquí.

---

## 7. Fuera de alcance

No tocar: agenda, turnos, WhatsApp, deduplicación contra clientes existentes, importación final, lógica de fechas, lógica de booleanos, parsers (excepto el cambio mínimo en `parseFreshaFile` y `parseImportFile/validateRow` requerido por la nueva regla de apellido).

---

## Resumen técnico de cambios por archivo

- `supabase/migrations/<nuevo>.sql` — DROP NOT NULL apellido + recrear ambas RPCs.
- `src/components/clientes/NuevoClienteDialog.tsx` — apellido opcional, validar contacto.
- `src/components/clientes/ClienteDetailDialog.tsx` — misma validación, render de nombre completo seguro.
- `src/components/clientes/import/lib/parseImportFile.ts` — `wasErrored`, nuevas reglas en `validateRow`.
- `src/components/clientes/import/lib/parseFreshaFile.ts` — apellido como warning, no error.
- `src/components/clientes/import/ImportPreviewStep.tsx` — filtro sticky, contador, badge "Corregido", buscador, "Conservar con contacto", contenedor con scroll para duplicados.
- `src/components/clientes/import/DuplicatesGroupView.tsx` — sin "Grupo #N", soporte de `query`.
- `src/components/clientes/import/ImportClientesDialog.tsx` — layout flex con scroll interno.
