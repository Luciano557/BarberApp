# Plan: Alinear RLS de `portal_config` (INSERT/UPDATE) con la UI

## Contexto y hallazgo

Auditoría previa detectó una discrepancia: la UI ya restringe la edición del Portal público a `owner` y `general_manager` (constante local `canManagePortal = isOwner || isGeneralManager` en `AgendaManagement.tsx:56`), pero la política RLS de `portal_config` también deja escribir a `manager`. Como vamos a agregar un campo sensible (`meta_pixel_id`) a esta tabla, es el momento de cerrar esa brecha.

## Estado actual confirmado (DB)

Políticas existentes sobre `public.portal_config` (verificadas con `pg_policy`):

| Política | Comando | Roles permitidos |
|---|---|---|
| `portal_config_select_org_members` | SELECT | todos los miembros de la org (`organization_id = get_user_organization_id(auth.uid())`) |
| `portal_config_insert_admins` | INSERT | owner, general_manager **y manager** |
| `portal_config_update_admins` | UPDATE | owner, general_manager **y manager** |
| `portal_config_delete_admins` | DELETE | owner, general_manager (sin manager) |

Definición exacta a reemplazar (INSERT y UPDATE idénticas en la cláusula de roles):

```sql
public.has_role(auth.uid(), 'owner'::app_role)
OR public.has_role(auth.uid(), 'general_manager'::app_role)
OR public.has_role(auth.uid(), 'manager'::app_role)
```

Patrón del proyecto ya confirmado: `has_role(uuid, app_role)` es `SECURITY DEFINER`, owner `postgres`, y `get_user_organization_id(uuid)` también es `SECURITY DEFINER`.

## Verificación de fricción (flujos legítimos que escriben portal_config)

- **Frontend:** `usePortalConfig.save()` usa el cliente Supabase estándar (sesión del usuario, sujeto a RLS) y solo se invoca desde `PortalPublicoSection.tsx`, que está detrás de `canManagePortal`. Un manager hoy **nunca** llega al path de escritura por UI. ✔ Sin fricción.
- **Edge functions:** `get-org-public` es la única que toca `portal_config` y lo hace con `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS) y solo hace `SELECT`. Ninguna edge function escribe `portal_config` con el rol del usuario. ✔ Sin fricción.
- **Storage bucket `portal-logos`:** sus políticas de INSERT/UPDATE/DELETE ya excluyen a `manager` (solo owner/general_manager). La corrección deja `portal_config` consistente con su propio bucket.

Conclusión: no existe flujo legítimo donde un manager necesite escribir `portal_config`. El cambio no genera fricción operativa.

## Cambio propuesto

Migración que dropea y recrea **solo** las políticas de INSERT y UPDATE, eliminando la rama `manager`, dejándolas idénticas a la política de DELETE ya existente. El SELECT **no se toca** (sigue abierto a todos los miembros de la organización).

```sql
DROP POLICY IF EXISTS "portal_config_insert_admins" ON public.portal_config;
DROP POLICY IF EXISTS "portal_config_update_admins" ON public.portal_config;

CREATE POLICY "portal_config_insert_admins"
ON public.portal_config FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  )
);

CREATE POLICY "portal_config_update_admins"
ON public.portal_config FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  )
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
  )
);
```

Resultado: las cuatro políticas quedan coherentes — SELECT abierto a la org; INSERT/UPDATE/DELETE restringidos a owner y general_manager; la UI y la DB dicen lo mismo.

## Qué protege y qué pasa si queda mal (en criollo)

Hoy la base de datos permite que un `manager` (encargado de sucursal) cambie la configuración del Portal público de toda la barbería —logo, descripción, color, links y, próximamente, el ID del píxel de Meta— aunque la pantalla de Configuración le esconda esa sección. Es decir, la puerta de la UI está cerrada para el manager pero la de la base está abierta: alguien con el cargo de manager podría, usando la API directamente, modificar el portal o meter un píxel de tracking ajeno.

Este cambio cierra la puerta de la base para que solo owner y general_manager puedan escribir, igual que ya pasa con borrar y como ya pasa en la pantalla. Si quedara mal configurado (por ejemplo, si la nueva política excluyera a `general_manager` por error), el dueño delegado no podría editar el portal aunque la UI se lo permita —se rompería el guardado con un error de permisos—; por eso la migración se revisa dejando exactamente los mismos roles que usa la política de DELETE, que ya funciona.

## Fuera de alcance

- No se modifica el SELECT de `portal_config`.
- No se tocan las políticas del bucket `portal-logos` (ya correctas).
- No se cambia la UI ni la constante `canManagePortal`.
- No se altera `get-org-public` (usa service_role y solo lee).
