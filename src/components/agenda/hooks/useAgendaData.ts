import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface Turno {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  cliente_email: string | null;
  cliente_id: string | null;
  barbero_id: string;
  servicio_id: string;
  estado: string;
  notas: string | null;
}

export interface Bloqueo {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  todo_el_dia: boolean;
  hora_inicio: string | null;
  hora_fin: string | null;
  motivo: string | null;
  barbero_id: string | null;
}

export interface Servicio {
  id: string;
  nombre: string;
  duracion_min: number;
  precio: number;
  linea_id: string | null;
  linea_color: string | null;
}

export interface Horario {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
  barbero_id: string | null;
}

export function useAgendaData(
  sucursalId: string,
  organizationId: string,
  fromDate: Date,
  toDate: Date,
) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);

  const fromStr = format(fromDate, 'yyyy-MM-dd');
  const toStr = format(toDate, 'yyyy-MM-dd');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [turnosRes, bloqueosRes, serviciosRes, horariosRes] = await Promise.all([
      supabase
        .from('turnos')
        .select('id, fecha, hora_inicio, hora_fin, cliente_nombre, cliente_telefono, cliente_email, cliente_id, barbero_id, servicio_id, estado, notas')
        .eq('sucursal_id', sucursalId)
        .gte('fecha', fromStr)
        .lte('fecha', toStr)
        .neq('estado', 'cancelado')
        .order('hora_inicio'),
      supabase
        .from('bloqueos_agenda')
        .select('id, fecha_inicio, fecha_fin, todo_el_dia, hora_inicio, hora_fin, motivo, barbero_id')
        .eq('sucursal_id', sucursalId)
        .lte('fecha_inicio', toStr)
        .gte('fecha_fin', fromStr),
      supabase
        .from('servicios')
        .select('id, nombre, duracion_min, precio, linea_id, lineas(color)')
        .eq('organization_id', organizationId)
        .eq('activo', true)
        .eq('eliminado', false),
      supabase
        .from('horarios_trabajo')
        .select('id, dia_semana, hora_inicio, hora_fin, activo, barbero_id')
        .eq('sucursal_id', sucursalId)
        .eq('activo', true),
    ]);
    setTurnos(turnosRes.data || []);
    setBloqueos(bloqueosRes.data || []);
    setServicios(
      (serviciosRes.data || []).map((s: any) => ({
        id: s.id,
        nombre: s.nombre,
        duracion_min: s.duracion_min,
        precio: s.precio,
        linea_id: s.linea_id ?? null,
        linea_color: (s.lineas as { color: string | null } | null)?.color ?? null,
      })),
    );
    setHorarios(horariosRes.data || []);
    setLoading(false);
  }, [sucursalId, organizationId, fromStr, toStr]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { turnos, bloqueos, servicios, horarios, loading, refetch: fetchAll };
}
