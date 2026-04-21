import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { PaymentMethod, PAYMENT_METHODS, getMethodLabel } from '@/types/barbershop';

export interface PaymentMethodConfigRow {
  id: string;
  organization_id: string;
  sucursal_id: string | null;
  metodo_pago: PaymentMethod;
  activo: boolean;
  recargo_pct: number;
}

export interface ResolvedMethod {
  method: PaymentMethod;
  label: string;
  activo: boolean;
  recargoPct: number;
  source: 'general' | 'sucursal';
}

interface UsePaymentMethodsConfigOptions {
  /**
   * Si se pasa, fuerza la resolución para esa sucursal específica.
   * Si no, usa la sucursal activa del SucursalContext.
   * Si es null explícito, devuelve únicamente la config general.
   */
  sucursalId?: string | null;
}

/**
 * Resuelve la configuración de métodos de pago.
 *
 * Default sano: si no existe fila en `sucursal_payment_settings` para la
 * sucursal, se asume `usar_config_general = true`.
 *
 * Si `usar_config_general = true` se devuelve la config general
 * (`sucursal_id IS NULL`); si es `false`, se devuelve la config con override
 * por sucursal, con fallback a la general por método si falta override.
 *
 * Para barberos cobrando: pasar nada → usa la sucursal activa.
 * Para la pantalla de configuración general (Mi Negocio): pasar `null`.
 * Para la pantalla de configuración por sucursal: pasar el sucursalId.
 */
export function usePaymentMethodsConfig(opts: UsePaymentMethodsConfigOptions = {}) {
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const sucursalId =
    opts.sucursalId !== undefined ? opts.sucursalId : currentSucursal?.id ?? null;

  const [rows, setRows] = useState<PaymentMethodConfigRow[]>([]);
  const [usarConfigGeneral, setUsarConfigGeneral] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!organization) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    // 1. Cargar TODAS las filas de la org (general + overrides) — los necesitamos
    //    para fallback y para la UI de configuración por sucursal.
    const { data: cfgData } = await supabase
      .from('payment_methods_config')
      .select('*')
      .eq('organization_id', organization.id);

    setRows(((cfgData || []) as any[]).map((r) => ({
      id: r.id,
      organization_id: r.organization_id,
      sucursal_id: r.sucursal_id,
      metodo_pago: r.metodo_pago as PaymentMethod,
      activo: r.activo,
      recargo_pct: Number(r.recargo_pct) || 0,
    })));

    // 2. Determinar usar_config_general
    if (sucursalId) {
      const { data: settingData } = await supabase
        .from('sucursal_payment_settings')
        .select('usar_config_general')
        .eq('sucursal_id', sucursalId)
        .maybeSingle();
      // Default sano: ausencia de fila ⇒ true
      setUsarConfigGeneral(settingData?.usar_config_general ?? true);
    } else {
      setUsarConfigGeneral(true);
    }

    setLoading(false);
  }, [organization, sucursalId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Métodos resueltos en orden fijo, con fallback a general si no hay override
  const methods: ResolvedMethod[] = useMemo(() => {
    const generalByMethod = new Map<PaymentMethod, PaymentMethodConfigRow>();
    const sucursalByMethod = new Map<PaymentMethod, PaymentMethodConfigRow>();

    rows.forEach((r) => {
      if (r.sucursal_id === null) {
        generalByMethod.set(r.metodo_pago, r);
      } else if (sucursalId && r.sucursal_id === sucursalId) {
        sucursalByMethod.set(r.metodo_pago, r);
      }
    });

    return PAYMENT_METHODS.map((m) => {
      const useOverride = !!sucursalId && !usarConfigGeneral;
      const override = useOverride ? sucursalByMethod.get(m) : undefined;
      const general = generalByMethod.get(m);
      const chosen = override ?? general;
      return {
        method: m,
        label: getMethodLabel(m),
        activo: chosen?.activo ?? true,
        recargoPct: chosen?.recargo_pct ?? 0,
        source: override ? ('sucursal' as const) : ('general' as const),
      };
    });
  }, [rows, sucursalId, usarConfigGeneral]);

  const getRecargoPct = useCallback(
    (method: PaymentMethod): number => {
      const m = methods.find((x) => x.method === method);
      return m?.activo ? m.recargoPct : 0;
    },
    [methods],
  );

  const isMethodActive = useCallback(
    (method: PaymentMethod): boolean => {
      const m = methods.find((x) => x.method === method);
      return m?.activo ?? false;
    },
    [methods],
  );

  return {
    methods,
    loading,
    usarConfigGeneral,
    rows,
    sucursalId,
    getRecargoPct,
    isMethodActive,
    reload,
  };
}
