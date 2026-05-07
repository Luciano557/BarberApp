import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DayOffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  sucursalId: string;
  defaultDate: Date;
  onCreated: () => void;
}

export function DayOffDialog({ open, onOpenChange, organizationId, sucursalId, defaultDate, onCreated }: DayOffDialogProps) {
  const [fechaInicio, setFechaInicio] = useState(format(defaultDate, 'yyyy-MM-dd'));
  const [fechaFin, setFechaFin] = useState(format(defaultDate, 'yyyy-MM-dd'));
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (fechaFin < fechaInicio) { toast.error('La fecha fin no puede ser anterior'); return; }
    setSaving(true);
    const { error } = await supabase.from('bloqueos_agenda').insert({
      organization_id: organizationId,
      sucursal_id: sucursalId,
      barbero_id: null,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      todo_el_dia: true,
      motivo: motivo.trim().slice(0, 240) || null,
    });
    setSaving(false);
    if (error) { toast.error('Error al crear el día off'); return; }
    toast.success('Día off registrado. Las reservas online estarán bloqueadas.');
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Día off de la sucursal</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Cierra la sucursal completa para una fecha o rango. Impide reservas online y operación interna ese día.
          </p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo (opcional)</Label>
            <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={240} rows={2} placeholder="Feriado, mantenimiento…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando…' : 'Cerrar día'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
