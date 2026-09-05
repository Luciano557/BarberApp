import { useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useReadState, type ReadPhase } from '@/hooks/useReadState';

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
  eligio_barbero: boolean;
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

interface AgendaBundle {
  turnos: Turno[];
  bloqueos: Bloqueo[];
  servicios: Servicio[];
  horarios: Horario[];
}

const EMPTY_BUNDLE: AgendaBundle = { turnos: [], bloqueos: [], servicios: [], horarios: [] };

export function useAgendaData(
  sucursalId: string,
  organizationId: string,
  fromDate: Date,
  toDate: Date,
) {
  const fromStr = format(fromDate, 'yyyy-MM-dd');
  const toStr = format(toDate, 'yyyy-MM-dd');

  const contextKey = `${organizationId || 'none'}::${sucursalId || 'none'}::${fromStr}::${toStr}`;

  const readState = useReadState<AgendaBundle>({
    contextKey,
    errorMessage: 'No pudimos cargar la agenda.',
    staleErrorMessage: 'No pudimos actualizar la agenda.',
    surfaceId: `agenda:${sucursalId || 'none'}`,
  });

  const fetchAll = useCallback(() => {
    readState.run(async (signal) => {
      const [turnosRes, bloqueosRes, serviciosRes, horariosRes] = await Promise.all([
        supabase
          .from('turnos')
          .select('id, fecha, hora_inicio, hora_fin, cliente_nombre, cliente_telefono, cliente_email, cliente_id, barbero_id, servicio_id, estado, notas, eligio_barbero')
          .eq('sucursal_id', sucursalId)
          .gte('fecha', fromStr)
          .lte('fecha', toStr)
          .neq('estado', 'cancelado')
          .order('hora_inicio')
          .abortSignal(signal),
        supabase
          .from('bloqueos_agenda')
          .select('id, fecha_inicio, fecha_fin, todo_el_dia, hora_inicio, hora_fin, motivo, barbero_id')
          .eq('sucursal_id', sucursalId)
          .lte('fecha_inicio', toStr)
          .gte('fecha_fin', fromStr)
          .abortSignal(signal),
        supabase
          .from('servicios')
          .select('id, nombre, duracion_min, precio, linea_id, lineas(color)')
          .eq('organization_id', organizationId)
          .eq('activo', true)
          .eq('eliminado', false)
          .abortSignal(signal),
        supabase
          .from('horarios_trabajo')
          .select('id, dia_semana, hora_inicio, hora_fin, activo, barbero_id')
          .eq('sucursal_id', sucursalId)
          .eq('activo', true)
          .abortSignal(signal),
      ]);

      // Política todo-o-nada: si cualquiera de las 4 falla, se descarta el
      // conjunto entero — nunca se aplican resultados parciales (ej. turnos
      // sin horarios de atención, que se leería como "agenda cerrada").
      const failed = [turnosRes, bloqueosRes, serviciosRes, horariosRes].find(r => r.error);
      if (failed) {
        return { data: null, error: failed.error, status: (failed as { status?: number }).status };
      }

      const bundle: AgendaBundle = {
        turnos: (turnosRes.data as Turno[]) || [],
        bloqueos: (bloqueosRes.data as Bloqueo[]) || [],
        servicios: (serviciosRes.data || []).map((s: any) => ({
          id: s.id,
          nombre: s.nombre,
          duracion_min: s.duracion_min,
          precio: s.precio,
          linea_id: s.linea_id ?? null,
          linea_color: (s.lineas as { color: string | null } | null)?.color ?? null,
        })),
        horarios: (horariosRes.data as Horario[]) || [],
      };
      return { data: bundle, error: null };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalId, organizationId, fromStr, toStr, readState.run]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const bundle = readState.data ?? EMPTY_BUNDLE;
  const loading: boolean = readState.phase === 'loading';

  return {
    turnos: bundle.turnos,
    bloqueos: bundle.bloqueos,
    servicios: bundle.servicios,
    horarios: bundle.horarios,
    loading,
    phase: readState.phase as ReadPhase,
    error: readState.error,
    isStale: readState.isStale,
    refetch: fetchAll,
    retry: readState.retry,
  };
}
