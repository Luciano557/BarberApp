import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { useAuth } from '@/contexts/AuthContext';
import { calcNextDate } from '@/lib/recurrence';
import { toast } from 'sonner';

export interface TareaRecurrente {
  id: string;
  organization_id: string;
  sucursal_id: string;
  titulo: string;
  descripcion: string | null;
  assignment_scope: 'individual' | 'team';
  asignado_a: string | null;
  asignado_nombre: string | null;
  hora: string | null;
  repeat_preset: string;
  repeat_frequency: string | null;
  repeat_interval: number | null;
  repeat_byweekday: number[] | null;
  fecha_inicio: string;
  proxima_fecha: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface TareaRecurrenteInsert {
  titulo: string;
  descripcion?: string | null;
  assignment_scope: 'individual' | 'team';
  asignado_a?: string | null;
  asignado_nombre?: string | null;
  hora?: string | null;
  repeat_preset: string;
  repeat_frequency?: string | null;
  repeat_interval?: number | null;
  repeat_byweekday?: number[] | null;
  fecha_inicio: string;
  sucursal_id?: string | null;
}

export interface TareaRecurrenteUpdate {
  id: string;
  titulo?: string;
  descripcion?: string | null;
  assignment_scope?: 'individual' | 'team';
  asignado_a?: string | null;
  asignado_nombre?: string | null;
  hora?: string | null;
  repeat_preset?: string;
  repeat_frequency?: string | null;
  repeat_interval?: number | null;
  repeat_byweekday?: number[] | null;
  fecha_inicio?: string;
  activo?: boolean;
}

const RECURRENCE_KEYS: Array<keyof TareaRecurrenteUpdate> = [
  'repeat_preset',
  'repeat_frequency',
  'repeat_interval',
  'repeat_byweekday',
  'fecha_inicio',
];

function computeProximaFecha(
  fechaInicio: string,
  preset: string,
  frequency: string | null | undefined,
  interval: number | null | undefined,
  byweekday: number[] | null | undefined,
): string {
  // Avanza desde fecha_inicio hasta superar (o igualar) hoy.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let cursor = new Date(fechaInicio + 'T12:00:00');
  // Guard contra loops infinitos.
  let safety = 0;
  while (cursor < today && safety < 5000) {
    cursor = calcNextDate(cursor, preset, frequency ?? null, interval ?? null, byweekday ?? null);
    safety += 1;
  }
  return format(cursor, 'yyyy-MM-dd');
}

export function useTareasRecurrentes() {
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: recetas = [], isLoading } = useQuery({
    queryKey: ['tareas_recurrentes', organization?.id, currentSucursal?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      let query = supabase
        .from('tareas_recurrentes')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (currentSucursal) {
        query = query.eq('sucursal_id', currentSucursal.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as TareaRecurrente[];
    },
    enabled: !!organization?.id,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['tareas_recurrentes'] });
    queryClient.invalidateQueries({ queryKey: ['tareas'] });
  };

  const addReceta = useMutation({
    mutationFn: async (receta: TareaRecurrenteInsert) => {
      if (!organization?.id || !user?.id) throw new Error('Falta organización o usuario');
      const sucursal_id = receta.sucursal_id ?? currentSucursal?.id ?? null;
      if (!sucursal_id) throw new Error('Seleccioná una sucursal para crear la recurrencia.');

      const payload = {
        organization_id: organization.id,
        sucursal_id,
        titulo: receta.titulo,
        descripcion: receta.descripcion ?? null,
        assignment_scope: receta.assignment_scope,
        asignado_a: receta.asignado_a ?? null,
        asignado_nombre: receta.asignado_nombre ?? null,
        hora: receta.hora ?? null,
        repeat_preset: receta.repeat_preset,
        repeat_frequency: receta.repeat_frequency ?? null,
        repeat_interval: receta.repeat_interval ?? null,
        repeat_byweekday: receta.repeat_byweekday ?? null,
        fecha_inicio: receta.fecha_inicio,
        proxima_fecha: receta.fecha_inicio,
        activo: true,
        created_by: user.id,
      };

      const { error } = await supabase.from('tareas_recurrentes').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Recurrencia creada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateReceta = useMutation({
    mutationFn: async (patch: TareaRecurrenteUpdate) => {
      const { id, ...updates } = patch;

      // Si cambió algún campo que afecta la recurrencia, recalcular proxima_fecha.
      const recurrenceChanged = RECURRENCE_KEYS.some(k => k in updates);
      let nextProxima: string | undefined;
      if (recurrenceChanged) {
        const current = recetas.find(r => r.id === id);
        if (!current) throw new Error('No se encontró la recurrencia');
        const merged = { ...current, ...updates } as TareaRecurrente;
        nextProxima = computeProximaFecha(
          merged.fecha_inicio,
          merged.repeat_preset,
          merged.repeat_frequency,
          merged.repeat_interval,
          merged.repeat_byweekday,
        );
      }

      const payload: Record<string, unknown> = { ...updates };
      if (nextProxima) payload.proxima_fecha = nextProxima;

      const { error } = await supabase
        .from('tareas_recurrentes')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Recurrencia actualizada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActivo = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase
        .from('tareas_recurrentes')
        .update({ activo })
        .eq('id', id);
      if (error) throw error;
      return activo;
    },
    onSuccess: (activo) => {
      invalidateAll();
      toast.success(activo ? 'Recurrencia activada' : 'Recurrencia pausada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteReceta = useMutation({
    mutationFn: async (id: string) => {
      // 1) Borrar tareas futuras pendientes asociadas a esta receta.
      const today = format(new Date(), 'yyyy-MM-dd');
      const { error: childrenError } = await supabase
        .from('tareas')
        .delete()
        .eq('recurrencia_id', id)
        .eq('estado', 'pendiente')
        .gte('fecha_inicio', today);
      if (childrenError) throw childrenError;

      // 2) Borrar la receta.
      const { error } = await supabase
        .from('tareas_recurrentes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Recurrencia eliminada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    recetas,
    isLoading,
    addReceta,
    updateReceta,
    toggleActivo,
    deleteReceta,
  };
}
