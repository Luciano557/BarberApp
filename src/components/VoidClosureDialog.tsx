import { XCircle, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { VOID_REASONS, VoidClosureData } from '@/hooks/useVoidClosure';

interface VoidClosureDialogProps {
  open: boolean;
  voidingClosure: VoidClosureData | null;
  voidReason: string;
  onVoidReasonChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function VoidClosureDialog({
  open,
  voidingClosure,
  voidReason,
  onVoidReasonChange,
  onConfirm,
  onCancel,
  isLoading,
}: VoidClosureDialogProps) {
  const dateLabel = voidingClosure
    ? format(parseISO(voidingClosure.fechaCierre), "d 'de' MMMM yyyy", { locale: es })
    : '';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Anular cierre de caja
          </DialogTitle>
          <DialogDescription>
            Esta acción anulará el cierre de caja de{' '}
            <span className="font-semibold">{voidingClosure?.barberName}</span> para el día{' '}
            <span className="font-semibold">{dateLabel}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="void-reason" className="text-sm font-medium">
              Motivo de la anulación <span className="text-destructive">*</span>
            </Label>
            <Select value={voidReason} onValueChange={onVoidReasonChange}>
              <SelectTrigger id="void-reason">
                <SelectValue placeholder="Seleccioná un motivo" />
              </SelectTrigger>
              <SelectContent>
                {VOID_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Al anular el cierre:</p>
            <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
              <li>El registro se marcará como eliminado</li>
              <li>Se guardará un registro de quién realizó la anulación</li>
              <li>El barbero podrá realizar un nuevo cierre de caja</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={isLoading || !voidReason}
            onClick={onConfirm}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4 mr-2" />
            )}
            {isLoading ? 'Anulando...' : 'Confirmar anulación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
