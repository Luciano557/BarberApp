import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sucursal } from '@/contexts/SucursalContext';
import { useSucursalAccount } from '@/hooks/useSucursalAccount';
import { useSucursalActionPinConfig } from '@/hooks/useSucursalActionPinConfig';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Copy, KeyRound, RefreshCw, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { PinActionsToggleList } from './PinActionsToggleList';
import { RegenerarPasswordDialog } from './RegenerarPasswordDialog';
import { SUCURSAL_ACTION_GROUPS, SucursalActionKey } from '@/lib/sucursalActions';

interface Props {
  sucursal: Sucursal;
}

function getEstadoBadge(estado?: string, tempPending?: boolean) {
  if (!estado) return null;
  if (tempPending) {
    return { label: 'Contraseña temporal generada', variant: 'secondary' as const, help: 'La cuenta todavía debe iniciar sesión y cambiar la contraseña.' };
  }
  if (estado === 'inactiva') {
    return { label: 'Inactiva', variant: 'outline' as const, help: 'La cuenta no está disponible para operar.' };
  }
  if (estado === 'activa') {
    return { label: 'Activa', variant: 'default' as const, help: 'La cuenta ya fue activada.' };
  }
  return { label: estado, variant: 'secondary' as const, help: '' };
}

export function CuentaSucursalBlock({ sucursal }: Props) {
  const { isOwner, isGeneralManager } = useAuth();
  const canManageOrgConfig = isOwner || isGeneralManager;

  const { account, isLoading, refetch } = useSucursalAccount(sucursal.id);
  const [regenOpen, setRegenOpen] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [confirmInheritOpen, setConfirmInheritOpen] = useState(false);
  const [togglingMode, setTogglingMode] = useState(false);

  const sucursalConfig = useSucursalActionPinConfig({ scope: 'sucursal', sucursalId: sucursal.id });
  const orgConfig = useSucursalActionPinConfig({ scope: 'org' });

  const usarGeneral = !sucursalConfig.hasOverrides;

  const handleSwitchChange = async (value: boolean) => {
    if (value) {
      // OFF -> ON: pedir confirmación
      if (sucursalConfig.hasOverrides) {
        setConfirmInheritOpen(true);
      }
      return;
    }
    // ON -> OFF: sembrar overrides inmediatamente con valores efectivos generales
    setTogglingMode(true);
    try {
      const snapshot = {} as Record<SucursalActionKey, boolean>;
      for (const group of SUCURSAL_ACTION_GROUPS) {
        for (const action of group.actions) {
          snapshot[action] = orgConfig.valuesByAction(action);
        }
      }
      await sucursalConfig.seedOverrides(snapshot);
    } finally {
      setTogglingMode(false);
    }
  };

  const handleConfirmInherit = async () => {
    setTogglingMode(true);
    try {
      await sucursalConfig.clearOverrides();
    } finally {
      setTogglingMode(false);
      setConfirmInheritOpen(false);
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const { error } = await supabase.functions.invoke('backfill-sucursal-accounts', { body: {} });
      if (error) throw error;
      toast.success('Cuenta generada');
      await refetch();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo generar la cuenta');
    } finally {
      setBackfilling(false);
    }
  };

  const estado = getEstadoBadge(account?.estado, account?.temp_password_pending);

  return (
    <div className="space-y-4">
      {/* Credenciales */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm">Credenciales</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cuenta operativa generada automáticamente para esta sucursal.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : !account ? (
            <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
              <p className="text-sm text-muted-foreground">Vittro está generando la cuenta…</p>
              {canManageOrgConfig && (
                <Button size="sm" variant="outline" onClick={handleBackfill} disabled={backfilling}>
                  {backfilling ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Reintentando…</> : <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Reintentar</>}
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-mono truncate">
                    {account.email}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => { navigator.clipboard.writeText(account.email); toast.success('Email copiado'); }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {estado && (
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <Badge variant={estado.variant}>{estado.label}</Badge>
                  {estado.help && <p className="text-xs text-muted-foreground flex-1">{estado.help}</p>}
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setRegenOpen(true)}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Regenerar contraseña
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* PIN config para esta sucursal */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">Configuración de PIN para esta sucursal</CardTitle>
                {!usarGeneral && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-5">Personalizada</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Definí si esta sucursal usa la configuración general o tiene reglas propias.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <div className="min-w-0 flex-1">
              <Label htmlFor="usar-config-general" className="text-sm font-normal cursor-pointer">
                Usar configuración general
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {usarGeneral
                  ? 'Esta sucursal usa la configuración general de Cuentas de sucursal.'
                  : 'Esta sucursal tiene reglas propias que tienen prioridad sobre la configuración general.'}
              </p>
            </div>
            <Switch
              id="usar-config-general"
              checked={usarGeneral}
              disabled={togglingMode || sucursalConfig.isLoading || orgConfig.isLoading}
              onCheckedChange={handleSwitchChange}
            />
          </div>

          {usarGeneral ? (
            <>
              <p className="text-xs text-muted-foreground">
                Estos valores se gestionan desde Configuración general.
              </p>
              <PinActionsToggleList
                values={(a) => orgConfig.valuesByAction(a)}
                disabled
                isLoading={orgConfig.isLoading}
              />
            </>
          ) : (
            <PinActionsToggleList
              values={(a) => sucursalConfig.valuesByAction(a)}
              onChange={(a, v) => sucursalConfig.setRequiresPin(a, v)}
              savingAction={sucursalConfig.saving}
              isLoading={sucursalConfig.isLoading}
            />
          )}
        </CardContent>
      </Card>

      <RegenerarPasswordDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        sucursalId={sucursal.id}
        sucursalNombre={sucursal.nombre}
        onCompleted={refetch}
      />

      <AlertDialog open={confirmInheritOpen} onOpenChange={setConfirmInheritOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Volver a usar configuración general</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la configuración personalizada de esta sucursal y volverá a usar la configuración general.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={togglingMode}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmInherit} disabled={togglingMode}>
              {togglingMode ? 'Aplicando…' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
