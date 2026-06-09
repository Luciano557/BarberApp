ALTER TABLE public.sucursales ADD COLUMN deleted_at timestamptz NULL;

CREATE INDEX idx_sucursales_org_alive ON public.sucursales (organization_id)
WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.sucursal_tiene_historial(_sucursal_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ingresos      WHERE sucursal_id = _sucursal_id)
      OR EXISTS (SELECT 1 FROM public.venta         WHERE sucursal_id = _sucursal_id)
      OR EXISTS (SELECT 1 FROM public.turnos        WHERE sucursal_id = _sucursal_id)
      OR EXISTS (SELECT 1 FROM public.pagos_sueldos WHERE sucursal_id = _sucursal_id);
$$;

GRANT EXECUTE ON FUNCTION public.sucursal_tiene_historial(uuid) TO authenticated;