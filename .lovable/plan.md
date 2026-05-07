## Corrección de integración multirol — `roles_equipo` como fuente operativa visual (v2)

No se rediseña UI. Se corrigen 9 puntos puntuales para que `barberos.roles_equipo` sea la fuente operativa visual del multirol y se sincronice correctamente con `user_roles`.

### Decisiones de tipado (ajustes finales)

- `AppRole` ya existe en `@/contexts/AuthContext` (`'owner' | 'general_manager' | 'manager' | 'barber' | 'otros'`). Importar desde ahí. No crear `@/types/auth`.
- `TeamRole` en `src/types/barbershop.ts` se amplía a:
  ```
  export type TeamRole = 'owner' | 'general_manager' | 'manager' | 'barbero' | 'otros';
  ```
  Refleja que `barberos.rol_equipo` ahora es el rol principal derivado del multirol.
- Sin `as any` ni casteos forzados. El modelo queda tipado correctamente: `teamRole: TeamRole`, `rolesEquipo?: AppRole[]`, `sucursalId?: string | null`.

### 1. Tipo `Barber` (`src/types/barbershop.ts`)

- Ampliar `TeamRole` (ver arriba).
- Agregar al `interface Barber`:
  - `rolesEquipo?: AppRole[]`
  - `sucursalId?: string | null`
- Importar `AppRole` desde `@/contexts/AuthContext`.

### 2. `dbToBarber` (`src/hooks/useSupabaseData.ts`)

Añadir helper local `rolEquipoToRoles(re)`:
- `'barbero'` → `['barber']`
- `'manager'` → `['manager']`
- `'general_manager'` → `['general_manager']`
- `'owner'` → `['owner']`
- `'otros'` → `['otros']`
- otro/null → `[]`

En `dbToBarber`:
- `teamRole: (row.rol_equipo as TeamRole) || 'barbero'`
- `rolesEquipo: Array.isArray(row.roles_equipo) && row.roles_equipo.length > 0 ? (row.roles_equipo as AppRole[]) : rolEquipoToRoles(row.rol_equipo)`
- `sucursalId: row.sucursal_id ?? null`

### 3. `addBarber` / `updateBarber` (`src/hooks/useSupabaseData.ts`)

`addBarber`: persistir `roles_equipo` consistente con `teamRole`:
- `teamRole === 'otros'` → `roles_equipo = ['otros']`, `rol_equipo = 'otros'`
- por defecto (`'barbero'`) → `roles_equipo = ['barber']`, `rol_equipo = 'barbero'`
- Si llega `rolesEquipo` explícito en el input, usar ese array tal cual.

`updateBarber`: si `updates.rolesEquipo` está definido, mapearlo a `roles_equipo`.

### 4. `getDisplayRoles` (`src/components/config/EquipoUnificado.tsx`)

Nueva prioridad:
1. `barber.rolesEquipo` si tiene elementos.
2. `rolEquipoToRoles(barber.teamRole)` si tiene elementos.
3. `user_roles` del usuario vinculado (fallback).
4. `['barber']` default.

Eliminar la lógica actual que usa `user_roles` como fuente principal cuando hay usuario vinculado.

### 5. Payload individual en `callAccessFn`

Construir payload usando la sucursal del barbero:
```
{
  barberoId: barber.id,
  organizationId,
  sucursalId: barber.sucursalId ?? sucursalId,
  roles: newRoles,
  accessEmail,
  regenerateAccess
}
```
Aplicar en: `handleChangeRoles`, `handleFormSave`, `performRegenerate`.

### 6. Edge function — update individual reforzado

En `update-team-member-access`, el update a `barberos` debe filtrar por:
```
.eq("id", barberoId)
.eq("organization_id", organizationId)
```
Hacer `select` de control post-update y validar pertenencia. Orden: validar → mutar `barberos` → mutar `user_roles` → tocar Auth.

### 7. Edge function — manager único contra `user_roles`

Antes de aceptar `roles` que incluyan `manager`, además de la validación contra `barberos`, verificar:
```
select 1
from public.user_roles ur
join public.profiles p on p.id = ur.user_id
join public.user_sucursales us on us.user_id = ur.user_id
where ur.role = 'manager'
  and p.organization_id = organizationId
  and us.sucursal_id = finalSucursalId
  and (p.barbero_id is null or p.barbero_id <> barberoId)
limit 1
```
Si existe → `409` y NO mutar nada.

### 8. Migración protectora — índice único de manager por sucursal

Migración en dos pasos. Si hay duplicados, **abortar con diagnóstico claro**, no aplicar el índice.

```
DO $$
DECLARE r record; cnt int := 0; msg text := '';
BEGIN
  FOR r IN
    SELECT organization_id, sucursal_id, count(*) c
    FROM public.barberos
    WHERE activo = true
      AND (rol_equipo = 'manager' OR roles_equipo @> ARRAY['manager']::text[])
    GROUP BY organization_id, sucursal_id
    HAVING count(*) > 1
  LOOP
    cnt := cnt + 1;
    msg := msg || format(E'\n  org=%s sucursal=%s managers_activos=%s', r.organization_id, r.sucursal_id, r.c);
    RAISE NOTICE 'DUPLICADO org=% sucursal=% managers_activos=%', r.organization_id, r.sucursal_id, r.c;
  END LOOP;
  IF cnt > 0 THEN
    RAISE EXCEPTION 'No se puede crear uniq_active_manager_per_sucursal: % sucursales con managers duplicados:%', cnt, msg;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_manager_per_sucursal
ON public.barberos (organization_id, sucursal_id)
WHERE activo = true
  AND (rol_equipo = 'manager' OR roles_equipo @> ARRAY['manager']::text[]);
```

Si el bloque DO aborta, la migración entera falla y el índice no se crea. El error contiene `organization_id`, `sucursal_id` y cantidad por cada duplicado.

### 9. Casos de prueba (post-implementación)

- A: owner + barber → `roles_equipo=['owner','barber']`, `rol_equipo='owner'`, `user_roles`=owner+barber.
- B: manager + barber → `roles_equipo=['manager','barber']`, `rol_equipo='manager'`, `user_roles`=manager+barber.
- C: general_manager + barber → idem `general_manager`.
- D: otros + barber → bloquear o forzar solo `otros`.
- E: dos managers misma sucursal → 409, sin mutación.
- F: cambiar cargos de un integrante no afecta a otros (filtro `id + organization_id`).

### Verificación final

Tras implementar, revisar que no queden errores TypeScript en:
- `src/types/barbershop.ts`
- `src/hooks/useSupabaseData.ts`
- `src/components/config/EquipoUnificado.tsx`
- `supabase/functions/update-team-member-access/index.ts`

El build de Lovable corre automáticamente y reporta tipos.

### Archivos a tocar

- `src/types/barbershop.ts`
- `src/hooks/useSupabaseData.ts`
- `src/components/config/EquipoUnificado.tsx`
- `supabase/functions/update-team-member-access/index.ts`
- Nueva migración SQL (diagnóstico + índice único condicional)

### Lo que NO se toca

- Componentes UI/estética.
- Lógica de `enforceRoleRules` y combinaciones permitidas (ya implementadas).
- `src/integrations/supabase/types.ts` (se regenera tras la migración).
