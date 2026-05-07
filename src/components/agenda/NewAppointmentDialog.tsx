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
import { Servicio } from './hooks/useAgendaData';
import { timeToMinutes, minutesToTime } from './lib/timeUtils';
import { format } from 'date-fns';

interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  sucursalId: string;
  sucursalTimezone: string;
  barbers: Barber[];
  servicios: Servicio[];
  defaultDate: Date;
  defaultBarberId?: string;
  defaultHoraInicio?: string;
  onCreated: () => void;
}

export function NewAppointmentDialog({
  open, onOpenChange, organizationId, sucursalId, sucursalTimezone, barbers, servicios,
  defaultDate, defaultBarberId, defaultHoraInicio, onCreated,
}: NewAppointmentDialogProps) {
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [barberoId, setBarberoId] = useState(defaultBarberId || '');
  const [servicioId, setServicioId] = useState('');
  const [fecha, setFecha] = useState(format(defaultDate, 'yyyy-MM-dd'));
  const [horaInicio, setHoraInicio] = useState(defaultHoraInicio || '10:00');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const activeBarbers = barbers.filter(b => b.active);

  const reset = () => {
    setClienteNombre(''); setClienteTelefono(''); setClienteEmail('');
    setBarberoId(defaultBarberId || ''); setServicioId(''); setNotas('');
    setFecha(format(defaultDate, 'yyyy-MM-dd'));
    setHoraInicio(defaultHoraInicio || '10:00');
  };

  const handleSubmit = async () => {
    if (!clienteNombre.trim()) { toast.error('Ingresá el nombre del cliente'); return; }
    if (!barberoId) { toast.error('Seleccioná un barbero'); return; }
    if (!servicioId) { toast.error('Seleccioná un servicio'); return; }
    const servicio = servicios.find(s => s.id === servicioId);
    if (!servicio) return;
    setSaving(true);
    const horaFin = minutesToTime(timeToMinutes(horaInicio) + servicio.duracion_min);
    const { error } = await supabase.from('turnos').insert({
      organization_id: organizationId,
      sucursal_id: sucursalId,
      barbero_id: barberoId,
      servicio_id: servicioId,
      cliente_nombre: clienteNombre.trim().slice(0, 80),
      cliente_telefono: clienteTelefono.trim().slice(0, 80) || null,
      cliente_email: clienteEmail.trim().slice(0, 120) || null,
      fecha,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      timezone: sucursalTimezone || 'America/Argentina/Buenos_Aires',
      estado: 'pendiente',
      notas: notas.trim().slice(0, 1500) || null,
    });
    setSaving(false);
    if (error) { toast.error('Error al crear el turno'); return; }
    toast.success('Turno creado');
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva cita</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <Input value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Teléfono</Label>
              <Input value={clienteTelefono} onChange={e => setClienteTelefono(e.target.value)} maxLength={80} inputMode="tel" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email (opcional)</Label>
            <Input type="email" value={clienteEmail} onChange={e => setClienteEmail(e.target.value)} maxLength={120} />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-1">
              <Label className="text-xs">Servicio</Label>
              <Select value={servicioId} onValueChange={setServicioId}>
                <SelectTrigger><SelectValue placeholder="Elegir" /></SelectTrigger>
                <SelectContent>
                  {servicios.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre} · {s.duracion_min}min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hora inicio</Label>
              <Input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notas (opcional)</Label>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)} maxLength={1500} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando…' : 'Crear cita'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
