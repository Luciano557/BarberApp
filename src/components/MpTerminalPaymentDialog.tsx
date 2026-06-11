import { useState, useEffect } from 'react';
import { Loader2, MonitorSmartphone, CheckCircle2, XCircle, Clock, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMercadoPago, type MpDevice } from '@/hooks/useMercadoPago';
import { useMpPaymentIntent, type MpIntentStatus } from '@/hooks/useMpPaymentIntent';
import { useSucursal } from '@/contexts/SucursalContext';
import { cn } from '@/lib/utils';

interface MpTerminalPaymentDialogProps {
  open: boolean;
  /** Amount in ARS pesos (e.g. 1500 = $1500) */
  amountPesos: number;
  description?: string;
  onSuccess: (intentId: string) => void;
  onCancel: () => void;
}

const STATUS_CONFIG: Record<
  MpIntentStatus,
  { label: string; icon: React.ReactNode; color: string }
> = {
  idle: {
    label: 'Seleccioná una terminal',
    icon: <MonitorSmartphone className="h-10 w-10 text-muted-foreground" />,
    color: 'text-muted-foreground',
  },
  creating: {
    label: 'Enviando cobro a la terminal...',
    icon: <Loader2 className="h-10 w-10 animate-spin text-primary" />,
    color: 'text-primary',
  },
  pending: {
    label: 'Esperando en terminal...',
    icon: <Loader2 className="h-10 w-10 animate-spin text-primary" />,
    color: 'text-primary',
  },
  on_terminal: {
    label: 'Cliente acercando tarjeta...',
    icon: <Loader2 className="h-10 w-10 animate-spin text-primary" />,
    color: 'text-primary',
  },
  approved: {
    label: '¡Pago aprobado!',
    icon: <CheckCircle2 className="h-10 w-10 text-green-600" />,
    color: 'text-green-600',
  },
  rejected: {
    label: 'Pago rechazado',
    icon: <XCircle className="h-10 w-10 text-destructive" />,
    color: 'text-destructive',
  },
  cancelled: {
    label: 'Pago cancelado',
    icon: <XCircle className="h-10 w-10 text-muted-foreground" />,
    color: 'text-muted-foreground',
  },
  timeout: {
    label: 'Tiempo agotado',
    icon: <Clock className="h-10 w-10 text-amber-600" />,
    color: 'text-amber-600',
  },
  error: {
    label: 'Error al procesar',
    icon: <XCircle className="h-10 w-10 text-destructive" />,
    color: 'text-destructive',
  },
};

export function MpTerminalPaymentDialog({
  open,
  amountPesos,
  description,
  onSuccess,
  onCancel,
}: MpTerminalPaymentDialogProps) {
  const { currentSucursal } = useSucursal();
  const { devices, syncDevices, getDevicesForSucursal } = useMercadoPago();
  const { status, intentId, errorMessage, createIntent, cancelIntent, reset } =
    useMpPaymentIntent();

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const sucursalDevices: MpDevice[] = currentSucursal
    ? getDevicesForSucursal(currentSucursal.id)
    : [];

  // Auto-select if only one device
  useEffect(() => {
    if (open && sucursalDevices.length === 1 && !selectedDeviceId) {
      setSelectedDeviceId(sucursalDevices[0].mp_device_id);
    }
  }, [open, sucursalDevices, selectedDeviceId]);

  // Trigger success callback once approved
  useEffect(() => {
    if (status === 'approved' && intentId) {
      // Brief delay so the user sees the success state before the dialog closes
      const t = setTimeout(() => onSuccess(intentId), 1200);
      return () => clearTimeout(t);
    }
  }, [status, intentId, onSuccess]);

  // Load devices when dialog opens if list is empty
  useEffect(() => {
    if (open && devices.length === 0) {
      syncDevices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSend = async () => {
    if (!selectedDeviceId) return;
    await createIntent(selectedDeviceId, amountPesos, description);
  };

  const handleCancelOrClose = async () => {
    const isWaiting =
      status === 'pending' || status === 'on_terminal' || status === 'creating';

    if (isWaiting && selectedDeviceId) {
      await cancelIntent(selectedDeviceId);
    }
    reset();
    setSelectedDeviceId('');
    onCancel();
  };

  const handleRetry = () => {
    reset();
  };

  const isWaiting = status === 'creating' || status === 'pending' || status === 'on_terminal';
  const isTerminal = status === 'approved' || status === 'rejected' || status === 'cancelled' || status === 'timeout' || status === 'error';
  const config = STATUS_CONFIG[status];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleCancelOrClose()}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Cobrar con Terminal</DialogTitle>
          <DialogDescription>
            Total a cobrar:{' '}
            <span className="font-semibold text-foreground">
              ${amountPesos.toLocaleString('es-AR')}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Status indicator */}
          <div className="flex flex-col items-center gap-3 py-4">
            {config.icon}
            <p className={cn('text-sm font-medium', config.color)}>{config.label}</p>
            {errorMessage && (
              <p className="text-xs text-muted-foreground text-center">{errorMessage}</p>
            )}
          </div>

          {/* Device selector — only shown when idle */}
          {status === 'idle' && (
            <div className="space-y-2">
              {sucursalDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center">
                  No hay terminales asignadas a esta sucursal.{' '}
                  <span className="underline cursor-pointer" onClick={syncDevices}>
                    Sincronizar terminales
                  </span>
                </p>
              ) : (
                <>
                  <label className="text-sm font-medium">Terminal</label>
                  <Select
                    value={selectedDeviceId}
                    onValueChange={setSelectedDeviceId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná una terminal" />
                    </SelectTrigger>
                    <SelectContent>
                      {sucursalDevices.map((d) => (
                        <SelectItem key={d.mp_device_id} value={d.mp_device_id}>
                          <span className="flex items-center gap-2">
                            <MonitorSmartphone className="h-4 w-4" />
                            {d.name || d.mp_device_id}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {/* Idle: send to terminal */}
          {status === 'idle' && (
            <>
              <Button variant="outline" onClick={handleCancelOrClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleSend}
                disabled={!selectedDeviceId || sucursalDevices.length === 0}
              >
                Enviar a terminal
              </Button>
            </>
          )}

          {/* Waiting: only cancel */}
          {isWaiting && (
            <Button variant="outline" onClick={handleCancelOrClose}>
              Cancelar cobro
            </Button>
          )}

          {/* Terminal states: retry or close */}
          {isTerminal && status !== 'approved' && (
            <>
              <Button variant="outline" onClick={handleCancelOrClose}>
                Cerrar
              </Button>
              <Button onClick={handleRetry}>Reintentar</Button>
            </>
          )}

          {/* Approved: auto-closes, but show a placeholder while waiting */}
          {status === 'approved' && (
            <Button disabled className="gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
