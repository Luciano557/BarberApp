import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { HorarioRow } from './types';

/**
 * Fuente única de horarios_trabajo por sucursal.
 *
 * Los dos puntos de montaje (horario base de la sucursal y overrides por
 * barbero) comparten esta consulta y las reglas de override — no debe haber
 * dos fetchs distintos contra la misma tabla.
 *
 * Convención de la tabla: `barbero_id === null` es el horario base de la
 * sucursal; `barbero_id` seteado es el override de ese barbero.
 */
export function useHorariosTrabajo(sucursalId: string, organizationId: string) {
  const [allHorarios, setAllHorarios] = useState<HorarioRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
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

  useEffect(() => { refetch(); }, [refetch]);

  const sucursalHorarios = useMemo(
    () => allHorarios.filter(h => h.barbero_id === null),
    [allHorarios],
  );

  const horariosDeBarbero = useCallback(
    (barberoId: string) => allHorarios.filter(h => h.barbero_id === barberoId),
    [allHorarios],
  );

  const barbersWithOverride = useMemo(
    () => new Set(allHorarios.filter(h => h.barbero_id !== null).map(h => h.barbero_id!)),
    [allHorarios],
  );

  /** Copia el horario base de la sucursal al barbero. Sin base, siembra L–V 09:00–18:00. */
  const createOverride = useCallback(async (barberoId: string) => {
    if (!barberoId) return;
    const base = allHorarios.filter(h => h.barbero_id === null && h.activo);
    if (base.length === 0) {
      const inserts = [1, 2, 3, 4, 5].map(dia => ({
        sucursal_id: sucursalId,
        organization_id: organizationId,
        barbero_id: barberoId,
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
        barbero_id: barberoId,
        dia_semana: h.dia_semana,
        hora_inicio: h.hora_inicio,
        hora_fin: h.hora_fin,
        activo: h.activo,
      }));
      await supabase.from('horarios_trabajo').insert(inserts);
    }
    toast.success('Horario propio creado');
    refetch();
  }, [allHorarios, sucursalId, organizationId, refetch]);

  /** Borra el override del barbero: vuelve a resolver contra el horario de la sucursal. */
  const removeOverride = useCallback(async (barberoId: string) => {
    if (!barberoId) return;
    const { error } = await supabase
      .from('horarios_trabajo')
      .delete()
      .eq('sucursal_id', sucursalId)
      .eq('barbero_id', barberoId);
    if (error) { toast.error('Error al eliminar horario'); return; }
    toast.success('Barbero volvió al horario de sucursal');
    refetch();
  }, [sucursalId, refetch]);

  return {
    loading,
    allHorarios,
    sucursalHorarios,
    horariosDeBarbero,
    barbersWithOverride,
    createOverride,
    removeOverride,
    refetch,
  };
}
