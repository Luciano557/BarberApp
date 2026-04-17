import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Barber } from '@/types/barbershop';

interface HorariosTrabajoSectionProps {
  sucursalId: string;
  organizationId: string;
  barbers: Barber[];
}

interface HorarioRow {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
  barbero_id: string | null;
}

const DIAS = [
  { num: 1, label: 'Lunes' },
  { num: 2, label: 'Martes' },
  { num: 3, label: 'Miércoles' },
  { num: 4, label: 'Jueves' },
  { num: 5, label: 'Viernes' },
  { num: 6, label: 'Sábado' },
  { num: 7, label: 'Domingo' },
];

function hasOverlap(ranges: { hora_inicio: string; hora_fin: string }[]): boolean {
  const sorted = [...ranges].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].hora_inicio < sorted[i - 1].hora_fin) return true;
  }
  return false;
}

function ScheduleGrid({
  horarios,
  sucursalId,
  organizationId,
  barberoId,
  onRefresh,
}: {
  horarios: HorarioRow[];
  sucursalId: string;
  organizationId: string;
  barberoId: string | null;
  onRefresh: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const addRange = async (dia: number) => {
    const existing = horarios.filter(h => h.dia_semana === dia);
    const lastEnd = existing.length > 0
      ? existing[existing.length - 1].hora_fin
      : '09:00';
    const newStart = lastEnd;
    const newEnd = `${Math.min(23, parseInt(lastEnd.split(':')[0]) + 4).toString().padStart(2, '0')}:00`;

    const insert: any = {
      sucursal_id: sucursalId,
      organization_id: organizationId,
      dia_semana: dia,
      hora_inicio: newStart,
      hora_fin: newEnd,
      activo: true,
    };
    if (barberoId) insert.barbero_id = barberoId;

    const { error } = await supabase.from('horarios_trabajo').insert(insert);
    if (error) { toast.error('Error al agregar rango'); return; }
    onRefresh();
  };

  const updateRange = async (id: string, updates: Partial<HorarioRow>) => {
    const row = horarios.find(h => h.id === id);
    if (!row) return;
    const merged = { ...row, ...updates };

    // Validate overlap
    const sameDayRanges = horarios
      .filter(h => h.dia_semana === merged.dia_semana && h.id !== id)
      .concat([merged]);
    if (hasOverlap(sameDayRanges.map(r => ({ hora_inicio: r.hora_inicio, hora_fin: r.hora_fin })))) {
      toast.error('Los rangos horarios se superponen');
      return;
    }

    setSaving(true);
    const dbUpdates: any = {};
    if (updates.hora_inicio !== undefined) dbUpdates.hora_inicio = updates.hora_inicio;
    if (updates.hora_fin !== undefined) dbUpdates.hora_fin = updates.hora_fin;
    if (updates.activo !== undefined) dbUpdates.activo = updates.activo;

    const { error } = await supabase.from('horarios_trabajo').update(dbUpdates).eq('id', id);
    if (error) toast.error('Error al actualizar');
    else onRefresh();
    setSaving(false);
  };

  const deleteRange = async (id: string) => {
    const { error } = await supabase.from('horarios_trabajo').delete().eq('id', id);
    if (error) toast.error('Error al eliminar');
    else onRefresh();
  };

  return (
    <div className="space-y-3">
      {DIAS.map(dia => {
        const dayRanges = horarios.filter(h => h.dia_semana === dia.num);
        const anyActive = dayRanges.some(h => h.activo);
        return (
          <div key={dia.num} className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{dia.label}</span>
              <div className="flex items-center gap-2">
                {dayRanges.length === 0 && (
                  <span className="text-xs text-muted-foreground">Sin horario</span>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addRange(dia.num)}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar un rango horario
                </Button>
              </div>
            </div>
            {dayRanges.map(h => (
              <div key={h.id} className="flex items-center gap-2 mt-1.5">
                <Switch
                  checked={h.activo}
                  onCheckedChange={v => updateRange(h.id, { activo: v })}
                  className="scale-75"
                />
                <Input
                  type="time"
                  value={h.hora_inicio}
                  onChange={e => updateRange(h.id, { hora_inicio: e.target.value })}
                  className="w-28 h-7 text-xs"
                  disabled={!h.activo}
                />
                <span className="text-xs text-muted-foreground">a</span>
                <Input
                  type="time"
                  value={h.hora_fin}
                  onChange={e => updateRange(h.id, { hora_fin: e.target.value })}
                  className="w-28 h-7 text-xs"
                  disabled={!h.activo}
                />
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteRange(h.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function HorariosTrabajoSection({ sucursalId, organizationId, barbers }: HorariosTrabajoSectionProps) {
  const [allHorarios, setAllHorarios] = useState<HorarioRow[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchHorarios = useCallback(async () => {
    const { data } = await supabase
      .from('horarios_trabajo')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .order('dia_semana')
      .order('hora_inicio');
    if (data) {
      setAllHorarios(data.map(h => ({
        id: h.id,
        dia_semana: h.dia_semana,
        hora_inicio: h.hora_inicio,
        hora_fin: h.hora_fin,
        activo: h.activo,
        barbero_id: h.barbero_id,
      })));
    }
    setLoading(false);
  }, [sucursalId]);

  useEffect(() => { fetchHorarios(); }, [fetchHorarios]);

  const sucursalHorarios = allHorarios.filter(h => h.barbero_id === null);
  const selectedBarberHorarios = selectedBarberId
    ? allHorarios.filter(h => h.barbero_id === selectedBarberId)
    : [];
  const barberHasOverride = selectedBarberId
    ? allHorarios.some(h => h.barbero_id === selectedBarberId)
    : false;

  const createOverride = async () => {
    if (!selectedBarberId) return;
    // Create a copy of sucursal schedule for the barber
    const base = sucursalHorarios.filter(h => h.activo);
    if (base.length === 0) {
      // Create default Mon-Fri 9-18
      const inserts = [1, 2, 3, 4, 5].map(dia => ({
        sucursal_id: sucursalId,
        organization_id: organizationId,
        barbero_id: selectedBarberId,
        dia_semana: dia,
        hora_inicio: '09:00',
        hora_fin: '18:00',
        activo: true,
      }));
      await supabase.from('horarios_trabajo').insert(inserts);
    } else {
      const inserts = base.map(h => ({
        sucursal_id: sucursalId,
        organization_id: organizationId,
        barbero_id: selectedBarberId,
        dia_semana: h.dia_semana,
        hora_inicio: h.hora_inicio,
        hora_fin: h.hora_fin,
        activo: h.activo,
      }));
      await supabase.from('horarios_trabajo').insert(inserts);
    }
    toast.success('Horario propio creado');
    fetchHorarios();
  };

  const removeOverride = async () => {
    if (!selectedBarberId) return;
    const { error } = await supabase
      .from('horarios_trabajo')
      .delete()
      .eq('sucursal_id', sucursalId)
      .eq('barbero_id', selectedBarberId);
    if (error) { toast.error('Error al eliminar horario'); return; }
    toast.success('Barbero volvió al horario de sucursal');
    fetchHorarios();
  };

  // Compute override status for all barbers
  const barbersWithOverride = new Set(
    allHorarios.filter(h => h.barbero_id !== null).map(h => h.barbero_id!)
  );

  if (loading) return <div className="text-sm text-muted-foreground py-4">Cargando horarios...</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <CardTitle className="text-sm">Horarios de trabajo</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sucursal" className="w-full">
          <TabsList className="w-full h-9 bg-muted p-1 rounded-lg mb-4">
            <TabsTrigger value="sucursal" className="flex-1 text-xs">Horario Sucursal</TabsTrigger>
            <TabsTrigger value="barberos" className="flex-1 text-xs">Por Barbero</TabsTrigger>
          </TabsList>

          <TabsContent value="sucursal">
            <p className="text-xs text-muted-foreground mb-3">
              Horario base de la sucursal. Los barberos sin horario propio usarán este.
            </p>
            <ScheduleGrid
              horarios={sucursalHorarios}
              sucursalId={sucursalId}
              organizationId={organizationId}
              barberoId={null}
              onRefresh={fetchHorarios}
            />
          </TabsContent>

          <TabsContent value="barberos">
            <div className="space-y-4">
              <Select value={selectedBarberId} onValueChange={setSelectedBarberId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccionar barbero" />
                </SelectTrigger>
                <SelectContent>
                  {barbers.filter(b => b.active).map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      <div className="flex items-center gap-2">
                        <span>{b.firstName} {b.lastName}</span>
                        {barbersWithOverride.has(b.id) ? (
                          <Badge variant="default" className="text-[10px] h-4 px-1.5">Horario propio</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Usa sucursal</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedBarberId && !barberHasOverride && (
                <div className="text-center py-6 border rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground mb-3">
                    Este barbero usa el horario de la sucursal
                  </p>
                  <Button size="sm" variant="outline" onClick={createOverride}>
                    <Plus className="h-4 w-4 mr-1" /> Crear horario propio
                  </Button>
                </div>
              )}

              {selectedBarberId && barberHasOverride && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="default" className="text-xs">Horario personalizado</Badge>
                    <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive" onClick={removeOverride}>
                      <ArrowLeft className="h-3 w-3 mr-1" /> Volver a horario de sucursal
                    </Button>
                  </div>
                  <ScheduleGrid
                    horarios={selectedBarberHorarios}
                    sucursalId={sucursalId}
                    organizationId={organizationId}
                    barberoId={selectedBarberId}
                    onRefresh={fetchHorarios}
                  />
                </div>
              )}

              {!selectedBarberId && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Seleccioná un barbero para ver o editar su horario
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
