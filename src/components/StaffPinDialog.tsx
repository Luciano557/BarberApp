import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
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

function buildPinSchema(hasPin: boolean) {
  return z.object({
    currentPin: z.string().optional().default(''),
    pin: z.string(),
    confirmPin: z.string(),
  }).superRefine((data, ctx) => {
    if (hasPin && data.currentPin.length < 4) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['currentPin'], message: 'Ingresá el PIN actual' });
    }
    if (data.pin.length < 4 || data.pin.length > 6) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pin'], message: 'El PIN debe tener entre 4 y 6 dígitos' });
    }
    if (data.pin !== data.confirmPin) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPin'], message: 'Los PINs no coinciden' });
    }
  });
}

type PinFormValues = { currentPin: string; pin: string; confirmPin: string };

const emptyPinDefaults = (): PinFormValues => ({ currentPin: '', pin: '', confirmPin: '' });

const sanitizePin = (v: string) => v.replace(/\D/g, '').slice(0, 6);

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
  onPinUpdated,
}: StaffPinDialogProps) {
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  const form = useForm<PinFormValues>({
    resolver: zodResolver(buildPinSchema(hasPin)),
    defaultValues: emptyPinDefaults(),
  });

  const isSaving = form.formState.isSubmitting;
  const pinWatch = form.watch('pin');
  const confirmPinWatch = form.watch('confirmPin');
  const currentPinWatch = form.watch('currentPin');
  // Mensaje inline reactivo — patrón sano preservado tal cual (no depende del submit).
  const pinsMismatch = !!pinWatch && !!confirmPinWatch && pinWatch !== confirmPinWatch;
  const canSubmit = pinWatch.length >= 4 && pinWatch === confirmPinWatch && (!hasPin || currentPinWatch.length >= 4);

  useEffect(() => {
    if (open) {
      form.reset(emptyPinDefaults());
      setShowCurrentPin(false);
      setShowPin(false);
      setShowConfirmPin(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, barberId]);

  const onSubmit = async (values: PinFormValues) => {
    try {
      const { data, error } = await supabase.functions.invoke('set-pin', {
        body: { barbero_id: barberId, pin: values.pin, ...(hasPin ? { currentPin: values.currentPin } : {}) },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('PIN configurado correctamente');
        onPinUpdated();
        handleClose();
      } else {
        throw new Error(data.error || 'Error al configurar PIN');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al configurar el PIN');
    }
  };

  const handleDelete = async () => {
    const currentPin = form.getValues('currentPin');
    if (hasPin && currentPin.length < 4) {
      toast.error('Ingresá el PIN actual para eliminarlo');
      return;
    }

    setIsDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke('set-pin', {
        body: { barbero_id: barberId, action: 'delete', currentPin },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('PIN eliminado correctamente');
        onPinUpdated();
        handleClose();
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
    form.reset(emptyPinDefaults());
    onOpenChange(false);
  };

  return (
    <>
      <DrawerForm
        open={open}
        onOpenChange={(o) => { if (!o) handleClose(); }}
        title={hasPin ? 'Cambiar PIN' : 'Configurar PIN'}
        size="sm"
        isDirty={form.formState.isDirty}
        footer={
          <div className="flex w-full justify-between">
            {hasPin ? (
              <Button
                variant="destructive"
                type="button"
                disabled={isDeleting || currentPinWatch.length < 4}
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
                disabled={!canSubmit || isSaving}
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
        <Form {...form}>
          <form id="pin-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2" autoComplete="off">
            <p className="text-sm text-muted-foreground mb-4">
              Configurar PIN para <strong>{barberName}</strong>. Este PIN permite acceder a las secciones Resumen y Sueldos.
            </p>

            {hasPin && (
              <FormField
                control={form.control}
                name="currentPin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PIN actual</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          onChange={(e) => field.onChange(sanitizePin(e.target.value))}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          name="app-pin-current"
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
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="pin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{hasPin ? 'Nuevo PIN' : 'PIN'}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          onChange={(e) => field.onChange(sanitizePin(e.target.value))}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          name="app-pin-new"
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
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar PIN</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          onChange={(e) => field.onChange(sanitizePin(e.target.value))}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          name="app-pin-confirm"
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
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {pinsMismatch && (
              <p className="text-sm text-destructive">Los PINs no coinciden</p>
            )}
          </form>
        </Form>
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
