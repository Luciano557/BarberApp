# Extender módulo Clientes — implementación final

Sin clientes existentes, se agregan los 8 campos nuevos a `clientes` y se reescribe la RPC para aceptar todos los campos opcionales en una sola operación atómica. Frontend alineado con esos campos.

---

## 1. Migración SQL

**ALTER TABLE clientes** — agregar columnas:

| Columna | Tipo | Default | Nullable |
|---|---|---|---|
| `instagram` | text | null | sí |
| `tiktok` | text | null | sí |
| `otra_red_social` | text | null | sí |
| `fecha_nacimiento` | date | null | sí |
| `alergias` | text | null | sí |
| `acepta_marketing` | boolean | `true` | no |
| `bloqueado` | boolean | `false` | no |
| `motivo_bloqueo` | text | null | sí |

**RPC `create_cliente_with_sucursal`** — `DROP` y recrear con nueva firma:

```text
(_nombre text, _apellido text, _sucursal_id uuid,
 _telefono text DEFAULT NULL, _email text DEFAULT NULL,
 _instagram text DEFAULT NULL, _tiktok text DEFAULT NULL,
 _otra_red_social text DEFAULT NULL, _fecha_nacimiento date DEFAULT NULL,
 _alergias text DEFAULT NULL, _acepta_marketing boolean DEFAULT true)
```

- Reordenamos `_sucursal_id` antes de los opcionales para que los demás puedan tener `DEFAULT NULL`.
- Mantiene `SECURITY DEFINER`, validaciones de organización y sucursal, y la inserción atómica en `clientes` + `clientes_sucursales`.
- Strings vacíos se normalizan a `NULL` con `NULLIF(btrim(...), '')`.
- `bloqueado`, `motivo_bloqueo`, `nota_interna` no se aceptan en creación: quedan en sus defaults (`false`, `null`, `null`).

No se tocan policies RLS (las existentes cubren todos los campos del row), ni tablas `clientes_sucursales` ni `turnos`.

---

## 2. Hook `src/hooks/useClientes.ts`

- Extender la interfaz `Cliente` con los 8 campos.
- Tipo `CreateClienteParams` que acepta los nuevos campos opcionales (`acepta_marketing` con default `true`).
- Tipo `ClienteUpdate` que permite actualizar todo lo editable desde el perfil: contacto + redes + `fecha_nacimiento` + `alergias` + `acepta_marketing` + `bloqueado` + `motivo_bloqueo` + `nota_interna`.
- `createCliente`: pasa todos los campos al RPC con la nueva firma de parámetros.
- `updateCliente`: sin cambios estructurales, sólo se amplía el tipo del `patch`.

---

## 3. Formulario `NuevoClienteDialog.tsx`

**Sección principal** (siempre visible):
- Nombre *
- Apellido *
- Teléfono
- Email

**"Más datos (opcional)"** — `Collapsible` cerrado por defecto:
- Instagram (text)
- TikTok (text)
- Otra red social (text libre)
- Fecha de nacimiento (DatePicker shadcn — `Popover` + `Calendar` con `className="p-3 pointer-events-auto"`, botón "Limpiar" para volver a `null`)
- Alergias (Textarea)
- Acepta marketing (Switch, **default `true`**)

**Selector de sucursal**: igual al actual (sólo si `isAllMode` o no hay `currentSucursal`).

Al enviar: trim y conversión de strings vacíos a `null` antes de pasar al hook. `acepta_marketing` se envía siempre.

No se piden: nota interna, origen, fuente, bloqueado, motivo de bloqueo, fecha de creación, fecha de importación.

---

## 4. Perfil `ClienteDetailDialog.tsx`

Reorganizar el cuerpo del modal en secciones editables. Cada sección con su propio botón "Editar / Guardar / Cancelar":

**Datos de contacto**
- Nombre, Apellido, Teléfono, Email

**Redes sociales**
- Instagram, TikTok, Otra red social

**Información personal**
- Fecha de nacimiento (DatePicker con limpiar → `null`)
- Alergias (Textarea)
- Acepta marketing (Switch)

**Estado**
- Bloqueado (Switch)
- Motivo de bloqueo (Textarea — visible cuando `bloqueado === true` o cuando ya hay un valor previo)

**Nota interna** (sección existente, sin cambios)

Se elimina del perfil el bloque "Origen" y "Fecha de creación" para no exponer la detección de origen (punto 8).

Se conserva: badges de sucursales asociadas, estadísticas de reservas, botón WhatsApp como placeholder.

---

## 5. Panel `ClientesPanel.tsx`

Sin cambios funcionales. Sigue:
- Botón "Importar clientes" → toast "Próximamente".
- Botón WhatsApp en cada fila → toast "Próximamente".
- Búsqueda por nombre, apellido, teléfono, email.
- Vista por sucursal activa o consolidada según rol.

---

## 6. Lo que se conserva

- Tab Clientes sin PIN.
- Cliente a nivel organización.
- Relación N:M con sucursales.
- Creación atómica vía RPC.
- Vista por sucursal activa.
- Vista consolidada solo para owner/general_manager.
- Manager y barber limitados por sucursal vía RLS.
- `turnos.cliente_id` nullable.
- Sin importación real, sin WhatsApp funcional, sin deduplicación, sin fusión, sin bloqueo automático de reservas, sin fuente de procedencia.

---

## Detalles técnicos

- **DatePicker con limpiar**: dentro del `PopoverContent`, agregar un `Button variant="ghost" size="sm"` "Limpiar" que llama a `onChange(null)` y cierra el popover. La fecha se persiste en formato ISO `YYYY-MM-DD` (date column).
- **Switch para acepta_marketing**: estado inicial `true` en el form de creación; en edición refleja el valor actual.
- **Switch bloqueado**: al activarse muestra inline el textarea de motivo; al desactivarse se mantiene el motivo guardado salvo que el usuario lo borre manualmente.
- **Tipos Supabase** (`src/integrations/supabase/types.ts`): se regeneran automáticamente al aplicar la migración; el hook usa `as any` puntual sólo en la llamada al RPC mientras se regeneran los tipos del cliente.
