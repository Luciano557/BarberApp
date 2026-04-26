# Ajustes finales al módulo Clientes

## 1. Base de datos: soft delete

Migración sobre `public.clientes`:

- Agregar columnas:
  - `eliminado boolean NOT NULL DEFAULT false`
  - `eliminado_at timestamptz NULL`
  - `eliminado_por uuid NULL` (sin FK a `auth.users`)
- Índice parcial: `CREATE INDEX clientes_no_eliminados_idx ON clientes (organization_id) WHERE eliminado = false`.

Nueva función RPC `soft_delete_cliente(_cliente_id uuid)`:

- `SECURITY DEFINER`, `search_path = public`.
- Validar `auth.uid()` y que el cliente pertenezca a la misma `organization_id` del usuario.
- Permitir solo a `owner`, `general_manager`, `manager` (no a `barber`).
- Hacer `UPDATE clientes SET eliminado = true, eliminado_at = now(), eliminado_por = auth.uid() WHERE id = _cliente_id AND eliminado = false`.
- No tocar `turnos`, `clientes_sucursales` ni historial.

No se implementa restauración (fuera de alcance).

## 2. Filtrado en el frontend

`useClientes.ts`:

- Agregar campos `eliminado`, `eliminado_at`, `eliminado_por` a la interfaz `Cliente`.
- En `fetchClientes`, agregar `.eq('eliminado', false)` a las dos queries (modo sucursal y modo all).
- En la consulta por sucursal, después de obtener los `cliente_id` desde `clientes_sucursales`, filtrar también con `.eq('eliminado', false)`.
- Nuevo método `deleteCliente(id)` que llama a la RPC `soft_delete_cliente` y refresca la lista.
- Quitar `bloqueado` y `motivo_bloqueo` del tipo `ClienteUpdate` (el bloqueo deja de pasar por update genérico).
- Nuevos métodos:
  - `blockCliente(id, motivo)` — `update` directo con `bloqueado: true, motivo_bloqueo: motivo.trim()`.
  - `unblockCliente(id)` — `update` con `bloqueado: false, motivo_bloqueo: null`.

## 3. Formulario "Nuevo cliente" (`NuevoClienteDialog.tsx`)

Datos principales (en este orden):

- Nombre *
- Apellido *
- Teléfono
- Email
- Fecha de nacimiento (DatePicker con botón Limpiar → `null`)

Sección "Más datos" (cambiar el label, ya no decir "(opcional)"):

- Instagram
- TikTok
- Otra red social
- Alergias
- Acepta marketing (Switch, default `true`)

`fecha_nacimiento` se quita del bloque colapsable y se mueve arriba. La RPC `create_cliente_with_sucursal` ya soporta `_fecha_nacimiento` opcional, no requiere cambios en backend.

## 4. Perfil del cliente (`ClienteDetailDialog.tsx`)

### Reorganizar secciones editables

Eliminar la sección "Estado" del bloque editable. La sección "Información personal" mantiene: Fecha de nacimiento, Alergias, Acepta marketing.

### Bloque "Acciones" al final del perfil

Renderizado al final, antes de "Nota interna" (o como zona de acciones sensibles):

- **Si `cliente.bloqueado === false`**:
  - Botón destructivo discreto "Bloquear cliente".
  - Al click: abre `AlertDialog`/`Dialog` con campo `Textarea` "Motivo del bloqueo" obligatorio.
  - Validar que `motivo.trim().length > 0` antes de confirmar.
  - Confirmar → `blockCliente(id, motivo)` → toast éxito → cerrar modal y refrescar.

- **Si `cliente.bloqueado === true`**:
  - Banner de aviso destacado con `ShieldAlert`: "Cliente bloqueado".
  - Mostrar `cliente.motivo_bloqueo` debajo si existe.
  - Botón "Desbloquear cliente" → `AlertDialog` de confirmación → `unblockCliente(id)`.

El badge "Bloqueado" en el título del diálogo se mantiene como indicador visual.

### Botón "Eliminar cliente"

En el mismo bloque de acciones, separado visualmente:

- Botón destructivo "Eliminar cliente".
- Confirmación con `AlertDialog`: "¿Eliminar a {nombre}? Esta acción ocultará el cliente de la lista. El historial de turnos se conserva."
- Confirmar → `deleteCliente(id)` → toast éxito → cerrar el diálogo de detalle.

Los campos `eliminado`, `eliminado_at`, `eliminado_por` no se muestran ni se editan en ningún formulario.

## 5. Fuera de alcance (no se implementa)

- Restaurar clientes eliminados.
- Bloqueo automático de reservas cuando `bloqueado = true` (sigue siendo solo marca administrativa).
- Importación real, WhatsApp funcional, deduplicación, fusión, fuente de procedencia.

## Archivos afectados

- `supabase/migrations/<nueva>.sql` — columnas soft delete + RPC `soft_delete_cliente` + índice.
- `src/hooks/useClientes.ts` — filtro `eliminado=false`, nuevos métodos `deleteCliente`, `blockCliente`, `unblockCliente`, tipos actualizados.
- `src/components/clientes/NuevoClienteDialog.tsx` — reordenar campos, mover fecha de nacimiento arriba, renombrar sección.
- `src/components/clientes/ClienteDetailDialog.tsx` — quitar sección "Estado" editable, agregar bloque de acciones (bloquear/desbloquear con modal de motivo, eliminar con confirmación).
