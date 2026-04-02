import { useState, useEffect } from 'react';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, UserPlus, Loader2, Check, Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Barber } from '@/types/barbershop';
import { Sucursal } from '@/contexts/SucursalContext';

const inviteSchema = z.object({
  email: z.string().trim().email({ message: "Email inválido" }).max(255),
  fullName: z.string().trim().min(2, { message: "El nombre debe tener al menos 2 caracteres" }).max(100),
  role: z.enum(["barber", "manager", "general_manager"], { required_error: "Seleccioná un rol" }),
});

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barber?: Barber;
  sucursales?: Sucursal[];
  onSuccess?: () => void;
}

export function InviteUserDialog({ open, onOpenChange, barber, sucursales = [], onSuccess }: InviteUserDialogProps) {
  const { organization } = useOrganization();
  const [isLoading, setIsLoading] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [selectedSucursalId, setSelectedSucursalId] = useState('');
  
  const barberFullName = barber ? `${barber.firstName} ${barber.lastName}`.trim() : '';
  
  const [formData, setFormData] = useState({
    email: '',
    fullName: barberFullName,
    role: barber ? 'barber' : '' as 'barber' | 'manager' | 'general_manager' | '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form data when barber changes or dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        email: '',
        fullName: barberFullName,
        role: barber ? 'barber' : '',
      });
      setErrors({});
      setCreatedCredentials(null);
      setShowPassword(false);
      setCopiedEmail(false);
      setCopiedPassword(false);
    }
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


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate
    const result = inviteSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    if (!organization) {
      toast.error('Error: No se encontró la organización');
      return;
    }

    setIsLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('invite-user', {
        body: {
          email: formData.email.trim(),
          fullName: formData.fullName.trim(),
          role: formData.role,
          barberoId: barber?.id,
          organizationId: organization.id,
          organizationName: organization.name,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        // Handle specific error messages
        if (response.data.error.includes('Ya existe un usuario') || response.data.error.includes('already been registered')) {
          throw new Error('Ya existe una cuenta con ese email. El usuario puede iniciar sesión directamente.');
        }
        throw new Error(response.data.error);
      }

      // Show credentials on screen
      if (response.data?.tempPassword) {
        setCreatedCredentials({
          email: formData.email.trim(),
          password: response.data.tempPassword,
        });
        toast.success('¡Usuario creado!', {
          description: 'Compartí las credenciales con el usuario',
        });
        onSuccess?.();
      } else {
        toast.success('¡Invitación enviada!');
        setFormData({ email: '', fullName: '', role: '' });
        onOpenChange(false);
        onSuccess?.();
      }

    } catch (error: any) {
      console.error('Invite error:', error);
      toast.error('Error al enviar invitación', {
        description: error.message || 'Intentá de nuevo más tarde',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({ email: '', fullName: barber ? `${barber.firstName} ${barber.lastName}` : '', role: barber ? 'barber' : '' });
      setErrors({});
      setCreatedCredentials(null);
      setShowPassword(false);
      setCopiedEmail(false);
      setCopiedPassword(false);
      onOpenChange(false);
    }
  };

  // Show success screen with credentials
  if (createdCredentials) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              ¡Usuario creado!
            </DialogTitle>
            <DialogDescription>
              Compartí estas credenciales con {formData.fullName || 'el usuario'}. Deberá cambiar la contraseña en su primer inicio de sesión.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Email</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-background px-3 py-2 rounded border font-mono text-sm truncate">
                    {createdCredentials.email}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={copyEmail}
                    title="Copiar email"
                  >
                    {copiedEmail ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Contraseña temporal</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-background px-3 py-2 rounded border font-mono text-sm">
                    {showPassword ? createdCredentials.password : '••••••••••'}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "Ocultar" : "Mostrar"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={copyPassword}
                    title="Copiar contraseña"
                  >
                    {copiedPassword ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
              ⚠️ <strong>Importante:</strong> Esta contraseña solo se muestra una vez. Asegurate de compartirla de forma segura.
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Invitar Usuario
          </DialogTitle>
          <DialogDescription>
            {barber 
              ? `Enviar invitación a ${barber.firstName} ${barber.lastName} para que acceda al sistema`
              : 'Envía una invitación por email con credenciales de acceso'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="invite-email"
                type="email"
                placeholder="barbero@email.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-name">Nombre completo</Label>
            <Input
              id="invite-name"
              type="text"
              placeholder="Juan Pérez"
              value={formData.fullName}
              onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
              disabled={isLoading || !!barber}
            />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Rol</Label>
            <Select 
              value={formData.role} 
              onValueChange={(value: 'barber' | 'manager' | 'general_manager') => setFormData(prev => ({ ...prev, role: value }))}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="barber">Barbero</SelectItem>
                <SelectItem value="manager">Encargado de Local</SelectItem>
                <SelectItem value="general_manager">Encargado General</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            <p>Se enviará un email con:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Credenciales de acceso provisionales</li>
              <li>Instrucciones para cambiar la contraseña</li>
            </ul>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
