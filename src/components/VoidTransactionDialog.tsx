import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Lock, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Transaction } from '@/types/barbershop';
import { useSucursal } from '@/contexts/SucursalContext';

interface VoidTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onVoidComplete: (transactionId: string, voidedBy: string, voidedById: string) => void;
}

export function VoidTransactionDialog({ 
  open, 
  onOpenChange, 
  transaction,
  onVoidComplete
}: VoidTransactionDialogProps) {
  const { currentSucursal } = useSucursal();
  const [pin, setPin] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  const handlePinComplete = async (value: string) => {
    if (value.length < 4) return;
    
    setIsValidating(true);
    setError('');

    try {
      const { data, error: validationError } = await supabase.functions.invoke('validate-pin', {
        body: { pin: value, sucursal_id: currentSucursal?.id ?? null }
      });

      if (validationError) throw validationError;

      if (data.valid && transaction) {
        // PIN válido - proceder con la anulación
        onVoidComplete(transaction.id, data.user_name, data.barbero_id);
        handleClose();
        toast.success(`Transacción anulada por ${data.user_name}`);
      } else {
        setError(data?.error || 'PIN incorrecto');
        setPin('');
      }
    } catch (err: any) {
      console.error('Error validating PIN:', err);
      setError('Error al validar el PIN');
      setPin('');
    } finally {
      setIsValidating(false);
    }
  };

  const handleClose = () => {
    setPin('');
    setError('');
    onOpenChange(false);
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle>Anular Transacción</DialogTitle>
          </div>
          <DialogDescription>
            Estás por anular el servicio <strong>{transaction.serviceName}</strong> de <strong>{transaction.barberName}</strong> por <strong>${transaction.total.toLocaleString()}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-center space-y-2">
            <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Ingresa tu PIN para confirmar la anulación
            </p>
          </div>

          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={pin}
              onChange={setPin}
              onComplete={handlePinComplete}
              disabled={isValidating}
              inputMode="numeric"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} mask className="text-xl" />
                <InputOTPSlot index={1} mask className="text-xl" />
                <InputOTPSlot index={2} mask className="text-xl" />
                <InputOTPSlot index={3} mask className="text-xl" />
                <InputOTPSlot index={4} mask className="text-xl" />
                <InputOTPSlot index={5} mask className="text-xl" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}

          {isValidating && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Validando...</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isValidating}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
