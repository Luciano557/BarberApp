import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sucursalId: string;
  sucursalNombre: string;
  onCompleted?: () => void;
}

export function RegenerarPasswordDialog({ open, onOpenChange, sucursalId, sucursalNombre, onCompleted }: Props) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-sucursal-account-password', {
        body: { sucursalId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Respuesta inválida');
      toast.success('Contraseña regenerada');
      onCompleted?.();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'No se pudo regenerar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Regenerar contraseña</DialogTitle>
          <DialogDescription>
            Esto cerrará las sesiones activas de esta Cuenta de sucursal y generará una nueva contraseña temporal.
            La persona que use esta cuenta deberá iniciar sesión nuevamente y cambiarla.
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Sucursal: <span className="text-foreground">{sucursalNombre}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          La nueva contraseña temporal quedará visible en esta pantalla hasta que la Cuenta de sucursal inicie sesión y la cambie.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Regenerando…</> : 'Regenerar contraseña'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
