

# Fixes y mejoras en Mi Negocio: Cargos, Catálogo por sucursal

## Problemas identificados

1. **Cargo no se asigna al crear miembro**: `handleFormSave` ignora el campo `role` del form cuando crea un barbero nuevo (no hay usuario vinculado aún, y el cargo solo se intenta asignar después de invitar).
2. **Dropdown de cargo no aparece para barberos sin usuario vinculado**: La condición `linkedUser && !isOwner` oculta el selector si el barbero no fue invitado todavía.
3. **Servicios, extras y descuentos compartidos entre sucursales**: Las tablas `servicios`, `extras` y `descuentos` no tienen `sucursal_id`. Todos los registros se muestran en todas las sucursales.
4. **Título "Cobrar"** debe cambiarse a **"Catálogo de Servicios"**.

## Cambios

### 1. DB Migration — Agregar `sucursal_id` a servicios, extras y descuentos

```sql
ALTER TABLE servicios ADD COLUMN sucursal_id uuid REFERENCES sucursales(id);
ALTER TABLE extras ADD COLUMN sucursal_id uuid REFERENCES sucursales(id);
ALTER TABLE descuentos ADD COLUMN sucursal_id uuid REFERENCES sucursales(id);
```

Los registros existentes quedan con `sucursal_id = NULL` (visibles en todas las sucursales hasta que se reasignen, o podemos asignarlos a la primera sucursal automáticamente).

### 2. `MiNegocioPanel.tsx` — Filtrar y crear datos por sucursal

- Filtrar `allServices`, `allExtras`, `discounts` por `sucursal_id` de cada tab.
- Pasar `sucursalId` a las funciones `addService`, `addExtra`, `addDiscount` para que inserten con el `sucursal_id` correcto.
- Esto requiere que `SucursalTabContent` reciba callbacks que incluyan el `sucursalId`, o que el `addService` original se envuelva.

### 3. `useSupabaseData.ts` — Incluir `sucursal_id` en CRUD

- Leer y mapear `sucursal_id` en servicios, extras y descuentos.
- Incluir `sucursal_id` en los inserts de `addService`, `addExtra`, `addDiscount`.
- Agregar `sucursalId` como parámetro opcional a los types `Service`, `Extra`, `Discount` en `barbershop.ts`.

### 4. `EquipoUnificado.tsx` — Cargo para barberos sin usuario vinculado

- Mostrar el dropdown de cargo siempre (no solo cuando hay `linkedUser`), pero como informativo/deshabilitado si no hay usuario. Mostrar un tooltip "Se asignará al invitar al usuario".
- Alternativamente: mostrar badge "Sin cargo - Invitalo para asignar cargo" en lugar de ocultar el dropdown.
- En el form de crear, el campo `role` ya se recolecta pero no se usa. Se podría guardar en un campo local o metadata hasta que se invite.

**Decisión práctica**: Como el cargo requiere un `user_id` en `user_roles`, no se puede asignar sin usuario. Mostraremos el badge "Sin cargo asignado" con texto "Invitá a este miembro para asignarle un cargo" y mantendremos el dropdown visible solo para miembros con usuario vinculado. El form de creación seguirá mostrando el selector de cargo pero con un aviso de que se aplicará al invitar.

### 5. `SucursalTabContent.tsx` — Renombrar título

- Cambiar `"Cobrar"` → `"Catálogo de Servicios"`.

### 6. Types — Agregar `sucursalId` a Service, Extra, Discount

En `src/types/barbershop.ts`, agregar campo opcional `sucursalId?: string` a los tipos correspondientes.

## Archivos a modificar

- **Migration SQL**: agregar `sucursal_id` a `servicios`, `extras`, `descuentos`
- `src/types/barbershop.ts` — agregar `sucursalId`
- `src/hooks/useSupabaseData.ts` — mapear y filtrar por `sucursal_id`
- `src/components/MiNegocioPanel.tsx` — pasar `sucursalId` y filtrar datos por sucursal
- `src/components/SucursalTabContent.tsx` — renombrar título, pasar `sucursalId` a callbacks
- `src/components/config/EquipoUnificado.tsx` — mejorar UX de cargo para miembros sin usuario
- `src/components/config/CobrarConfig.tsx` — posible ajuste de props para `sucursalId`

