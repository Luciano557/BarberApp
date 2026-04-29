# Mejoras UX en preview de importación de clientes (v2)

Objetivo: hacer manejable la resolución de errores y duplicados. Solo UI. No se toca RPC, parser de Fresha, parser de plantilla, normalización, agenda ni turnos.

## Archivos afectados

- `src/components/clientes/import/ImportPreviewStep.tsx` — refactor de UI (filtros, vista de duplicados, acciones masivas).
- `src/components/clientes/import/ImportClientesDialog.tsx` — footer accionable + estado `filter` elevado.
- `src/components/clientes/import/ImportMethodStep.tsx` — segunda card pasa a "Importar desde otra aplicación" con `Select`.
- `src/components/clientes/import/MergeDuplicatesDialog.tsx` — sumar callback `onKeepSeparate`.
- Nuevo: `src/components/clientes/import/lib/mergeDuplicates.ts` — helper puro de fusión por criterios Vittro.
- Nuevo: `src/components/clientes/import/DuplicatesGroupView.tsx` — render de grupos duplicados.
- `src/components/clientes/import/lib/parseImportFile.ts` — agregado mínimo aditivo: campo opcional `keepSeparate?: boolean` en `PreviewRow` y `detectInternalDuplicates` lo respeta.

---

## 1. Filtros accionables

Reemplazar las 4 tarjetas Stat por una barra de chips:

- Todas · Listas · Con errores · Duplicados · Descartadas

Cada chip muestra contador. Chip activo destacado (sobrio, sin emojis). Estado local `filter` elevado a `ImportClientesDialog` para que el footer pueda cambiarlo.

Empty state corto cuando un filtro no devuelve filas ("No hay filas con errores", etc.).

## 2. Acciones rápidas para errores

Si hay errores, banda superior breve:

- Texto: "N filas con errores."
- "Ver errores" → activa filtro.
- "Descartar todos los errores" → AlertDialog:

  > "Se descartarán N filas con errores. No se importarán. ¿Continuar?"

Las filas con error siguen siendo editables inline.

## 3. Vista agrupada de duplicados

Cuando `filter === 'duplicates'`, render de `DuplicatesGroupView` en lugar de la lista plana.

Por cada grupo (Card sobria):

- Título: "Grupo #N — {nombre principal}"
- Subtítulo breve: "M filas · coincide por {teléfono|email|teléfono y email}"
- Acción principal: **Ver comparación** (abre `MergeDuplicatesDialog` actual).
- Acción secundaria: **Fusionar con criterios de Vittro**.
- Acción secundaria: **Mantener separados**.
- Acción destructiva (al final, estilo `text-muted-foreground hover:text-destructive`): **Descartar**.

### Confirmaciones (cortas)

- Fusionar grupo:

  > "¿Fusionar este grupo usando criterios de Vittro? Se conservará la fila más reciente y se completarán campos vacíos con datos disponibles."

- Descartar grupo:

  > "Se descartarán X clientes de este grupo. No se importarán."

- Mantener separados grupo: sin confirmación (acción reversible y de bajo riesgo).

## 4. Acciones masivas para duplicados

Barra superior dentro de la vista de duplicados:

- **Fusionar todos con criterios de Vittro** — AlertDialog:

  > "Se fusionarán N grupos. Se conserva la fila más reciente y se completan campos vacíos con datos disponibles. ¿Continuar?"

- **Mantener separados todos** — AlertDialog:

  > "Se mantendrán separados N grupos. Se importarán como clientes distintos."

- **Descartar duplicados** (destructivo, al final) — AlertDialog:

  > "Se descartarán X clientes duplicados. No se importarán. Se conserva una fila por grupo."

## 5. Lógica de fusión (helper puro)

`mergeGroupByVittroCriteria(group: PreviewRow[]): { merged: PreviewRow; discardedIds: string[] }`:

1. Filtrar `!discarded`.
2. Elegir base:
   - Mayor `fecha_cliente_desde` (string `YYYY-MM-DD` comparable).
   - Empate o sin fecha válida → fila con más campos no-vacíos entre los `FIELDS` ya definidos.
3. `merged = { ...base }`.
4. Por campo: si está vacío en `merged`, completar con la primera no-vacía del resto. Si hay conflicto, gana la base.
5. `acepta_marketing`: OR del grupo.
6. Resetear `duplicateGroupId = null`, `discarded = false`, `errors = []`, `warnings = []`. Setear `keepSeparate = true` para que no vuelva a marcarse como duplicado tras la edición. Llamar `validateRow(merged)`.
7. Devolver `merged` y los `rowIds` del resto del grupo (van a `discarded`).

## 6. "Descartar duplicados" masivo

Por cada grupo: elegir ganadora con la misma regla (mayor `fecha_cliente_desde`, desempate por más campos completos). El resto pasa a `discarded`. La ganadora obtiene `duplicateGroupId = null` y `keepSeparate = true`. Se ejecuta `validateRow` por si quedó válida.

## 7. "Mantener separados" (individual y masivo)

Setear `keepSeparate = true` en todas las filas del grupo y limpiar `duplicateGroupId`. Estas filas quedan excluidas para siempre dentro de la sesión actual.

Para que sobreviva a re-detecciones automáticas:

- Agregar al type `PreviewRow` el campo opcional `keepSeparate?: boolean`.
- En `detectInternalDuplicates`: `if (r.discarded || r.keepSeparate) continue`.
- En el `useEffect` de `ImportPreviewStep` que recomputa duplicados al editar, las filas marcadas no se re-evalúan.
- `keepSeparate` no se persiste ni va al payload (`rowToPayload` no lo usa).
- Solo se limpia si el usuario vuelve al paso de método y sube un archivo nuevo (el estado `rows` se reinicia).

## 8. `MergeDuplicatesDialog` (cambios mínimos)

- Sumar botón secundario en el footer: **Mantener separados** → llama nuevo prop `onKeepSeparate(group)`.
- Sin cambios en la lógica interna de elección campo a campo.

## 9. Footer accionable de importación

En `ImportClientesDialog`, cuando hay bloqueos:

- Texto corto: "Hay {N} {error|errores} y {M} duplicado{s} pendientes."
- Botones link/ghost: **Ver errores**, **Ver duplicados** (cambian el `filter` del preview).

`canImport` no cambia: requiere 0 errores activos y 0 duplicados pendientes.

## 10. "Importar desde otra aplicación"

Segunda card de `ImportMethodStep`:

- Título: "Importar desde otra aplicación"
- Subtítulo: "Elegí la app de origen y subí el archivo."
- `Select` "Aplicación de origen" → opciones: Fresha (única por ahora).
- Botón "Subir archivo" (habilitado solo con app elegida).
- Si app === 'fresha' → `onPickFreshaFile(file)` (parser actual, intacto).

## 11. Fuera de alcance

- RPC `import_clientes_with_sucursal`.
- `parseFreshaFile.ts`, `normalize.ts`.
- `parseImportFile.ts` salvo el agregado aditivo de `keepSeparate`.
- Agenda, turnos, WhatsApp, dedupe contra clientes existentes.

---

## Notas de estilo

- Sin emojis. Iconos `lucide-react` ya en uso.
- Tokens semánticos (`muted`, `destructive`, `accent`).
- Confirmaciones con `AlertDialog`, copy directo y corto en castellano rioplatense.
- Acciones destructivas siempre al final del bloque y con confirmación.
