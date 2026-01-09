import { useState } from 'react';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Barber } from '@/types/barbershop';

const inviteSchema = z.object({
  email: z.string().trim().email({ message: "Email inválido" }).max(255),
  fullName: z.string().trim().min(2, { message: "El nombre debe tener al menos 2 caracteres" }).max(100),
  role: z.enum(["barber", "manager"], { required_error: "Seleccioná un rol" }),
});

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barber?: Barber; // Optional - if provided, prefills name and links to barber
  onSuccess?: () => void;
}

export function InviteUserDialog({ open, onOpenChange, barber, onSuccess }: InviteUserDialogProps) {
  const { organization } = useOrganization();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    fullName: barber ? `${barber.firstName} ${barber.lastName}` : '',
    role: barber ? 'barber' : '' as 'barber' | 'manager' | '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
        if (response.data.error.includes('Ya existe un usuario')) {
          throw new Error('Ya existe una cuenta con ese email. El usuario puede iniciar sesión directamente.');
        }
        throw new Error(response.data.error);
      }

      toast.success('¡Invitación enviada!', {
        description: `Se envió un email a ${formData.email} con las credenciales de acceso`,
      });

      // Reset form
      setFormData({ email: '', fullName: '', role: '' });
      onOpenChange(false);
      onSuccess?.();

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
      onOpenChange(false);
    }
  };

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
              onValueChange={(value: 'barber' | 'manager') => setFormData(prev => ({ ...prev, role: value }))}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="barber">Barbero</SelectItem>
                <SelectItem value="manager">Encargado</SelectItem>
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
