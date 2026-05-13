import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Wallet, Building2, Info, ArrowRight, Settings } from 'lucide-react';
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
  /**
   * Callback opcional para navegar a la configuración general
   * (Configuración → Mi Negocio). Solo aplica cuando `sucursalId !== null`.
   */
  onGoToGeneral?: () => void;
}

interface MethodState {
  activo: boolean;
  recargoPct: string; // string en UI para edición libre
}

export function PaymentMethodsConfig({ sucursalId, onGoToGeneral }: PaymentMethodsConfigProps) {
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

  const editingGeneral = sucursalId === null;
  const editingOverride = sucursalId !== null && !usarGeneral;
  const inheritsFromGeneral = sucursalId !== null && usarGeneral;
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
      next ? 'Usando configuración general' : 'Configuración propia de sucursal habilitada',
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

  const subtitle = editingGeneral
    ? 'Configuración general del negocio'
    : inheritsFromGeneral
      ? 'Esta sucursal usa la configuración general'
      : 'Esta sucursal tiene configuración propia';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">Métodos de pago y recargos</CardTitle>
              <CardDescription>{subtitle}</CardDescription>
            </div>
          </div>
          {sucursalId !== null && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <div className="flex items-center justify-between gap-3 sm:justify-end">
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
              <p className="max-w-full text-[11px] text-muted-foreground sm:max-w-[220px] sm:text-right">
                Activado: hereda de Mi Negocio.<br />
                Desactivado: configuración propia.
              </p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : inheritsFromGeneral ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1 max-w-md">
              <h4 className="font-medium text-foreground">
                Esta sucursal usa la configuración general
              </h4>
              <p className="text-sm text-muted-foreground">
                Los métodos de pago activos y los recargos se administran desde Mi Negocio.
                Cualquier cambio se aplica acá automáticamente.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {onGoToGeneral && (
                <Button onClick={onGoToGeneral} className="gap-2">
                  <Settings className="h-4 w-4" />
                  Editar configuración general
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => handleToggleUsarGeneral(false)}
                disabled={saving}
              >
                Personalizar esta sucursal
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {editingOverride && (
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 mb-3">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 text-sm">
                  <p className="text-foreground">
                    Esta sucursal tiene configuración propia. Los cambios acá NO afectan a las demás sucursales.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleToggleUsarGeneral(true)}
                    disabled={saving}
                    className="mt-1 text-xs font-medium text-primary hover:underline"
                  >
                    Volver a usar la configuración general
                  </button>
                </div>
              </div>
            )}
            {PAYMENT_METHODS.map((m) => {
              const s = state[m];
              if (!s) return null;
              return (
                <div
                  key={m}
                  className="flex flex-col gap-3 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-3 sm:flex-1">
                    <Switch
                      checked={s.activo}
                      onCheckedChange={(v) => updateMethod(m, { activo: v })}
                      disabled={!canEdit || saving}
                    />
                    <span className="font-medium">{getMethodLabel(m)}</span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-1 sm:justify-end">
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
                        className="h-8 w-full text-right sm:w-20"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => saveMethod(m)}
                        disabled={saving}
                        className="w-full rounded border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:w-auto"
                      >
                        Guardar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
