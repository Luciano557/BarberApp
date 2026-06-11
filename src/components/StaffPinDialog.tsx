import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DrawerForm } from '@/components/ui/drawer-form';

interface StaffPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barberId: string;
  barberName: string;
  hasPin: boolean;
  onPinUpdated: () => void;
}

export function StaffPinDialog({
  open,
  onOpenChange,
  barberId,
  barberName,
  hasPin,
  onPinUpdated
}: StaffPinDialogProps) {
  const [currentPin, setCurrentPin] = useState('');
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setter(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hasPin && currentPin.length < 4) {
      toast.error('Ingresá el PIN actual');
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
      const { data, error } = await supabase.functions.invoke('set-pin', {
        body: { barbero_id: barberId, pin, ...(hasPin ? { currentPin } : {}) }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('PIN configurado correctamente');
        setCurrentPin('');
        setPin('');
        setConfirmPin('');
        onPinUpdated();
        onOpenChange(false);
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
    if (hasPin && currentPin.length < 4) {
      toast.error('Ingresá el PIN actual para eliminarlo');
      return;
    }

    setIsDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke('set-pin', {
        body: { barbero_id: barberId, action: 'delete', currentPin }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('PIN eliminado correctamente');
        setCurrentPin('');
        onPinUpdated();
        onOpenChange(false);
      } else {
        throw new Error(data.error || 'Error al eliminar PIN');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar el PIN');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setCurrentPin('');
    setPin('');
    setConfirmPin('');
    onOpenChange(false);
  };

  return (
    <>
      <DrawerForm
        open={open}
        onOpenChange={handleClose}
        title={hasPin ? 'Cambiar PIN' : 'Configurar PIN'}
        size="sm"
        footer={
          <div className="flex w-full justify-between">
            {hasPin ? (
              <Button
                variant="destructive"
                type="button"
                disabled={isDeleting || currentPin.length < 4}
                onClick={() => setAlertOpen(true)}
              >
                {isDeleting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Eliminando...</>
                ) : (
                  <><Trash2 className="mr-2 h-4 w-4" />Eliminar PIN</>
                )}
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" type="button" onClick={handleClose}>Cancelar</Button>
              <Button
                type="submit"
                form="pin-form"
                disabled={pin.length < 4 || pin !== confirmPin || isSaving || (hasPin && currentPin.length < 4)}
              >
                {isSaving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                ) : (
                  'Guardar'
                )}
              </Button>
            </div>
          </div>
        }
      >
        <form id="pin-form" onSubmit={handleSubmit} className="space-y-4 mt-2" autoComplete="off">
          <p className="text-sm text-muted-foreground mb-4">
            Configurar PIN para <strong>{barberName}</strong>. Este PIN permite acceder a las secciones Resumen y Sueldos.
          </p>

          {hasPin && (
            <div className="space-y-2">
              <Label htmlFor="staff-current-pin">PIN actual</Label>
              <div className="relative">
                <Input
                  id="staff-current-pin"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="app-pin-current"
                  value={currentPin}
                  onChange={(e) => handlePinChange(e, setCurrentPin)}
                  placeholder="Ingresá el PIN actual"
                  className="pr-10"
                  maxLength={6}
                  autoFocus
                  autoComplete="one-time-code"
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                  style={{ WebkitTextSecurity: showCurrentPin ? 'none' : 'disc' } as React.CSSProperties}
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
              <Label htmlFor="staff-pin">{hasPin ? 'Nuevo PIN' : 'PIN'}</Label>
              <div className="relative">
                <Input
                  id="staff-pin"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="app-pin-new"
                  value={pin}
                  onChange={(e) => handlePinChange(e, setPin)}
                  placeholder="4-6 dígitos"
                  className="pr-10"
                  maxLength={6}
                  autoFocus={!hasPin}
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-confirm-pin">Confirmar PIN</Label>
              <div className="relative">
                <Input
                  id="staff-confirm-pin"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="app-pin-confirm"
                  value={confirmPin}
                  onChange={(e) => handlePinChange(e, setConfirmPin)}
                  placeholder="Repite el PIN"
                  className="pr-10"
                  maxLength={6}
                  autoComplete="one-time-code"
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                  style={{ WebkitTextSecurity: showConfirmPin ? 'none' : 'disc' } as React.CSSProperties}
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
        </form>
      </DrawerForm>

      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar PIN?</AlertDialogTitle>
            <AlertDialogDescription>
              {barberName} ya no podrá acceder a las secciones protegidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
