## Plan final: Módulo "Clientes"

### Resumen
Nueva tab "Clientes" en la navegación principal entre "Turnos y Agenda" y "Mi Negocio". Base de clientes a nivel organización con relación N:M a sucursales. Acceso por **rol + RLS** (sin PIN). Botón "Importar clientes" y botón WhatsApp solo visuales. Creación atómica vía RPC para evitar clientes huérfanos.

---

### Parte 1 — Base de datos (migración SQL aditiva)

**1.1 Tabla `clientes`** (a nivel organización):
```text
id              uuid pk default gen_random_uuid()
organization_id uuid not null
nombre          text not null
apellido        text not null
telefono        text null
email           text null
origen          text not null default 'manual'
nota_interna    text null
created_at      timestamptz default now()
updated_at      timestamptz default now()
CHECK (origen IN ('manual','importado','reserva'))
```
- Índice por `organization_id`.
- Trigger `update_updated_at_column` para `updated_at`.
- En esta etapa solo se usa activamente `manual`. Los otros valores quedan preparados.

**1.2 Tabla `clientes_sucursales`** (N:M):
```text
id               uuid pk default gen_random_uuid()
organization_id  uuid not null
cliente_id       uuid not null
sucursal_id      uuid not null
origen_relacion  text not null default 'manual'
created_at       timestamptz default now()
updated_at       timestamptz default now()
UNIQUE (organization_id, cliente_id, sucursal_id)
CHECK (origen_relacion IN ('manual','importado','reserva'))
```
- Índices: `(cliente_id)`, `(sucursal_id)`, `(organization_id)`.
- La constraint única solo evita asociar el mismo cliente dos veces a la misma sucursal. **No** garantiza unicidad de identidad en `clientes` (deduplicación queda para más adelante).
- El `CHECK` sobre `origen_relacion` es consistente con los valores permitidos en `clientes.origen`.

**1.3 RPC `create_cliente_with_sucursal` (creación atómica)**

Función `SECURITY DEFINER` que inserta cliente + relación en una sola transacción para evitar clientes huérfanos:

```text
create_cliente_with_sucursal(
  _nombre text,
  _apellido text,
  _telefono text,
  _email text,
  _sucursal_id uuid
) RETURNS uuid
```

Lógica:
- Resuelve `_org_id := get_user_organization_id(auth.uid())`.
- Valida: `auth.uid()` no nulo; usuario con rol válido (owner/general_manager/manager/barber); si manager o barber → `_sucursal_id IN get_user_sucursal_ids(auth.uid())`; sucursal pertenece a la misma org.
- Inserta en `clientes` (`origen='manual'`) e inmediatamente en `clientes_sucursales` (`origen_relacion='manual'`) dentro de la misma transacción. Si cualquier paso falla, todo se revierte por la transacción implícita de la función.
- Devuelve el `id` del cliente creado.
- Errores: `RAISE EXCEPTION` con mensajes claros (`'No autorizado'`, `'Sucursal no válida'`).

`search_path = public`. Permisos: `GRANT EXECUTE ... TO authenticated`.

**1.4 Turnos — vínculo opcional**
- `ALTER TABLE turnos ADD COLUMN cliente_id uuid NULL`.
- Índice `(cliente_id)`.
- Estrictamente nullable. Sin backfill, sin validaciones nuevas, sin tocar edge functions de reserva.
- Crear turnos sin `cliente_id` sigue siendo válido.

**1.5 RLS**

Helpers reutilizados: `get_user_organization_id`, `get_user_sucursal_ids`, `has_role`.

`clientes`:
- **SELECT**: owner / general_manager → todos los de su org. manager / barber → solo clientes con al menos una fila en `clientes_sucursales` cuya `sucursal_id IN get_user_sucursal_ids(auth.uid())`.
- **INSERT**: owner / general_manager / manager / barber dentro de su org (la validación fina por sucursal vive en la RPC y en la RLS de `clientes_sucursales`).
- **UPDATE**: owner / general_manager → cualquier cliente de su org. manager / barber → solo clientes asociados a sus sucursales.
- **DELETE**: bloqueado.

`clientes_sucursales`:
- **SELECT**: owner / general_manager → toda la org. manager / barber → solo filas con `sucursal_id IN get_user_sucursal_ids`.
- **INSERT / UPDATE / DELETE**: owner / general_manager → toda la org. manager / barber → solo si `sucursal_id IN get_user_sucursal_ids`.

---

### Parte 2 — Frontend

**2.1 Permisos (`src/contexts/AuthContext.tsx`)**
- `canViewClientes = (isOwner || isGeneralManager || isManager || isBarber) && !hasNoAccess`.

**2.2 Navegación (`src/components/AppSidebar.tsx`)**
- Item con icono `Users`, id `clientes`, label "Clientes", insertado **después** de "Turnos y Agenda" y **antes** de "Mi Negocio".
- Visibilidad condicionada a `canViewClientes`.

**2.3 Routing en `src/pages/Index.tsx`**
- Nueva tab `clientes` que renderiza `<ClientesPanel />` **directamente, sin `PinProtectedSection`**.
- Guard de redirección si la tab activa es `clientes` y `!canViewClientes`.

**2.4 Hook `src/hooks/useClientes.ts`**
- Lista filtrada según contexto:
  - `currentSucursal` definido → join contra `clientes_sucursales` filtrado por esa `sucursal_id`.
  - `isAllMode` (owner/GM) → todos los clientes de la org.
- Funciones: `createCliente({nombre, apellido, telefono, email, sucursalId})`, `updateCliente(id, patch)`, `getClienteById(id)`, `getSucursalesByCliente(id)`, `getReservasByCliente(id)`.
- **`createCliente`**: invoca la RPC `create_cliente_with_sucursal`. Toda la atomicidad la garantiza la función SQL. El frontend solo maneja el resultado: éxito → toast OK + refresh; error → toast con el mensaje de la RPC.
- **Fallback defensivo** (si la RPC no estuviese disponible por cualquier razón): el hook detecta que la respuesta de la RPC falló y, si por alguna razón quedara un `cliente_id` huérfano (no debería suceder porque la RPC es transaccional), elimina el cliente recién creado y muestra error claro al usuario. La ruta principal es siempre la RPC.

**2.5 `src/components/ClientesPanel.tsx`** (pantalla principal)

Coherencia visual con `MiNegocioPanel`, `DailySummary`, `PaymentRegistration`:
- Header:
  - Título "Clientes".
  - Subtítulo dinámico: sucursal activa → "Gestioná la lista de clientes de esta sucursal."; vista consolidada → "Gestioná la lista de clientes de todas las sucursales."
  - Botón primario "Nuevo cliente" (icono `Plus`).
  - Botón secundario `outline` "Importar clientes" → toast: "La importación de clientes estará disponible próximamente."
- Buscador: filtra por nombre / apellido / teléfono / email sobre la lista cargada.
- Lista limpia (cards/filas, no tabla densa):
  - Nombre + apellido como texto principal.
  - Teléfono en `text-xs text-muted-foreground` (o "Sin teléfono" en italic muted).
  - Botón ícono WhatsApp a la derecha → toast "Próximamente". Sin abrir WA.
  - Click en card → abre `ClienteDetailDialog`.
  - Sin aviso de datos incompletos en la lista.
- Estado vacío con icono `Users` y CTA "Crear cliente".
- Loading skeleton + manejo de errores con toast.

**2.6 `src/components/clientes/NuevoClienteDialog.tsx`**

Solo cuatro campos: **Nombre***, **Apellido***, **Teléfono**, **Email**.

No se piden: nota interna, fecha de creación, fecha de importación, origen.

Selector de sucursal:
- `currentSucursal` definido → se usa automáticamente, sin selector.
- `isAllMode` (owner/GM) → selector obligatorio con sucursales de la org.
- Caso defensivo (sin sucursal activa ni permiso global) → bloquear creación con mensaje claro.

Validaciones cliente: nombre y apellido requeridos (trim); email con regex básica si presente.

Submit: invoca `useClientes.createCliente` → RPC. Atomicidad garantizada por SQL.

**2.7 `src/components/clientes/ClienteDetailDialog.tsx`** (Sheet/Dialog grande)

- **Datos** (lectura → "Editar" → edición inline):
  - Editables: nombre, apellido, teléfono, email, **nota interna**.
  - Solo lectura: origen (badge), fecha de creación.
- **Aviso sutil** si falta teléfono o email: texto pequeño muted "Datos de contacto incompletos." Solo dentro del perfil.
- **Sucursales asociadas**: chips/badges desde `clientes_sucursales` (filtradas por RLS).
- **Resumen de reservas** (si `cliente_id` poblado en algún turno): última, próxima, total. Si no hay datos → "Sin reservas registradas."
- **Historial de reservas**: lista compacta (fecha, hora, estado, barbero, servicio, sucursal) joineando `turnos`, `barberos`, `servicios`, `sucursales` por `cliente_id`.
- **Botón visual de WhatsApp**: ícono + label, sin integración → toast "Próximamente".

Una sola `nota_interna` libre por cliente. Sin historial de notas.

**2.8 No implementado en esta etapa**
- Importación real (carga de archivos, plantillas CSV/Excel, importación desde apps, deduplicación por importación).
- Exportación, eliminación, fusión, detección de duplicados.
- WhatsApp funcional, mensajes prearmados, campañas.
- Sucursal principal por cliente, métricas avanzadas, automatizaciones.
- PIN sobre la tab Clientes.

---

### Parte 3 — Verificaciones finales
- Tab Clientes **no** pide PIN.
- **Atomicidad**: la creación cliente + relación se hace vía RPC `create_cliente_with_sucursal` en una sola transacción. No quedan clientes huérfanos.
- `clientes.origen` y `clientes_sucursales.origen_relacion` con CHECK constraint para los mismos tres valores: `manual`, `importado`, `reserva`.
- La constraint única solo evita asociaciones repetidas, no duplicados de identidad.
- Vista consolidada solo para owner / general_manager.
- Manager y barber nunca acceden a clientes de sucursales no asignadas.
- Crear desde sucursal activa → asocia automáticamente.
- Crear desde consolidada (owner/GM) → exige selector de sucursal.
- No se piden nota interna, fecha de creación ni origen al crear.
- `turnos.cliente_id` es nullable, no rompe el flujo actual de reservas, no fuerza backfill, no se modifican edge functions.
- Coherencia visual con Cobrar, Caja y Mi Negocio.

### Detalles técnicos
- Una sola migración aditiva: `CREATE TABLE clientes` y `clientes_sucursales` (con CHECK en ambos `origen` / `origen_relacion`), `ALTER TABLE turnos ADD COLUMN cliente_id`, índices, triggers `updated_at`, función RPC `create_cliente_with_sucursal` (SECURITY DEFINER), políticas RLS.
- Tipos TS regenerados automáticamente tras la migración.
- No se tocan: AuthCallback, VerifyEmail, ProtectedRoute, edge functions, useTransactions, agenda, hooks de turnos.
