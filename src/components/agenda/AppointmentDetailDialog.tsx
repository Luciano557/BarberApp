import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Phone, Calendar, User, Scissors, X } from 'lucide-react';
import { Barber } from '@/types/barbershop';
import { Turno, Servicio } from './hooks/useAgendaData';
import { formatHHMM } from './lib/timeUtils';

interface AppointmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turno: Turno | null;
  barbers: Barber[];
  servicios: Servicio[];
  onChanged: () => void;
}

export function AppointmentDetailDialog({ open, onOpenChange, turno, barbers, servicios, onChanged }: AppointmentDetailDialogProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [cancelling, setCancelling] = useState(false);

  if (!turno) return null;
  const barber = barbers.find(b => b.id === turno.barbero_id);
  const servicio = servicios.find(s => s.id === turno.servicio_id);
  const canCancel = ['pendiente', 'confirmado'].includes(turno.estado);

  const handleCancel = async () => {
    setCancelling(true);
    const { error } = await supabase.from('turnos').update({
      estado: 'cancelado',
      cancelado_at: new Date().toISOString(),
      cancelado_motivo: motivo.trim().slice(0, 240) || null,
    }).eq('id', turno.id);
    setCancelling(false);
    if (error) { toast.error('Error al cancelar'); return; }
    toast.success('Turno cancelado');
    setConfirmingCancel(false);
    setMotivo('');
    onOpenChange(false);
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setConfirmingCancel(false); setMotivo(''); } onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{turno.cliente_nombre || 'Sin nombre'}</DialogTitle>
            <Badge variant="outline" className="text-[10px] h-5 capitalize">{turno.estado}</Badge>
          </div>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{turno.fecha} · {formatHHMM(turno.hora_inicio)} – {formatHHMM(turno.hora_fin)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Scissors className="h-4 w-4" />
            <span>{servicio?.nombre || 'Servicio'}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{barber ? `${barber.firstName} ${barber.lastName}` : '—'}</span>
          </div>
          {turno.cliente_telefono && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{turno.cliente_telefono}</span>
            </div>
          )}
          {turno.notas && (
            <div className="text-xs text-muted-foreground border-l-2 border-border pl-3">{turno.notas}</div>
          )}

          {confirmingCancel && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs text-muted-foreground">Motivo de cancelación (opcional)</p>
              <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={240} rows={2} />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          {!confirmingCancel ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
              {canCancel && (
                <Button variant="destructive" onClick={() => setConfirmingCancel(true)}>
                  <X className="h-4 w-4" /> Cancelar turno
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setConfirmingCancel(false)} disabled={cancelling}>Volver</Button>
              <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? 'Cancelando…' : 'Sí, cancelar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
