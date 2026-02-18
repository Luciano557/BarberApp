import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
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
  created_at: string;
  updated_at: string;
}

export interface TareaInsert {
  tipo: 'tarea' | 'peticion';
  titulo: string;
  descripcion?: string;
  asignado_a_id?: string;
  asignado_a_nombre?: string;
  creado_por_nombre?: string;
  fecha_limite?: string;
  hora?: string;
  repeat_preset?: string;
  repeat_frequency?: string;
  repeat_interval?: number;
  repeat_byweekday?: number[];
  recurrente?: boolean;
}

export function useTareas() {
  const { organization } = useOrganization();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: tareas = [], isLoading } = useQuery({
    queryKey: ['tareas', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('tareas')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Tarea[];
    },
    enabled: !!organization?.id,
  });

  const addTarea = useMutation({
    mutationFn: async (tarea: TareaInsert) => {
      if (!organization?.id || !user?.id) throw new Error('No org or user');
      const { creado_por_nombre, ...rest } = tarea;
      const { error } = await supabase.from('tareas').insert({
        organization_id: organization.id,
        creado_por_id: user.id,
        creado_por_nombre: creado_por_nombre || profile?.full_name || profile?.email || '',
        recurrente: tarea.repeat_preset && tarea.repeat_preset !== 'never' ? true : false,
        ...rest,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
      toast.success('Tarea creada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTarea = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; estado?: string; titulo?: string; descripcion?: string }) => {
      const { error } = await supabase.from('tareas').update(updates).eq('id', id);
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
