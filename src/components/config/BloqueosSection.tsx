import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ShieldOff, Plus, Trash2, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Barber } from '@/types/barbershop';

interface BloqueosSectionProps {
  sucursalId: string;
  organizationId: string;
  barbers: Barber[];
}

interface Bloqueo {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  todo_el_dia: boolean;
  hora_inicio: string | null;
  hora_fin: string | null;
  motivo: string | null;
  barbero_id: string | null;
}

export function BloqueosSection({ sucursalId, organizationId, barbers }: BloqueosSectionProps) {
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    todo_el_dia: true,
    hora_inicio: '09:00',
    hora_fin: '18:00',
    motivo: '',
    barbero_id: '__sucursal__',
  });

  const fetchBloqueos = useCallback(async () => {
    const { data } = await supabase
      .from('bloqueos_agenda')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .order('fecha_inicio', { ascending: false });
    if (data) {
      setBloqueos(data.map(b => ({
        id: b.id,
        fecha_inicio: b.fecha_inicio,
        fecha_fin: b.fecha_fin,
        todo_el_dia: b.todo_el_dia,
        hora_inicio: b.hora_inicio,
        hora_fin: b.hora_fin,
        motivo: b.motivo,
        barbero_id: b.barbero_id,
      })));
    }
    setLoading(false);
  }, [sucursalId]);

  useEffect(() => { fetchBloqueos(); }, [fetchBloqueos]);

  const handleCreate = async () => {
    if (!form.fecha_inicio || !form.fecha_fin) {
      toast.error('Completá las fechas');
      return;
    }
    if (form.fecha_fin < form.fecha_inicio) {
      toast.error('La fecha fin debe ser posterior a la fecha inicio');
      return;
    }
    setSaving(true);
    const insert: any = {
      sucursal_id: sucursalId,
      organization_id: organizationId,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      todo_el_dia: form.todo_el_dia,
      motivo: form.motivo || null,
    };
    if (!form.todo_el_dia) {
      insert.hora_inicio = form.hora_inicio;
      insert.hora_fin = form.hora_fin;
    }
    if (form.barbero_id !== '__sucursal__') {
      insert.barbero_id = form.barbero_id;
    }

    const { error } = await supabase.from('bloqueos_agenda').insert(insert);
    if (error) { toast.error('Error al crear bloqueo'); setSaving(false); return; }
    toast.success('Bloqueo creado');
    setShowForm(false);
    setForm({ fecha_inicio: '', fecha_fin: '', todo_el_dia: true, hora_inicio: '09:00', hora_fin: '18:00', motivo: '', barbero_id: '__sucursal__' });
    setSaving(false);
    fetchBloqueos();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('bloqueos_agenda').delete().eq('id', id);
    if (error) { toast.error('Error al eliminar'); return; }
    toast.success('Bloqueo eliminado');
    fetchBloqueos();
  };

  const getBarberName = (barberoId: string | null) => {
    if (!barberoId) return null;
    const b = barbers.find(x => x.id === barberoId);
    return b ? `${b.firstName} ${b.lastName}` : 'Barbero desconocido';
  };

  const formatDate = (d: string) => {
    try { return format(new Date(d + 'T12:00:00'), 'dd MMM yyyy', { locale: es }); }
    catch { return d; }
  };

  if (loading) return <div className="text-sm text-muted-foreground py-4">Cargando bloqueos...</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <ShieldOff className="w-4 h-4 text-destructive" />
            </div>
            <CardTitle className="text-sm">Bloqueos y excepciones</CardTitle>
          </div>
          {!showForm && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowForm(true)}>
              <Plus className="h-3 w-3 mr-1" /> Nuevo bloqueo
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form */}
        {showForm && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fecha inicio</Label>
                <Input type="date" value={form.fecha_inicio} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha fin</Label>
                <Input type="date" value={form.fecha_fin} onChange={e => setForm(p => ({ ...p, fecha_fin: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.todo_el_dia} onCheckedChange={v => setForm(p => ({ ...p, todo_el_dia: v }))} className="scale-75" />
              <Label className="text-xs">Todo el día</Label>
            </div>

            {!form.todo_el_dia && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Hora inicio</Label>
                  <Input type="time" value={form.hora_inicio} onChange={e => setForm(p => ({ ...p, hora_inicio: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hora fin</Label>
                  <Input type="time" value={form.hora_fin} onChange={e => setForm(p => ({ ...p, hora_fin: e.target.value }))} className="h-8 text-sm" />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Aplica a</Label>
              <Select value={form.barbero_id} onValueChange={v => setForm(p => ({ ...p, barbero_id: v }))}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__sucursal__">Toda la sucursal</SelectItem>
                  {barbers.filter(b => b.active).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.firstName} {b.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Motivo (opcional)</Label>
              <Textarea value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} placeholder="Ej: Feriado, vacaciones..." className="min-h-[60px] text-sm" />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleCreate} disabled={saving}>
                {saving ? 'Guardando...' : 'Crear bloqueo'}
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        {bloqueos.length === 0 && !showForm && (
          <p className="text-xs text-muted-foreground text-center py-4">No hay bloqueos configurados</p>
        )}

        {bloqueos.map(b => (
          <div key={b.id} className="flex items-start justify-between border rounded-lg p-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={b.barbero_id ? 'outline' : 'secondary'} className="text-[10px] h-5">
                  {b.barbero_id ? getBarberName(b.barbero_id) : 'Sucursal'}
                </Badge>
                <span className="text-xs font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(b.fecha_inicio)}
                  {b.fecha_fin !== b.fecha_inicio && ` – ${formatDate(b.fecha_fin)}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] h-4">
                  {b.todo_el_dia ? 'Todo el día' : `${b.hora_inicio} – ${b.hora_fin}`}
                </Badge>
                {b.motivo && <span className="text-xs text-muted-foreground">{b.motivo}</span>}
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => handleDelete(b.id)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
