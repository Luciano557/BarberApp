import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Transaction } from '@/types/barbershop';

interface VoidTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  /**
   * Confirmación de motivo. El caller (DailySummary) gestiona la autorización
   * por PIN vía `requirePinForAction('anular_transaccion', ...)` antes de ejecutar.
   * El diálogo se mantiene como captura de motivo para evitar autorizaciones
   * innecesarias si el usuario cancela.
   */
  onConfirm: (reason: string) => Promise<void> | void;
}

const REASON_MAX = 240;

export function VoidTransactionDialog({
  open,
  onOpenChange,
  transaction,
  onConfirm,
}: VoidTransactionDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    setReason('');
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!transaction) return null;

  const reasonRequired = reason.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle>Anular transacción</DialogTitle>
          </div>
          <DialogDescription>
            Estás por anular el servicio <strong>{transaction.serviceName}</strong> de{' '}
            <strong>{transaction.barberName}</strong> por <strong>${transaction.total.toLocaleString()}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="void-reason" className="text-sm">
            Motivo de la anulación
          </Label>
          <Textarea
            id="void-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
            placeholder="Indicá brevemente por qué se anula la transacción"
            maxLength={REASON_MAX}
            rows={3}
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground text-right">
            {reason.length}/{REASON_MAX}
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={submitting || reasonRequired}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar anulación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
