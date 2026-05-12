import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Copy, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sucursalId: string;
  sucursalNombre: string;
  onCompleted?: () => void;
}

export function RegenerarPasswordDialog({ open, onOpenChange, sucursalId, sucursalNombre, onCompleted }: Props) {
  const [step, setStep] = useState<'confirm' | 'result'>('confirm');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);

  const reset = () => {
    setStep('confirm');
    setResult(null);
    setLoading(false);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-sucursal-account-password', {
        body: { sucursalId },
      });
      if (error) throw error;
      if (!data?.tempPassword || !data?.email) {
        throw new Error('Respuesta inválida');
      }
      setResult({ email: data.email, tempPassword: data.tempPassword });
      setStep('result');
      onCompleted?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'No se pudo regenerar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      onOpenChange(false);
      // limpiar después del cierre para que la contraseña no quede en memoria visible
      setTimeout(reset, 200);
    } else {
      onOpenChange(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => { if (step === 'result') e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (step === 'result') e.preventDefault(); }}
      >
        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>Regenerar contraseña</DialogTitle>
              <DialogDescription>
                Esto cerrará las sesiones activas de esta Cuenta de sucursal y generará una nueva contraseña temporal.
                La persona que use esta cuenta deberá iniciar sesión nuevamente y cambiar la contraseña.
              </DialogDescription>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              Sucursal: <span className="text-foreground">{sucursalNombre}</span>
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Regenerando…</> : 'Regenerar contraseña'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'result' && result && (
          <>
            <DialogHeader>
              <DialogTitle>Nueva contraseña temporal</DialogTitle>
              <DialogDescription>
                Guardá esta contraseña ahora. Por seguridad, Vittro no podrá mostrártela de nuevo.
                Si la perdés, vas a tener que regenerarla.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex gap-2 text-xs text-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <span>Solo se mostrará esta vez. Copiala antes de cerrar.</span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input readOnly value={result.email} className="font-mono text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Contraseña temporal</Label>
                <div className="flex gap-2">
                  <Input readOnly value={result.tempPassword} className="font-mono text-sm" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(result.tempPassword);
                      toast.success('Contraseña copiada');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Entendido</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
