# Plan corregido — Migración `tareas_recurrentes`

## Confirmación de funciones auxiliares
- `public.get_user_barbero_id(_user_id uuid)` — definida en `supabase/migrations/20260109143656_e112717a-9844-4e18-8157-4bb409c26781.sql:42`.
- `public.update_updated_at_column()` — definida en `supabase/migrations/20260108144448_13ab8691-72e2-4c75-8310-39d7c1352ddf.sql:43`.

Ambas se usan extensivamente en el resto del esquema, son seguras de invocar.

## Cambios respecto a la versión anterior
1. `asignado_a` → ahora FK a `public.barberos(id) ON DELETE SET NULL` (antes apuntaba a `auth.users`).
2. Política `Barber view scoped tareas_recurrentes` → compara `asignado_a = public.get_user_barbero_id(auth.uid())` (antes `= auth.uid()`).
3. Agregado `updated_at timestamptz NOT NULL DEFAULT now()` + trigger `update_tareas_recurrentes_updated_at` con `public.update_updated_at_column()`.
4. Sin cambios en estructura, índices, GRANTs, resto de RLS, FKs de org/sucursal, CHECK de `assignment_scope`, ni en la política de `sucursal_account` (queda permitiendo `individual` y `team`).

## Archivo SQL completo y corregido

Ruta: `supabase/migrations/<timestamp>_tareas_recurrentes.sql`

```sql
-- =========================================================================
-- Etapa: Tareas recurrentes (motor real de recurrencia)
-- Crea la tabla tareas_recurrentes (receta/plantilla) y vincula tareas
-- generadas via columna recurrencia_id. Replica el patrón de
-- gastos_recurrentes y las RLS vigentes sobre public.tareas.
-- NO modifica datos. NO crea cron ni funciones de generación.
-- =========================================================================

-- ---------- 1. Tabla tareas_recurrentes ----------
CREATE TABLE public.tareas_recurrentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sucursal_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descripcion text,
  assignment_scope text NOT NULL DEFAULT 'individual'
    CHECK (assignment_scope IN ('individual','team')),
  asignado_a uuid REFERENCES public.barberos(id) ON DELETE SET NULL,
  asignado_nombre text,
  hora text,
  repeat_preset text NOT NULL DEFAULT 'never',
  repeat_frequency text,
  repeat_interval integer DEFAULT 1,
  repeat_byweekday integer[],
  fecha_inicio date NOT NULL,
  proxima_fecha date NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tareas_recurrentes TO authenticated;
GRANT ALL ON public.tareas_recurrentes TO service_role;

-- ---------- 2. Trigger updated_at ----------
CREATE TRIGGER update_tareas_recurrentes_updated_at
  BEFORE UPDATE ON public.tareas_recurrentes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 3. Alter tareas: enlace a la receta ----------
ALTER TABLE public.tareas
  ADD COLUMN IF NOT EXISTS recurrencia_id uuid
    REFERENCES public.tareas_recurrentes(id) ON DELETE SET NULL;

-- ---------- 4. Índices ----------
CREATE INDEX IF NOT EXISTS idx_tareas_recurrentes_org_suc_activo
  ON public.tareas_recurrentes (organization_id, sucursal_id, activo);

CREATE INDEX IF NOT EXISTS idx_tareas_recurrentes_proxima_fecha_activo
  ON public.tareas_recurrentes (proxima_fecha)
  WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_tareas_recurrencia_id
  ON public.tareas (recurrencia_id)
  WHERE recurrencia_id IS NOT NULL;

-- ---------- 5. RLS ----------
ALTER TABLE public.tareas_recurrentes ENABLE ROW LEVEL SECURITY;

-- Owner / General Manager / Manager: ver
CREATE POLICY "Owner GM Manager view org tareas_recurrentes"
ON public.tareas_recurrentes FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'general_manager'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
);

-- Owner / Manager: insert / update / delete (mismo criterio que tareas)
CREATE POLICY "Owner/Manager can insert tareas_recurrentes"
ON public.tareas_recurrentes FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(), 'owner'::app_role)
       OR public.has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "Owner/Manager can update tareas_recurrentes"
ON public.tareas_recurrentes FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(), 'owner'::app_role)
       OR public.has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "Owner/Manager can delete tareas_recurrentes"
ON public.tareas_recurrentes FOR DELETE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (public.has_role(auth.uid(), 'owner'::app_role)
       OR public.has_role(auth.uid(), 'manager'::app_role))
);

-- Barber: ve recetas que le generan tareas (individual a su barbero
-- o team de su sucursal). No puede modificar.
CREATE POLICY "Barber view scoped tareas_recurrentes"
ON public.tareas_recurrentes FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'barber'::app_role)
  AND (
    (assignment_scope = 'individual'
      AND asignado_a = public.get_user_barbero_id(auth.uid()))
    OR (assignment_scope = 'team'
      AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid())))
  )
);

-- Sucursal account: ve / crea / edita recetas de su sucursal
-- (permite individual y team, confirmado)
CREATE POLICY "Sucursal account view tareas_recurrentes"
ON public.tareas_recurrentes FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.is_sucursal_account(auth.uid())
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
);

CREATE POLICY "Sucursal account insert tareas_recurrentes"
ON public.tareas_recurrentes FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.is_sucursal_account(auth.uid())
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
);

CREATE POLICY "Sucursal account update tareas_recurrentes"
ON public.tareas_recurrentes FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.is_sucursal_account(auth.uid())
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND sucursal_id IN (SELECT public.get_user_sucursal_ids(auth.uid()))
);
```

## Inconsistencias nuevas detectadas
- **Alineación con `tareas.asignado_a_id`**: ahora `tareas_recurrentes.asignado_a` y `tareas.asignado_a_id` apuntan ambos a `barberos(id)`, pero los nombres de columna difieren. Es consistente con el brief original, pero cuando se construya el motor conviene mapear `asignado_a → asignado_a_id` al generar la tarea hija. Solo a tener en cuenta, no requiere cambio en la migración.
- **Sucursal account y scope `team`**: confirmado por vos. Sin cambio. Si más adelante quisieras restringirlo, se hace con una policy adicional.
- **No se incluye trigger de notificaciones** para la nueva tabla (la receta no es una tarea visible; las notificaciones deberían dispararse desde el motor cuando se genere la tarea hija). Confirmar cuando armemos el motor.

Esperando tu aprobación para pasar a build mode y aplicar la migración.