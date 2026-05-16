import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  SucursalActionKey,
  SUCURSAL_ACTION_DEFAULT_REQUIRES_PIN,
} from '@/lib/sucursalActions';
import { toast } from 'sonner';

type Scope = 'org' | 'sucursal';

interface UseConfigOptions {
  scope: Scope;
  sucursalId?: string | null;
  enabled?: boolean;
}

export function useSucursalActionPinConfig({ scope, sucursalId, enabled = true }: UseConfigOptions) {
  const { organization } = useOrganization();
  const orgId = organization?.id ?? null;
  const targetSucursalId = scope === 'org' ? null : (sucursalId ?? null);

  const [rows, setRows] = useState<Array<{ action_key: string; requires_pin: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<SucursalActionKey | null>(null);

  const fetchRows = useCallback(async () => {
    if (!orgId || !enabled) return;
    if (scope === 'sucursal' && !targetSucursalId) return;
    setIsLoading(true);
    try {
      let q = supabase
        .from('sucursal_action_pin_config')
        .select('action_key, requires_pin')
        .eq('organization_id', orgId);
      q = scope === 'org' ? q.is('sucursal_id', null) : q.eq('sucursal_id', targetSucursalId!);
      const { data, error } = await q;
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      console.error('useSucursalActionPinConfig fetch', e);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, scope, targetSucursalId, enabled]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const valuesByAction = (action: SucursalActionKey): boolean => {
    const found = rows.find(r => r.action_key === action);
    if (found) return !!found.requires_pin;
    return SUCURSAL_ACTION_DEFAULT_REQUIRES_PIN[action];
  };

  const setRequiresPin = useCallback(async (action: SucursalActionKey, value: boolean) => {
    if (!orgId) return;
    if (scope === 'sucursal' && !targetSucursalId) return;
    setSaving(action);
    // optimistic
    setRows(prev => {
      const exists = prev.some(r => r.action_key === action);
      if (exists) return prev.map(r => r.action_key === action ? { ...r, requires_pin: value } : r);
      return [...prev, { action_key: action, requires_pin: value }];
    });
    try {
      if (scope === 'org') {
        // upsert con onConflict no matchea filas con sucursal_id IS NULL
        // (NULL ≠ NULL en constraints únicos compuestos). Hacemos update-then-insert.
        const { data: updated, error: updErr } = await supabase
          .from('sucursal_action_pin_config')
          .update({ requires_pin: value })
          .eq('organization_id', orgId)
          .is('sucursal_id', null)
          .eq('action_key', action)
          .select('id');
        if (updErr) throw updErr;
        if (!updated || updated.length === 0) {
          const { error: insErr } = await supabase
            .from('sucursal_action_pin_config')
            .insert({
              organization_id: orgId,
              sucursal_id: null,
              action_key: action,
              requires_pin: value,
            });
          if (insErr) throw insErr;
        }
      } else {
        const { error } = await supabase
          .from('sucursal_action_pin_config')
          .upsert(
            {
              organization_id: orgId,
              sucursal_id: targetSucursalId,
              action_key: action,
              requires_pin: value,
            },
            { onConflict: 'organization_id,sucursal_id,action_key' },
          );
        if (error) throw error;
      }
      toast.success('Cambio guardado', { duration: 1500 });
    } catch (e: any) {
      console.error('setRequiresPin', e);
      toast.error('No se pudo guardar el cambio');
      await fetchRows();
    } finally {
      setSaving(null);
    }
  }, [orgId, scope, targetSucursalId, fetchRows]);

  const seedOverrides = useCallback(async (values: Record<SucursalActionKey, boolean>) => {
    if (!orgId || scope !== 'sucursal' || !targetSucursalId) return;
    const payload = (Object.keys(values) as SucursalActionKey[]).map(action => ({
      organization_id: orgId,
      sucursal_id: targetSucursalId,
      action_key: action,
      requires_pin: values[action],
    }));
    try {
      const { error } = await supabase
        .from('sucursal_action_pin_config')
        .upsert(payload, { onConflict: 'organization_id,sucursal_id,action_key' });
      if (error) throw error;
      await fetchRows();
      toast.success('Configuración personalizada activada');
    } catch (e: any) {
      console.error('seedOverrides', e);
      toast.error('No se pudo activar la configuración personalizada');
    }
  }, [orgId, scope, targetSucursalId, fetchRows]);

  const clearOverrides = useCallback(async () => {
    if (!orgId || scope !== 'sucursal' || !targetSucursalId) return;
    try {
      const { error } = await supabase
        .from('sucursal_action_pin_config')
        .delete()
        .eq('organization_id', orgId)
        .eq('sucursal_id', targetSucursalId);
      if (error) throw error;
      setRows([]);
      toast.success('Configuración personalizada eliminada');
    } catch (e: any) {
      console.error('clearOverrides', e);
      toast.error('No se pudo restablecer la configuración');
    }
  }, [orgId, scope, targetSucursalId]);

  const hasOverrides = scope === 'sucursal' && rows.length > 0;

  return { valuesByAction, setRequiresPin, clearOverrides, seedOverrides, hasOverrides, isLoading, saving, refetch: fetchRows };
}
