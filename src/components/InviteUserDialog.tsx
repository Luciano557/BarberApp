import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Mail, Loader2, Check, Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Barber } from '@/types/barbershop';
import { Sucursal } from '@/contexts/SucursalContext';
import { DrawerForm } from '@/components/ui/drawer-form';
import { EmptySelectHint } from '@/components/agenda/EmptySelectHint';

function buildInviteSchema(hasSucursales: boolean) {
  return z.object({
    email: z.string().trim().email({ message: 'Email inválido' }).max(255),
    fullName: z.string().trim().min(2, { message: 'El nombre debe tener al menos 2 caracteres' }).max(100),
    role: z.union([z.literal('barber'), z.literal('manager'), z.literal('general_manager'), z.literal('')]),
    sucursalId: z.string().optional().default(''),
  }).superRefine((data, ctx) => {
    if (!data.role) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['role'], message: 'Seleccioná un rol' });
    }
    // Sin sucursales disponibles no se le puede mostrar el campo al usuario —
    // no exigirle algo que no puede completar (bug reportado en la auditoría).
    if (data.role === 'manager' && hasSucursales && !data.sucursalId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sucursalId'], message: 'Seleccioná una sucursal para el encargado' });
    }
  });
}

type InviteFormValues = {
  email: string;
  fullName: string;
  role: 'barber' | 'manager' | 'general_manager' | '';
  sucursalId: string;
};

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barber?: Barber;
  sucursales?: Sucursal[];
  onSuccess?: () => void;
}

export function InviteUserDialog({ open, onOpenChange, barber, sucursales = [], onSuccess }: InviteUserDialogProps) {
  const { organization } = useOrganization();

  const barberFullName = barber ? `${barber.firstName} ${barber.lastName}`.trim() : '';
  const hasSucursales = sucursales.length > 0;

  const defaults = (): InviteFormValues => ({
    email: '',
    fullName: barberFullName,
    role: barber ? 'barber' : '',
    sucursalId: '',
  });

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(buildInviteSchema(hasSucursales)),
    defaultValues: defaults(),
  });

  const isLoading = form.formState.isSubmitting;
  const roleWatch = form.watch('role');

  // createdCredentials + el resto de este bloque no son parte del form — son la
  // vista de "éxito" post-submit, sin campos editables por el usuario.
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  useEffect(() => {
    if (open) {
      form.reset(defaults());
      setCreatedCredentials(null);
      setShowPassword(false);
      setCopiedEmail(false);
      setCopiedPassword(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, barber?.id, barberFullName]);

  const copyEmail = async () => {
    if (!createdCredentials) return;
    await navigator.clipboard.writeText(createdCredentials.email);
    setCopiedEmail(true);
    toast.success('Email copiado');
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const copyPassword = async () => {
    if (!createdCredentials) return;
    await navigator.clipboard.writeText(createdCredentials.password);
    setCopiedPassword(true);
    toast.success('Contraseña copiada');
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const onSubmit = async (values: InviteFormValues) => {
    if (!organization) {
      toast.error('Error: No se encontró la organización');
      return;
    }

    try {
      const response = await supabase.functions.invoke('invite-user', {
        body: {
          email: values.email.trim(),
          fullName: values.fullName.trim(),
          role: values.role,
          barberoId: barber?.id,
          organizationId: organization.id,
          organizationName: organization.name,
          sucursalId: values.role === 'manager' ? values.sucursalId : undefined,
        },
      });

      // Parse structured error from edge function (supabase-js wraps non-2xx as error)
      const parsedErr: any = response.error
        ? (() => {
            const ctx: any = (response.error as any)?.context;
            return ctx?.body || null;
          })()
        : null;
      const errCode: string | undefined = parsedErr?.code ?? response.data?.code;
      const errMsg: string | undefined = parsedErr?.error ?? response.data?.error ?? (response.error?.message);

      if (errCode === 'EMAIL_BELONGS_TO_OWNER' || errCode === 'EMAIL_ALREADY_REGISTERED') {
        form.setError('email', {
          message: errCode === 'EMAIL_BELONGS_TO_OWNER'
            ? 'Este email pertenece al dueño de la organización.'
            : 'Este email ya está registrado en el sistema.',
        });
        return;
      }

      if (response.error) {
        throw new Error(errMsg || response.error.message);
      }

      if (response.data?.error) {
        throw new Error(errMsg || response.data.error);
      }

      // Show credentials on screen
      if (response.data?.tempPassword) {
        setCreatedCredentials({
          email: values.email.trim(),
          password: response.data.tempPassword,
        });
        toast.success('¡Usuario creado!', {
          description: 'Compartí las credenciales con el usuario',
        });
        onSuccess?.();
      } else {
        toast.success('¡Invitación enviada!');
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error: any) {
      console.error('Invite error:', error);
      toast.error('Error al enviar invitación', {
        description: error.message || 'Intentá de nuevo más tarde',
      });
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    form.reset(defaults());
    setCreatedCredentials(null);
    onOpenChange(false);
  };

  return (
    <DrawerForm
      open={open}
      onOpenChange={(o) => { if (!o) handleClose(); }}
      title="Invitar usuario"
      size="md"
      isDirty={!createdCredentials && form.formState.isDirty}
      footer={
        createdCredentials ? (
          <div className="flex w-full justify-end">
            <Button onClick={handleClose}>Cerrar</Button>
          </div>
        ) : (
          <div className="flex w-full justify-between">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" form="invite-form" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Enviar invitación
                </>
              )}
            </Button>
          </div>
        )
      }
    >
      {createdCredentials ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-status-success-foreground">
            <Check className="w-5 h-5" />
            <span className="text-lg font-semibold">¡Usuario creado!</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Compartí estas credenciales con {form.getValues('fullName') || 'el usuario'}. Deberá cambiar la contraseña en su primer inicio de sesión.
          </p>

          <div className="bg-muted rounded-lg p-4 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Email</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 bg-background px-3 py-2 rounded border font-mono text-sm truncate">
                  {createdCredentials.email}
                </code>
                <Button type="button" variant="ghost" size="icon" onClick={copyEmail} title="Copiar email">
                  {copiedEmail ? <Check className="w-4 h-4 text-status-success-foreground" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Contraseña temporal</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 bg-background px-3 py-2 rounded border font-mono text-sm">
                  {showPassword ? createdCredentials.password : '••••••••••'}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={copyPassword} title="Copiar contraseña">
                  {copiedPassword ? <Check className="w-4 h-4 text-status-success-foreground" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-status-warning-bg border border-status-warning rounded-lg p-3 text-sm text-status-warning-foreground">
            <strong>Importante:</strong> Esta contraseña solo se muestra una vez. Asegurate de compartirla de forma segura.
          </div>
        </div>
      ) : (
        <Form {...form}>
          <form id="invite-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {barber
                ? `Enviar invitación a ${barber.firstName} ${barber.lastName} para que acceda al sistema`
                : 'Envía una invitación por email con credenciales de acceso'
              }
            </p>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        {...field}
                        type="email"
                        placeholder="barbero@email.com"
                        className="pl-10"
                        maxLength={255}
                        disabled={isLoading}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Juan Pérez"
                      maxLength={100}
                      disabled={isLoading || !!barber}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value: 'barber' | 'manager' | 'general_manager') => {
                      field.onChange(value);
                      if (value !== 'manager') form.setValue('sucursalId', '');
                    }}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar rol" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="barber">Barbero</SelectItem>
                      <SelectItem value="manager">Encargado de Sucursal</SelectItem>
                      <SelectItem value="general_manager">Encargado General</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {roleWatch === 'manager' && (
              hasSucursales ? (
                <FormField
                  control={form.control}
                  name="sucursalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sucursal asignada</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar sucursal" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sucursales.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <EmptySelectHint
                  message="No hay sucursales creadas todavía."
                  ctaLabel="Cómo resolverlo"
                  onCta={() => toast.message('Cerrá esta ventana y creá una sucursal desde Mi Negocio antes de asignar un encargado.')}
                />
              )
            )}

            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <p>Se enviará un email con:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Credenciales de acceso provisionales</li>
                <li>Instrucciones para cambiar la contraseña</li>
              </ul>
            </div>
          </form>
        </Form>
      )}
    </DrawerForm>
  );
}
