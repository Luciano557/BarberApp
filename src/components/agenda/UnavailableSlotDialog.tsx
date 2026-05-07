import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Barber } from '@/types/barbershop';
import { format } from 'date-fns';

interface UnavailableSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  sucursalId: string;
  barbers: Barber[];
  defaultDate: Date;
  defaultBarberId?: string;
  onCreated: () => void;
}

export function UnavailableSlotDialog({
  open, onOpenChange, organizationId, sucursalId, barbers, defaultDate, defaultBarberId, onCreated,
}: UnavailableSlotDialogProps) {
  const [barberoId, setBarberoId] = useState(defaultBarberId || '');
  const [fecha, setFecha] = useState(format(defaultDate, 'yyyy-MM-dd'));
  const [horaInicio, setHoraInicio] = useState('12:00');
  const [horaFin, setHoraFin] = useState('13:00');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const activeBarbers = barbers.filter(b => b.active);

  const handleSubmit = async () => {
    if (!barberoId) { toast.error('Seleccioná un barbero'); return; }
    if (horaFin <= horaInicio) { toast.error('La hora fin debe ser posterior'); return; }
    setSaving(true);
    const { error } = await supabase.from('bloqueos_agenda').insert({
      organization_id: organizationId,
      sucursal_id: sucursalId,
      barbero_id: barberoId,
      fecha_inicio: fecha,
      fecha_fin: fecha,
      todo_el_dia: false,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      motivo: motivo.trim().slice(0, 240) || null,
    });
    setSaving(false);
    if (error) { toast.error('Error al crear el bloqueo'); return; }
    toast.success('Horario no disponible registrado');
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Horario no disponible</DialogTitle>
          <p className="text-xs text-muted-foreground">Bloquea una franja horaria para un barbero específico.</p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Barbero</Label>
            <Select value={barberoId} onValueChange={setBarberoId}>
              <SelectTrigger><SelectValue placeholder="Elegir" /></SelectTrigger>
              <SelectContent>
                {activeBarbers.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.firstName} {b.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo (opcional)</Label>
            <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={240} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
