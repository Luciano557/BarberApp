import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { PAYMENT_METHODS, getMethodLabel, PaymentMethod } from '@/types/barbershop';
import { usePaymentMethodsConfig } from '@/hooks/usePaymentMethodsConfig';

interface PaymentMethodsConfigProps {
  /**
   * `null` ⇒ configuración general de la organización (Mi Negocio).
   * `string` ⇒ configuración override por sucursal.
   */
  sucursalId: string | null;
}

interface MethodState {
  activo: boolean;
  recargoPct: string; // string en UI para edición libre
}

export function PaymentMethodsConfig({ sucursalId }: PaymentMethodsConfigProps) {
  const { organization } = useOrganization();
  const { methods, usarConfigGeneral, loading, reload } =
    usePaymentMethodsConfig({ sucursalId });

  const [usarGeneral, setUsarGeneral] = useState(true);
  const [state, setState] = useState<Record<PaymentMethod, MethodState>>(() =>
    PAYMENT_METHODS.reduce((acc, m) => {
      acc[m] = { activo: true, recargoPct: '0' };
      return acc;
    }, {} as Record<PaymentMethod, MethodState>),
  );
  const [saving, setSaving] = useState(false);

  // Sincronizar estado local con datos cargados
  useEffect(() => {
    if (loading) return;
    setUsarGeneral(usarConfigGeneral);
    const next = {} as Record<PaymentMethod, MethodState>;
    methods.forEach((m) => {
      next[m.method] = {
        activo: m.activo,
        recargoPct: String(m.recargoPct),
      };
    });
    setState(next);
  }, [loading, usarConfigGeneral, methods]);

  // Sucursal usa override sólo si hay sucursalId y usarGeneral === false
  const editingOverride = sucursalId !== null && !usarGeneral;
  const editingGeneral = sucursalId === null;
  const canEdit = editingGeneral || editingOverride;

  const handleToggleUsarGeneral = async (next: boolean) => {
    if (!organization || !sucursalId) return;
    setSaving(true);
    const { error } = await supabase
      .from('sucursal_payment_settings')
      .upsert(
        {
          sucursal_id: sucursalId,
          organization_id: organization.id,
          usar_config_general: next,
        },
        { onConflict: 'sucursal_id' },
      );
    if (error) {
      toast.error('Error al cambiar la configuración');
      setSaving(false);
      return;
    }
    setUsarGeneral(next);
    toast.success(
      next ? 'Usando configuración general' : 'Override por sucursal habilitado',
    );
    await reload();
    setSaving(false);
  };

  const updateMethod = (m: PaymentMethod, patch: Partial<MethodState>) => {
    setState((prev) => ({ ...prev, [m]: { ...prev[m], ...patch } }));
  };

  const saveMethod = async (m: PaymentMethod) => {
    if (!organization || !canEdit) return;
    const s = state[m];
    const pct = Math.max(0, Math.min(100, parseFloat(s.recargoPct) || 0));

    setSaving(true);
    const targetSucursalId = editingOverride ? sucursalId : null;

    // Buscar fila existente
    let q = supabase
      .from('payment_methods_config')
      .select('id')
      .eq('organization_id', organization.id)
      .eq('metodo_pago', m);
    q = targetSucursalId === null ? q.is('sucursal_id', null) : q.eq('sucursal_id', targetSucursalId);
    const { data: existing } = await q.maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('payment_methods_config')
        .update({ activo: s.activo, recargo_pct: pct })
        .eq('id', existing.id);
      if (error) {
        toast.error('Error al guardar');
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from('payment_methods_config')
        .insert({
          organization_id: organization.id,
          sucursal_id: targetSucursalId,
          metodo_pago: m,
          activo: s.activo,
          recargo_pct: pct,
        });
      if (error) {
        toast.error('Error al guardar');
        setSaving(false);
        return;
      }
    }
    toast.success(`${getMethodLabel(m)} actualizado`);
    await reload();
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Métodos de pago y recargos</CardTitle>
              <CardDescription>
                {editingGeneral
                  ? 'Configuración general del negocio'
                  : 'Configuración específica de esta sucursal'}
              </CardDescription>
            </div>
          </div>
          {sucursalId !== null && (
            <div className="flex items-center gap-2">
              <Label htmlFor="use-general" className="text-sm">
                Usar configuración general
              </Label>
              <Switch
                id="use-general"
                checked={usarGeneral}
                onCheckedChange={handleToggleUsarGeneral}
                disabled={saving || loading}
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {!canEdit && sucursalId !== null && (
              <p className="text-xs text-muted-foreground mb-3">
                Esta sucursal está usando la configuración general. Desactivá el
                switch para personalizar.
              </p>
            )}
            {PAYMENT_METHODS.map((m) => {
              const s = state[m];
              if (!s) return null;
              return (
                <div
                  key={m}
                  className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                >
                  <Switch
                    checked={s.activo}
                    onCheckedChange={(v) => updateMethod(m, { activo: v })}
                    disabled={!canEdit || saving}
                  />
                  <span className="font-medium flex-1">{getMethodLabel(m)}</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step="0.01"
                      value={s.recargoPct}
                      onChange={(e) =>
                        updateMethod(m, { recargoPct: e.target.value })
                      }
                      onBlur={() => canEdit && saveMethod(m)}
                      disabled={!canEdit || saving || !s.activo}
                      className="w-20 h-8 text-right"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => saveMethod(m)}
                      disabled={saving}
                      className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      Guardar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
