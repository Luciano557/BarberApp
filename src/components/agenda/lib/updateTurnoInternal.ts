import { supabase } from '@/integrations/supabase/client';

export interface UpdateTurnoInternalPayload {
  turno_id: string;
  servicio_id?: string;
  barbero_id?: string;
  fecha?: string;
  hora_inicio?: string;
  confirm_overlap?: boolean;
  confirm_fuera_horario?: boolean;
}

export interface ConflictTurno {
  id: string;
  hora_inicio: string;
  hora_fin: string;
  cliente_nombre: string | null;
}

export type UpdateTurnoResult =
  | { ok: true; turno: any }
  | { ok: false; status: number; error: string; conflicts?: ConflictTurno[]; detalle?: any; message?: string };

export async function callUpdateTurnoInternal(
  payload: UpdateTurnoInternalPayload,
): Promise<UpdateTurnoResult> {
  const { data, error } = await supabase.functions.invoke('update-turno-internal', {
    body: payload,
  });
  if (!error) {
    return { ok: true, turno: (data as any)?.turno };
  }
  const ctx: any = (error as any).context;
  let body: any = null;
  let status = 500;
  if (ctx) {
    status = typeof ctx.status === 'number' ? ctx.status : 500;
    try {
      body = await ctx.json();
    } catch {
      try {
        const txt = await ctx.text();
        body = { error: txt || 'unknown_error' };
      } catch {
        body = { error: 'unknown_error' };
      }
    }
  } else {
    body = { error: (error as any)?.message || 'unknown_error' };
  }
  return {
    ok: false,
    status,
    error: body?.error || 'unknown_error',
    conflicts: body?.conflicts,
    detalle: body?.detalle,
    message: body?.message,
  };
}
