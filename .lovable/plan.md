## Plan: Importación de archivos exportados desde Fresha

Extender el flujo de importación de clientes ya existente para soportar archivos `.xlsx`/`.csv` exportados desde Fresha. Solo lectura de archivos: no hay API, OAuth ni sincronización. Toda la lógica posterior (preview editable, validaciones, duplicados internos, fusión, RPC) se reutiliza tal cual.

### 1. Base de datos

Migración sobre `public.clientes`:

```sql
alter table public.clientes
  add column if not exists external_source text,
  add column if not exists external_customer_id text;

create index if not exists idx_clientes_external
  on public.clientes (organization_id, external_source, external_customer_id);
```

Actualizar la RPC `import_clientes_with_sucursal` para aceptar y persistir `external_source` y `external_customer_id` por cada item del JSON. Validación, RLS y atomicidad existentes se mantienen.

### 2. Parser Fresha — `src/components/clientes/import/lib/parseFreshaFile.ts` (nuevo)

- Lee `.xlsx`/`.csv` con XLSX usando `cellDates: true` (igual que el parser actual).
- **Detección de formato**: requiere encabezados mínimos (case-insensitive, trim): `First Name`, `Last Name`, `Mobile Number`, `Email`, `Added`. Si faltan, lanza error con mensaje:
  > "No pudimos reconocer este archivo como exportación de Fresha. Revisá que sea el archivo de clientes exportado desde Fresha."
- **Mapeo Fresha → Vittro** (resultado guardado en el `PreviewRow` interno de Vittro):
  - `First Name` → `nombre`
  - `Last Name` → `apellido`
  - **Teléfono** (regla final): `telefono = Mobile Number` si tiene valor; si `Mobile Number` está vacío y `Telephone` tiene valor, usar `Telephone`; si ambos vacíos, dejar `telefono` vacío (la fila será válida solo si hay `Email`). `Telephone` no se guarda como campo separado, no aparece en la UI ni se crean campos `telefono_alternativo`, `mobile_number` ni `telephone`.
  - `Email` → `email`
  - `Accepts Marketing` (Yes/No) → `acepta_marketing`
  - `Blocked` (Yes/No) → `bloqueado`
  - `Block Reason` → `motivo_bloqueo`
  - `Date of Birth` → `fecha_nacimiento`
  - `Added` → `fecha_cliente_desde`
  - `Comentario` → `nota_interna`
  - `Client ID` → `external_customer_id`
  - Constante: `external_source = 'fresha'`
- Ignora: `Full Name`, `Gender`, `Accepts SMS Marketing`, `Address`, `Apartement Suite`, `Area`, `City`, `State`, `Post Code`, `Referral Source`.
- Reutiliza `normalizeName/Text/Phone/Email/Date/Boolean` y `validateRow` ya existentes.
- Soporta fechas en `YYYY-MM-DD`, `DD/MM/YYYY`, `D/M/YYYY`, `DD-MM-YYYY`, `D-M-YYYY`, `DD.MM.YYYY`, `D.M.YYYY` y serial Excel (ya cubierto por `normalizeDate`). Aplica a `Date of Birth` y `Added`.

### 3. Extender `PreviewRow` y normalizadores

`src/components/clientes/import/lib/parseImportFile.ts`:
- Agregar a `PreviewRow`: `bloqueado: boolean`, `motivo_bloqueo: string`, `external_source: string | null`, `external_customer_id: string | null`.
- Defaults para flujo plantilla Vittro: `bloqueado=false`, `motivo_bloqueo=''`, `external_source=null`, `external_customer_id=null` (no rompe nada existente).
- Actualizar `rowToPayload` para incluir `bloqueado`, `motivo_bloqueo`, `external_source`, `external_customer_id` cuando estén presentes.

`src/components/clientes/import/lib/normalize.ts`:
- Confirmar que `TRUE_TOKENS` incluye `yes`/`y` y `FALSE_TOKENS` incluye `no` (ya está). No requiere otros cambios.

### 4. Validación por fila (luego del mapeo)

Reutiliza `validateRow` existente, ajustando para el caso Fresha:
- `nombre` requerido.
- `apellido` requerido.
- Al menos un dato de contacto: `telefono` (resultante del mapeo Mobile Number → Telephone) **o** `email`.
- `email` debe ser válido si viene.
- Fechas válidas o vacías.
- Booleanos válidos.

Si falta nombre o apellido → error. Si no hay teléfono ni email → error (no warning), para forzar corrección antes de importar.

### 5. UI — `ImportMethodStep.tsx`

Reemplazar la tarjeta "Importar desde otra aplicación (Próximamente)" por una tarjeta activa **"Importar archivo de Fresha"**:
- Icono sobrio (`FileSpreadsheet` o `FileUp`, monocromo).
- Copy: "Subí el archivo de clientes exportado desde Fresha y Vittro mapeará las columnas automáticamente."
- Botón "Subir archivo de Fresha" que acepta `.xlsx,.csv`.
- Nuevo prop `onPickFreshaFile: (file: File) => void`.

### 6. UI — `ImportClientesDialog.tsx`

- Nuevo handler `handleFreshaFile(file)` que llama a `parseFreshaFile`. Si la detección falla, muestra `toast.error` con el mensaje y permanece en el paso `method`.
- En éxito, sigue el flujo idéntico a `handleFile`: setea filas y avanza a `sucursal` o `preview`.
- El resto del flujo (selección de sucursal, preview editable, duplicados internos por email/teléfono normalizados, fusión manual, botón deshabilitado mientras haya errores o duplicados sin resolver, RPC final) se reutiliza sin cambios.

### 7. Importación final

Por cada cliente importado desde Fresha, persistir:
- `origen = 'importado'`
- `fecha_importacion = now()`
- `fecha_cliente_desde = Added`
- `external_source = 'fresha'`
- `external_customer_id = Client ID`
- Resto de campos mapeados.

Sin deduplicación contra clientes existentes, sin modificar clientes existentes, sin tocar agenda ni turnos.

### 8. Verificación

1. Subir archivo Fresha → detección y mapeo correctos.
2. `Mobile Number` vacío + `Telephone` con valor → `telefono` toma `Telephone`.
3. Ambos teléfonos vacíos + `Email` con valor → fila válida.
4. Sin teléfono ni email → fila marcada como error bloqueante.
5. `Added` con serial Excel (ej. 46139) → convertido a `YYYY-MM-DD`.
6. `Accepts Marketing`/`Blocked` Yes/No → booleanos.
7. Preview editable, duplicados internos y fusión funcionan igual.
8. Tras importar, registros con `external_source='fresha'`, `external_customer_id` y `fecha_cliente_desde` poblados.
9. Subir archivo no-Fresha por la opción Fresha → mensaje de error claro.

### Fuera de alcance

API/OAuth Fresha, sincronización, deduplicación o fusión contra clientes existentes, dirección, género, SMS marketing, Referral Source, agenda, turnos, campos `telefono_alternativo`/`mobile_number`/`telephone`.
