import { ReactNode, useState } from 'react';
import { usePinProtection } from '@/hooks/usePinProtection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, User, Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PinProtectedSectionProps {
  children: ReactNode;
  sectionName?: string;
}

export function PinProtectedSection({ children, sectionName = 'esta sección' }: PinProtectedSectionProps) {
  const { isUnlocked, requiresPin, needsPinSetup, unlockedBy, isLoading, validatePin, checkHasPin } = usePinProtection();
  const { profile } = useAuth();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PIN setup state
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsValidating(true);

    try {
      const result = await validatePin(pin);
      if (!result.success) {
        setError(result.error || 'PIN incorrecto. Intenta de nuevo.');
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

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPin !== confirmPin) {
      setError('Los PINs no coinciden');
      return;
    }
    if (newPin.length < 4 || newPin.length > 6) {
      setError('El PIN debe tener entre 4 y 6 dígitos');
      return;
    }

    setIsSettingUp(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('set-pin', {
        body: { pin: newPin }
      });

      if (fnError) throw fnError;

      if (data.success) {
        toast.success('PIN configurado correctamente');
        setNewPin('');
        setConfirmPin('');
        // Refresh PIN state, then user can validate with their new PIN
        await checkHasPin();
      } else {
        throw new Error(data.error || 'Error al configurar PIN');
      }
    } catch (err: any) {
      setError(err.message || 'Error al configurar el PIN');
    } finally {
      setIsSettingUp(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If no PIN is required, show content directly
  if (!requiresPin) {
    return <>{children}</>;
  }

  // If user needs to set up their own PIN first
  if (needsPinSetup && !isUnlocked) {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-2">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Configurá tu PIN</CardTitle>
          <CardDescription>
            Para acceder a {sectionName}, primero necesitás crear tu PIN de seguridad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetupSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-pin">Nuevo PIN (4-6 dígitos)</Label>
              <div className="relative">
                <Input
                  id="new-pin"
                  type={showNewPin ? 'text' : 'password'}
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Ingresá tu nuevo PIN"
                  className="pr-10 text-center text-2xl tracking-widest"
                  maxLength={6}
                  autoFocus
                  disabled={isSettingUp}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNewPin(!showNewPin)}
                >
                  {showNewPin ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-pin">Confirmar PIN</Label>
              <div className="relative">
                <Input
                  id="confirm-pin"
                  type={showConfirmPin ? 'text' : 'password'}
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Repetí el PIN"
                  className="pr-10 text-center text-2xl tracking-widest"
                  maxLength={6}
                  disabled={isSettingUp}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPin(!showConfirmPin)}
                >
                  {showConfirmPin ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              className="w-full"
              disabled={newPin.length < 4 || newPin !== confirmPin || isSettingUp}
            >
              {isSettingUp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Configurando...
                </>
              ) : (
                'Crear PIN y continuar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // If PIN is required but not unlocked, show inline PIN form
  if (!isUnlocked) {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-2">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Sección protegida</CardTitle>
          <CardDescription>
            Ingresa tu PIN para acceder a {sectionName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">PIN de seguridad</Label>
              <div className="relative">
                <Input
                  id="pin"
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={handlePinChange}
                  placeholder="Ingresa tu PIN"
                  className="pr-10 text-center text-2xl tracking-widest"
                  maxLength={6}
                  autoFocus
                  disabled={isValidating}
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

          <p className="text-xs text-center text-muted-foreground mt-4">
            El acceso se bloqueará automáticamente después de 4 minutos de inactividad
          </p>
        </CardContent>
      </Card>
    );
  }

  // Unlocked - show content with unlock info
  return (
    <div className="space-y-4">
      {unlockedBy && (
        <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Desbloqueado por: <strong className="text-foreground">{unlockedBy}</strong></span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

// Export a lock button component for the sidebar
export function PinLockButton() {
  const { isUnlocked, requiresPin, lock } = usePinProtection();

  if (!requiresPin || !isUnlocked) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={lock}
      className="gap-2 text-muted-foreground hover:text-foreground"
    >
      <Lock className="h-4 w-4" />
      Bloquear
    </Button>
  );
}
