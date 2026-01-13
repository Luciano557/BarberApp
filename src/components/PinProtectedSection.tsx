import { ReactNode, useState } from 'react';
import { usePinProtection } from '@/hooks/usePinProtection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PinProtectedSectionProps {
  children: ReactNode;
  sectionName?: string;
}

export function PinProtectedSection({ children, sectionName = 'esta sección' }: PinProtectedSectionProps) {
  const { isUnlocked, requiresPin, unlockedBy, isLoading, validatePin } = usePinProtection();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsValidating(true);

    try {
      const result = await validatePin(pin);
      if (!result.success) {
        setError('PIN incorrecto. Intenta de nuevo.');
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

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If no PIN is required (user doesn't have one or doesn't have permission), show content directly
  if (!requiresPin) {
    return <>{children}</>;
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
  const { isUnlocked, lock, hasPin, requiresPin } = usePinProtection();

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
