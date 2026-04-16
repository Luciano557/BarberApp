import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CalendarIcon, Clock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSucursal } from '@/contexts/SucursalContext';
import { useOrganization } from '@/contexts/OrganizationContext';

interface Turno {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  cliente_nombre: string | null;
  barbero_id: string;
  estado: string;
  servicio_id: string;
}

interface BarberoMap {
  [id: string]: string;
}

interface ServicioMap {
  [id: string]: string;
}

const estadoBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  pendiente: { label: 'Pendiente', variant: 'outline' },
  confirmado: { label: 'Confirmado', variant: 'default' },
  completado: { label: 'Completado', variant: 'secondary' },
};

export function DailyTurnosViewer() {
  const { currentSucursal } = useSucursal();
  const { organization } = useOrganization();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [barberos, setBarberos] = useState<BarberoMap>({});
  const [servicios, setServicios] = useState<ServicioMap>({});
  const [loading, setLoading] = useState(true);

  const dateStr = useMemo(() => format(currentDate, 'yyyy-MM-dd'), [currentDate]);
  const isToday = isSameDay(currentDate, new Date());

  const fetchTurnos = useCallback(async () => {
    if (!currentSucursal) return;
    setLoading(true);
    const { data } = await supabase
      .from('turnos')
      .select('id, fecha, hora_inicio, hora_fin, cliente_nombre, barbero_id, estado, servicio_id')
      .eq('sucursal_id', currentSucursal.id)
      .eq('fecha', dateStr)
      .neq('estado', 'cancelado')
      .order('hora_inicio');
    if (data) setTurnos(data);
    setLoading(false);
  }, [currentSucursal, dateStr]);

  const fetchBarberos = useCallback(async () => {
    if (!organization) return;
    const { data } = await supabase
      .from('barberos')
      .select('id, nombre, apellido')
      .eq('organization_id', organization.id);
    if (data) {
      const map: BarberoMap = {};
      data.forEach(b => { map[b.id] = `${b.nombre} ${b.apellido}`; });
      setBarberos(map);
    }
  }, [organization]);

  const fetchServicios = useCallback(async () => {
    if (!organization) return;
    const { data } = await supabase
      .from('servicios')
      .select('id, nombre')
      .eq('organization_id', organization.id);
    if (data) {
      const map: ServicioMap = {};
      data.forEach(s => { map[s.id] = s.nombre; });
      setServicios(map);
    }
  }, [organization]);

  useEffect(() => { fetchBarberos(); fetchServicios(); }, [fetchBarberos, fetchServicios]);
  useEffect(() => { fetchTurnos(); }, [fetchTurnos]);

  if (!currentSucursal) return null;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Header with navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentDate(prev => addDays(prev, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium capitalize">
              {format(currentDate, "EEEE dd 'de' MMMM", { locale: es })}
            </span>
            {isToday && <Badge variant="default" className="text-[10px] h-4 px-1.5">Hoy</Badge>}
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentDate(prev => addDays(prev, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Turnos list */}
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-4">Cargando turnos...</p>
        ) : turnos.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Sin turnos para este día</p>
        ) : (
          <div className="space-y-1.5">
            {turnos.map(turno => {
              const badge = estadoBadge[turno.estado] || { label: turno.estado, variant: 'outline' as const };
              return (
                <div key={turno.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/50 flex-wrap">
                  <span className="flex items-center gap-1 font-mono text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {turno.hora_inicio.slice(0, 5)} - {turno.hora_fin.slice(0, 5)}
                  </span>
                  <span className="text-foreground font-medium">{turno.cliente_nombre || 'Sin nombre'}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{servicios[turno.servicio_id] || 'Servicio'}</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <User className="h-3 w-3" />
                    {barberos[turno.barbero_id] || 'Barbero'}
                  </span>
                  <Badge variant={badge.variant} className="text-[10px] h-4 px-1.5 ml-auto">
                    {badge.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
