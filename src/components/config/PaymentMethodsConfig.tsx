import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/StatusPill';
import { DrawerForm } from '@/components/ui/drawer-form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Wallet, Building2, Info, ArrowRight, Settings, AlertTriangle, MoreVertical, Banknote, QrCode, Landmark, CreditCard, type LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { getMethodLabel, PaymentMethod } from '@/types/barbershop';
import { usePaymentMethodsConfig, ResolvedMethod } from '@/hooks/usePaymentMethodsConfig';

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

interface MethodDraft {
  activo: boolean;
  aplicaRecargo: boolean;
  recargoPct: string; // string en UI para edición libre (valor de "Personalizado")
  recargoPreset: string; // '5' | '10' | '15' | '20' | 'custom'
}

function formatRecargo(pct: number): string {
  return pct > 0 ? `+${pct}%` : 'Sin recargo';
}

const RECARGO_PRESETS = ['5', '10', '15', '20'] as const;

function detectPreset(pct: number): string {
  return RECARGO_PRESETS.includes(String(pct) as (typeof RECARGO_PRESETS)[number])
    ? String(pct)
    : 'custom';
}

const METHOD_META: Record<PaymentMethod, { icon: LucideIcon; description: string }> = {
  efectivo: { icon: Banknote, description: 'Pago en efectivo' },
  mercado_pago: { icon: QrCode, description: 'Pago mediante código QR' },
  transferencia: { icon: Landmark, description: 'Transferencia bancaria' },
  debito: { icon: CreditCard, description: 'Pago con tarjeta de débito' },
  credito: { icon: CreditCard, description: 'Pago con tarjeta de crédito' },
};

export function PaymentMethodsConfig({ sucursalId, onGoToGeneral }: PaymentMethodsConfigProps) {
  const { organization } = useOrganization();
  const { methods, usarConfigGeneral, loading, reload } =
    usePaymentMethodsConfig({ sucursalId });

  const [usarGeneral, setUsarGeneral] = useState(true);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sincronizar el toggle de override con los datos cargados
  useEffect(() => {
    if (loading) return;
    setUsarGeneral(usarConfigGeneral);
  }, [loading, usarConfigGeneral]);

  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [draft, setDraft] = useState<MethodDraft>({ activo: true, aplicaRecargo: false, recargoPct: '0', recargoPreset: 'custom' });
  const [validationError, setValidationError] = useState<string | null>(null);

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

  const startEdit = (m: ResolvedMethod) => {
    if (!canEdit) return;
    setEditingMethod(m.method);
    setDraft({
      activo: m.activo,
      aplicaRecargo: m.recargoPct > 0,
      recargoPct: String(m.recargoPct),
      recargoPreset: detectPreset(m.recargoPct),
    });
    setValidationError(null);
  };

  const closeDrawer = () => {
    setEditingMethod(null);
    setValidationError(null);
  };

  const saveDraft = async () => {
    if (!organization || !canEdit || !editingMethod) return;

    // Validación: no dejar el negocio/sucursal sin ningún método activo
    const activosRestantes = methods.filter((m) =>
      m.method === editingMethod ? draft.activo : m.activo,
    );
    if (activosRestantes.length === 0) {
      setValidationError(
        'Debe quedar al menos un método de pago activo. Activá otro método antes de desactivar este.',
      );
      return;
    }

    const pct = !draft.aplicaRecargo
      ? 0
      : draft.recargoPreset === 'custom'
        ? Math.max(0, Math.min(100, parseFloat(draft.recargoPct) || 0))
        : parseFloat(draft.recargoPreset);

    setSaving(true);
    const targetSucursalId = editingOverride ? sucursalId : null;

    let q = supabase
      .from('payment_methods_config')
      .select('id')
      .eq('organization_id', organization.id)
      .eq('metodo_pago', editingMethod);
    q = targetSucursalId === null ? q.is('sucursal_id', null) : q.eq('sucursal_id', targetSucursalId);
    const { data: existing } = await q.maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('payment_methods_config')
        .update({ activo: draft.activo, recargo_pct: pct })
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
          metodo_pago: editingMethod,
          activo: draft.activo,
          recargo_pct: pct,
        });
      if (error) {
        toast.error('Error al guardar');
        setSaving(false);
        return;
      }
    }
    toast.success(`${getMethodLabel(editingMethod)} actualizado`);
    await reload();
    setSaving(false);
    closeDrawer();
  };

  const subtitle = editingGeneral
    ? 'Configuración general del negocio'
    : inheritsFromGeneral
      ? 'Esta sucursal usa la configuración general'
      : 'Esta sucursal tiene configuración propia';

  const editingLabel = editingMethod ? getMethodLabel(editingMethod) : '';

  return (
    <>
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
                  onCheckedChange={(next) => {
                    if (editingOverride && next) {
                      setConfirmRevert(true);
                    } else {
                      handleToggleUsarGeneral(next);
                    }
                  }}
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
                <p className="flex-1 text-sm text-foreground">
                  Esta sucursal tiene configuración propia. Los cambios acá NO afectan a las demás sucursales.
                </p>
              </div>
            )}
            {methods.map((m) => (
              <div
                key={m.method}
                role="button"
                tabIndex={0}
                onClick={() => startEdit(m)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    startEdit(m);
                  }
                }}
                className="flex cursor-pointer items-center gap-3 rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {m.label}
                </span>
                {m.recargoPct > 0 && (
                  <StatusPill
                    status="warning"
                    label={formatRecargo(m.recargoPct)}
                    icon={false}
                    size="sm"
                  />
                )}
                <StatusPill
                  status={m.activo ? 'success' : 'neutral'}
                  label={m.activo ? 'Activo' : 'Inactivo'}
                  size="sm"
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); startEdit(m); }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-transparent hover:bg-muted border-[0.5px] border-border transition-colors"
                  tabIndex={-1}
                >
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

      <DrawerForm
        open={editingMethod !== null}
        onOpenChange={(o) => { if (!o) closeDrawer(); }}
        title={editingLabel ? `Editar ${editingLabel}` : 'Editar método'}
        size="sm"
        footer={
          <div className="flex w-full justify-between">
            <Button variant="ghost" onClick={closeDrawer} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={saveDraft} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {editingMethod && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
              {(() => {
                const MetaIcon = METHOD_META[editingMethod].icon;
                return (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <MetaIcon className="h-5 w-5 text-primary" />
                  </div>
                );
              })()}
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{editingLabel}</p>
                <p className="text-sm text-muted-foreground">{METHOD_META[editingMethod].description}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="metodo-activo" className="text-sm font-medium">
                Método activo
              </Label>
              <Switch
                id="metodo-activo"
                checked={draft.activo}
                onCheckedChange={(v) => {
                  setDraft((d) => ({ ...d, activo: v }));
                  setValidationError(null);
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Disponible para usar en Cobrar</p>
            {validationError && (
              <div className="flex items-start gap-2 rounded-lg border border-status-warning bg-status-warning-bg p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning-foreground" />
                <p className="flex-1 text-sm text-status-warning-foreground">{validationError}</p>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="aplica-recargo" className="text-sm font-medium">
                ¿Aplica recargo?
              </Label>
              <Switch
                id="aplica-recargo"
                checked={draft.aplicaRecargo}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, aplicaRecargo: v }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Si está activo, se suma un porcentaje al precio cuando el cliente paga con este método
            </p>
            {draft.aplicaRecargo && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">% de recargo</Label>
                  <Select
                    value={draft.recargoPreset}
                    onValueChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        recargoPreset: v,
                        // al elegir un preset, sincronizo el valor numérico
                        recargoPct: v === 'custom' ? d.recargoPct : v,
                      }))
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECARGO_PRESETS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}%
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {draft.recargoPreset === 'custom' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="recargo-pct" className="text-xs font-medium text-muted-foreground">
                      Valor personalizado
                    </Label>
                    <div className="flex items-center gap-1">
                      <Input
                        id="recargo-pct"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        step="0.01"
                        value={draft.recargoPct}
                        onChange={(e) => setDraft((d) => ({ ...d, recargoPct: e.target.value }))}
                        className="h-9 w-28 text-right"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DrawerForm>

      <AlertDialog open={confirmRevert} onOpenChange={setConfirmRevert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Volver a configuración general</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la configuración propia de esta sucursal. Los métodos de pago volverán a seguir la configuración general del negocio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmRevert(false); handleToggleUsarGeneral(true); }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
