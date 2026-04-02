import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, Loader2, Shield, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function PinConfigSection() {
  const { profile } = useAuth();
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [currentPin, setCurrentPin] = useState('');
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  // Check if user's barbero has PIN via barberos.pin_hash
  const checkHasPin = async () => {
    if (!profile?.barbero_id) {
      setHasPin(false);
      setIsLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('barberos')
        .select('pin_hash')
        .eq('id', profile.barbero_id)
        .single();

      if (error) throw error;
      setHasPin(!!data?.pin_hash);
    } catch (error) {
      console.error('Error checking PIN:', error);
      setHasPin(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkHasPin();
  }, [profile?.barbero_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hasPin && currentPin.length < 4) {
      toast.error('Ingresá tu PIN actual');
      return;
    }

    if (pin !== confirmPin) {
      toast.error('Los PINs no coinciden');
      return;
    }

    if (pin.length < 4 || pin.length > 6) {
      toast.error('El PIN debe tener entre 4 y 6 dígitos');
      return;
    }

    setIsSaving(true);

    try {
      // Use set-pin function without barbero_id — it will auto-detect from profile
      const { data, error } = await supabase.functions.invoke('set-pin', {
        body: { pin, ...(hasPin ? { currentPin } : {}) }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(hasPin ? 'PIN actualizado correctamente' : 'PIN configurado correctamente');
        setHasPin(true);
        setCurrentPin('');
        setPin('');
        setConfirmPin('');
      } else {
        throw new Error(data.error || 'Error al configurar PIN');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al configurar el PIN');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke('set-pin', {
        body: { action: 'delete', currentPin }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('PIN eliminado correctamente');
        setHasPin(false);
        setCurrentPin('');
        setPin('');
        setConfirmPin('');
      } else {
        throw new Error(data.error || 'Error al eliminar PIN');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar el PIN');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setter(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!profile?.barbero_id) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>No tienes un perfil de barbero vinculado. Contactá al dueño o encargado para que te vincule.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>PIN de Seguridad</CardTitle>
          </div>
          <CardDescription>
            Configura un PIN personal para acceder a las secciones protegidas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasPin && (
            <Alert className="mb-6">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Ya tienes un PIN configurado. Puedes cambiarlo ingresando uno nuevo.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {hasPin && (
              <div className="space-y-2">
                <Label htmlFor="current-pin">PIN actual</Label>
                <div className="relative">
                  <Input
                    id="current-pin"
                    type={showCurrentPin ? 'text' : 'password'}
                    inputMode="numeric"
                    value={currentPin}
                    onChange={(e) => handlePinChange(e, setCurrentPin)}
                    placeholder="Ingresá tu PIN actual"
                    className="pr-10"
                    maxLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowCurrentPin(!showCurrentPin)}
                  >
                    {showCurrentPin ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-pin">{hasPin ? 'Nuevo PIN' : 'PIN'}</Label>
                <div className="relative">
                  <Input
                    id="new-pin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) => handlePinChange(e, setPin)}
                    placeholder="4-6 dígitos"
                    className="pr-10"
                    maxLength={6}
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-pin">Confirmar PIN</Label>
                <div className="relative">
                  <Input
                    id="confirm-pin"
                    type={showConfirmPin ? 'text' : 'password'}
                    inputMode="numeric"
                    value={confirmPin}
                    onChange={(e) => handlePinChange(e, setConfirmPin)}
                    placeholder="Repite el PIN"
                    className="pr-10"
                    maxLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPin(!showConfirmPin)}
                  >
                    {showConfirmPin ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {pin && confirmPin && pin !== confirmPin && (
              <p className="text-sm text-destructive">Los PINs no coinciden</p>
            )}

            <div className="flex gap-4">
              <Button 
                type="submit" 
                disabled={pin.length < 4 || pin !== confirmPin || isSaving || (hasPin && currentPin.length < 4)}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    {hasPin ? 'Cambiar PIN' : 'Configurar PIN'}
                  </>
                )}
              </Button>

              {hasPin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" type="button" disabled={isDeleting}>
                      {isDeleting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Eliminar PIN
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar PIN?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Si eliminas tu PIN, perderás acceso a las secciones protegidas hasta que configures uno nuevo.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">¿Cómo funciona?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• El PIN te permite acceder a secciones protegidas como Finanzas, Mi Negocio y Configuración.</p>
          <p>• Una vez desbloqueado, el acceso permanece activo por 4 minutos.</p>
          <p>• Se bloquea automáticamente por inactividad.</p>
          <p>• Cada acceso queda registrado para auditoría.</p>
        </CardContent>
      </Card>
    </div>
  );
}
