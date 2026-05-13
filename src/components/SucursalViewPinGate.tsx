import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRequirePinForAction } from '@/components/ActionPinGate';
import { SucursalActionKey } from '@/lib/sucursalActions';

interface Props {
  actionKey: SucursalActionKey;
  sucursalId: string | null | undefined;
  isSucursalAccount: boolean;
  children: ReactNode;
  /** Texto mostrado en el estado vacío. */
  viewLabel?: string;
}

/**
 * Wrapper liviano para proteger vistas sensibles cuando el usuario es Cuenta de sucursal.
 * Respeta la lógica de override sucursal > config general > default vía requirePinForAction.
 * Si no es sucursal_account o la acción no requiere PIN, renderiza children directo.
 */
export function SucursalViewPinGate({
  actionKey,
  sucursalId,
  isSucursalAccount,
  children,
  viewLabel,
}: Props) {
  const requirePinForAction = useRequirePinForAction();
  const [authorized, setAuthorized] = useState(false);
  const [pending, setPending] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const requestedRef = useRef(false);
  const gateKeyRef = useRef<string | null>(null);

  const gateKey = `${actionKey}:${sucursalId ?? 'none'}`;

  const ask = useCallback(async () => {
    if (requestedRef.current) return;
    if (sucursalId == null) return;
    requestedRef.current = true;
    setPending(true);
    setCancelled(false);
    try {
      const res = await requirePinForAction(actionKey, sucursalId);
      if (res.ok) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
        setCancelled(true);
      }
    } finally {
      setPending(false);
    }
  }, [actionKey, sucursalId, requirePinForAction]);

  // Reset cuando cambia actionKey o sucursalId (key compuesta)
  useEffect(() => {
    if (gateKeyRef.current !== gateKey) {
      gateKeyRef.current = gateKey;
      requestedRef.current = false;
      setAuthorized(false);
      setCancelled(false);
      setPending(false);
    }
  }, [gateKey]);

  // Disparar pedido inicial solo una vez por gateKey
  useEffect(() => {
    if (!isSucursalAccount) return;
    if (sucursalId == null) return;
    if (authorized || cancelled || pending) return;
    if (requestedRef.current) return;
    void ask();
  }, [isSucursalAccount, sucursalId, authorized, cancelled, pending, ask]);

  if (!isSucursalAccount) return <>{children}</>;

  if (sucursalId == null) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mb-3" />
        <p className="text-sm">Cargando sucursal…</p>
      </div>
    );
  }

  if (authorized) return <>{children}</>;

  if (pending) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mb-3" />
        <p className="text-sm">Solicitando autorización…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-foreground font-medium mb-1">
        Autorización requerida
      </p>
      <p className="text-xs text-muted-foreground mb-4 max-w-xs">
        {viewLabel
          ? `Se necesita PIN para ver ${viewLabel}.`
          : 'Se necesita PIN para ver esta sección.'}
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          requestedRef.current = false;
          setCancelled(false);
          void ask();
        }}
      >
        Solicitar autorización
      </Button>
    </div>
  );
}
