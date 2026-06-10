import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Copy, AlertTriangle } from 'lucide-react';
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
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-sucursal-account-password', {
        body: { sucursalId },
      });
      if (error) throw error;
      if (!data?.success || !data?.tempPassword) throw new Error(data?.error || 'Respuesta inválida');
      setTempPassword(data.tempPassword);
      toast.success('Contraseña regenerada');
      onCompleted?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'No se pudo regenerar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (loading) return;
    if (!v) setTempPassword(null);
    onOpenChange(v);
  };

  const handleCopy = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    toast.success('Contraseña copiada');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {tempPassword ? (
          <>
            <DialogHeader>
              <DialogTitle>Contraseña temporal generada</DialogTitle>
              <DialogDescription>
                Copiala ahora. Por seguridad, no se vuelve a mostrar.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Contraseña temporal</Label>
                <div className="flex gap-2">
                  <Input readOnly value={tempPassword} className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={handleCopy}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex gap-2 text-xs text-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Esta contraseña solo se muestra ahora. Si cerrás este diálogo sin copiarla, vas a tener que regenerarla.
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Listo</Button>
            </DialogFooter>
          </>
        ) : (
          <>
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
              La nueva contraseña temporal se mostrará una sola vez en este diálogo. Copiala antes de cerrar.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Regenerando…</> : 'Regenerar contraseña'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
