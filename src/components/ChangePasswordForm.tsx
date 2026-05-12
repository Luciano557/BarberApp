import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface ChangePasswordFormProps {
  onSuccess: () => void;
}

export function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  const validatePassword = (value: string): boolean => {
    if (value.length < 6) {
      setErrors(prev => ({ ...prev, password: 'Mínimo 6 caracteres' }));
      return false;
    }
    setErrors(prev => ({ ...prev, password: undefined }));
    return true;
  };

  const validateConfirm = (value: string): boolean => {
    if (value !== password) {
      setErrors(prev => ({ ...prev, confirm: 'Las contraseñas no coinciden' }));
      return false;
    }
    setErrors(prev => ({ ...prev, confirm: undefined }));
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isPasswordValid = validatePassword(password);
    const isConfirmValid = validateConfirm(confirmPassword);
    
    if (!isPasswordValid || !isConfirmValid) return;

    setIsLoading(true);

    try {
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
        data: { must_change_password: false, temp_password_pending: false },
      });

      if (updateError) throw updateError;

      // If this is a sucursal_account, clear the visible temp password server-side
      const { data: { user } } = await supabase.auth.getUser();
      const isSucursalAccount = user?.user_metadata?.sucursal_account === true;
      if (isSucursalAccount) {
        try {
          await supabase.functions.invoke('clear-sucursal-temp-password');
        } catch (clearErr) {
          console.error('clear-sucursal-temp-password failed', clearErr);
        }
      }

      toast.success('¡Contraseña actualizada!', {
        description: 'Ya podés usar tu nueva contraseña para ingresar',
      });

      onSuccess();
      navigate('/');
    } catch (error: any) {
      console.error('Password change error:', error);
      toast.error('Error al cambiar la contraseña', {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Cambiar contraseña</CardTitle>
          <CardDescription>
            Es tu primer ingreso. Por seguridad, creá una nueva contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva contraseña</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (e.target.value) validatePassword(e.target.value);
                  }}
                  className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar contraseña</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (e.target.value) validateConfirm(e.target.value);
                  }}
                  className={errors.confirm ? 'border-destructive pr-10' : 'pr-10'}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirm && <p className="text-sm text-destructive">{errors.confirm}</p>}
              {confirmPassword && !errors.confirm && password === confirmPassword && (
                <p className="text-sm text-success flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Las contraseñas coinciden
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !password || !confirmPassword}
            >
              {isLoading ? 'Guardando...' : 'Guardar nueva contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
