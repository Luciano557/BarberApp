import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

interface PinGateDialogProps {
  open: boolean;
  onValidate: (pin: string) => Promise<{ success: boolean; userName?: string }>;
  onClose?: () => void;
  sectionName?: string;
}

export function PinGateDialog({ open, onValidate, onClose, sectionName = 'esta sección' }: PinGateDialogProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPin('');
      setError(null);
      setShowPin(false);
      setIsValidating(false);
    }
  }, [open]);

  const resetState = () => {
    setPin('');
    setError(null);
    setShowPin(false);
    setIsValidating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsValidating(true);

    try {
      const result = await onValidate(pin);
      if (result.success) {
        setPin('');
        setError(null);
        setShowPin(false);
      } else {
        setError((result as any).error || 'PIN incorrecto. Intenta de nuevo.');
        setPin('');
      }
    } catch {
      setError('Error al validar el PIN.');
    } finally {
      setIsValidating(false);
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(value);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { resetState(); if (onClose) onClose(); } }}>
      <DialogContent 
        className="sm:max-w-md" 
        onPointerDownOutside={(e) => !onClose && e.preventDefault()}
        onEscapeKeyDown={(e) => !onClose && e.preventDefault()}
        hideCloseButton={!onClose}
      >
        <DialogHeader>
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Acceso protegido</DialogTitle>
          <DialogDescription className="text-center">
            Ingresa tu PIN para acceder a {sectionName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4" autoComplete="off">
          <div className="space-y-2">
            <Label htmlFor="action-auth-field">PIN de seguridad</Label>
            <div className="relative">
              <Input
                id="action-auth-field"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                name="app-pin-code"
                value={pin}
                onChange={handlePinChange}
                placeholder="Ingresa tu PIN"
                className="pr-10 text-center text-2xl tracking-widest"
                maxLength={6}
                autoFocus
                disabled={isValidating}
                autoComplete="one-time-code"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                style={{ WebkitTextSecurity: showPin ? 'none' : 'disc' } as React.CSSProperties}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={pin.length < 4 || isValidating}
          >
            {isValidating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validando...
              </>
            ) : (
              'Desbloquear'
            )}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground mt-2">
          El acceso se bloqueará automáticamente después de 4 minutos de inactividad
        </p>
      </DialogContent>
    </Dialog>
  );
}
