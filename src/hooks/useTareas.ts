import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Tarea {
  id: string;
  organization_id: string;
  tipo: 'tarea' | 'peticion';
  titulo: string;
  descripcion: string | null;
  estado: string;
  asignado_a_id: string | null;
  asignado_a_nombre: string | null;
  creado_por_id: string;
  creado_por_nombre: string | null;
  assignment_scope: 'individual' | 'team';
  sucursal_id: string | null;
  recurrente: boolean;
  frecuencia_dias: number | null;
  recurrencia_tipo: string | null;
  recurrencia_dia_semana: number | null;
  recurrencia_semana_del_mes: number | null;
  dias_para_limite: number | null;
  proxima_fecha: string | null;
  fecha_limite: string | null;
  hora: string | null;
  repeat_preset: string | null;
  repeat_frequency: string | null;
  repeat_interval: number | null;
  repeat_byweekday: number[] | null;
  vencimiento_dias: number | null;
  completada_por_id: string | null;
  completada_por_nombre: string | null;
  completada_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TareaInsert {
  tipo: 'tarea' | 'peticion';
  titulo: string;
  descripcion?: string;
  asignado_a_id?: string | null;
  asignado_a_nombre?: string;
  assignment_scope?: 'individual' | 'team';
  sucursal_id?: string | null;
  creado_por_nombre?: string;
  fecha_limite?: string;
  hora?: string;
  repeat_preset?: string;
  repeat_frequency?: string;
  repeat_interval?: number;
  repeat_byweekday?: number[];
  recurrente?: boolean;
  vencimiento_dias?: number;
}

export function useTareas() {
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: tareas = [], isLoading } = useQuery({
    queryKey: ['tareas', organization?.id, currentSucursal?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      let query = supabase
        .from('tareas')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (currentSucursal) {
        query = query.eq('sucursal_id', currentSucursal.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Tarea[];
    },
    enabled: !!organization?.id,
  });

  const addTarea = useMutation({
    mutationFn: async (tarea: TareaInsert) => {
      if (!organization?.id || !user?.id) throw new Error('No org or user');
      const { creado_por_nombre, ...rest } = tarea;
      // Resolver scope para tareas internas
      let assignment_scope: 'individual' | 'team' = rest.assignment_scope ?? 'individual';
      let asignado_a_id = rest.asignado_a_id ?? null;
      let asignado_a_nombre = rest.asignado_a_nombre;
      let sucursal_id = rest.sucursal_id ?? currentSucursal?.id ?? null;

      if (tarea.tipo === 'tarea') {
        if (!asignado_a_id) {
          assignment_scope = 'team';
          asignado_a_nombre = 'Todo el equipo';
          asignado_a_id = null;
          sucursal_id = currentSucursal?.id ?? sucursal_id;
        } else {
          assignment_scope = 'individual';
        }
      }

      const { error } = await supabase.from('tareas').insert({
        ...rest,
        organization_id: organization.id,
        sucursal_id,
        asignado_a_id,
        asignado_a_nombre,
        assignment_scope,
        creado_por_id: user.id,
        creado_por_nombre: creado_por_nombre || profile?.full_name || profile?.email || '',
        recurrente: tarea.repeat_preset && tarea.repeat_preset !== 'never' ? true : false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
      toast.success('Tarea creada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type TareaUpdate = {
    id: string;
    estado?: string;
    titulo?: string;
    descripcion?: string | null;
    asignado_a_id?: string | null;
    asignado_a_nombre?: string | null;
    assignment_scope?: 'individual' | 'team';
    fecha_limite?: string | null;
    hora?: string | null;
    repeat_preset?: string | null;
    repeat_frequency?: string | null;
    repeat_interval?: number | null;
    repeat_byweekday?: number[] | null;
    recurrente?: boolean;
  };

  const updateTarea = useMutation({
    mutationFn: async ({ id, ...updates }: TareaUpdate) => {
      const payload: Record<string, unknown> = { ...updates };
      if (updates.estado === 'completada') {
        payload.completada_at = new Date().toISOString();
        payload.completada_por_id = user?.id ?? null;
        payload.completada_por_nombre = profile?.full_name || profile?.email || null;
      }
      const { error } = await supabase.from('tareas').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
      toast.success('Tarea actualizada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTarea = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tareas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
      toast.success('Tarea eliminada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { tareas, isLoading, addTarea, updateTarea, deleteTarea };
}
