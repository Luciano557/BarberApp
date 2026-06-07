import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type BarberoSucursalTipo = 'principal' | 'temporal' | 'recurrente';

export interface BarberoSucursalRow {
  id: string;
  barbero_id: string;
  sucursal_id: string;
  organization_id: string;
  tipo: BarberoSucursalTipo;
  fecha_inicio: string | null; // YYYY-MM-DD
  fecha_fin: string | null;    // YYYY-MM-DD
  dias_semana: number[] | null; // ISO 1=Lun..7=Dom
  disponible: boolean;
  updated_at: string;
  created_at: string;
}

/** ISO weekday from a Date (1=Lun..7=Dom). */
export function isoDow(d: Date): number {
  const js = d.getDay(); // 0=Sun..6=Sat
  return js === 0 ? 7 : js;
}

/** YYYY-MM-DD del día local (no UTC). */
export function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Devuelve la fila vigente hoy para un barbero+sucursal según la prioridad
 * del cron: temporal vigente > recurrente activa > principal.
 */
export function pickVigenteHoy(rows: BarberoSucursalRow[]): BarberoSucursalRow | null {
  const today = todayLocalIso();
  const dow = isoDow(new Date());
  const temporal = rows.find(r =>
    r.tipo === 'temporal' &&
    (!r.fecha_inicio || r.fecha_inicio <= today) &&
    (!r.fecha_fin || r.fecha_fin >= today)
  );
  if (temporal) return temporal;
  const recurrente = rows.find(r =>
    r.tipo === 'recurrente' &&
    (!r.fecha_inicio || r.fecha_inicio <= today) &&
    (!r.fecha_fin || r.fecha_fin >= today) &&
    Array.isArray(r.dias_semana) && r.dias_semana.includes(dow)
  );
  if (recurrente) return recurrente;
  return rows.find(r => r.tipo === 'principal') ?? null;
}

/**
 * Hook tipado para `barberos_sucursales`.
 * Todas las queries incluyen `organization_id` explícito (multi-tenant strict).
 */
export function useBarberosSucursales(organizationId: string | null | undefined) {
  return useMemo(() => {
    const orgId = organizationId ?? '';

    const assertOrg = () => {
      if (!orgId) throw new Error('organization_id requerido');
    };

    const listBySucursal = async (sucursalId: string): Promise<BarberoSucursalRow[]> => {
      assertOrg();
      const { data, error } = await supabase
        .from('barberos_sucursales')
        .select('*')
        .eq('organization_id', orgId)
        .eq('sucursal_id', sucursalId);
      if (error) throw error;
      return (data ?? []) as BarberoSucursalRow[];
    };

    const listByBarbero = async (barberoId: string): Promise<BarberoSucursalRow[]> => {
      assertOrg();
      const { data, error } = await supabase
        .from('barberos_sucursales')
        .select('*')
        .eq('organization_id', orgId)
        .eq('barbero_id', barberoId);
      if (error) throw error;
      return (data ?? []) as BarberoSucursalRow[];
    };

    const setDisponible = async (id: string, disponible: boolean): Promise<void> => {
      assertOrg();
      const { error } = await supabase
        .from('barberos_sucursales')
        .update({ disponible })
        .eq('id', id)
        .eq('organization_id', orgId);
      if (error) throw error;
    };

    const deleteRow = async (id: string): Promise<void> => {
      assertOrg();
      const { error } = await supabase
        .from('barberos_sucursales')
        .delete()
        .eq('id', id)
        .eq('organization_id', orgId);
      if (error) throw error;
    };

    const insertTemporal = async (params: {
      barbero_id: string;
      sucursal_id: string;
      fecha_inicio: string;
      fecha_fin: string;
    }): Promise<BarberoSucursalRow> => {
      assertOrg();
      const { data, error } = await supabase
        .from('barberos_sucursales')
        .insert({
          organization_id: orgId,
          barbero_id: params.barbero_id,
          sucursal_id: params.sucursal_id,
          tipo: 'temporal',
          fecha_inicio: params.fecha_inicio,
          fecha_fin: params.fecha_fin,
        })
        .select('*')
        .single();
      if (error) throw error;
      const row = data as BarberoSucursalRow;
      // Activación inmediata si vigente hoy.
      const today = todayLocalIso();
      const vigenteHoy =
        (!row.fecha_inicio || row.fecha_inicio <= today) &&
        (!row.fecha_fin || row.fecha_fin >= today);
      if (vigenteHoy) {
        try { await setDisponible(row.id, true); } catch (e) { console.warn('setDisponible immediate failed', e); }
      }
      return row;
    };

    const insertRecurrente = async (params: {
      barbero_id: string;
      sucursal_id: string;
      dias_semana: number[];
      fecha_inicio?: string | null;
      fecha_fin?: string | null;
    }): Promise<BarberoSucursalRow> => {
      assertOrg();
      const { data, error } = await supabase
        .from('barberos_sucursales')
        .insert({
          organization_id: orgId,
          barbero_id: params.barbero_id,
          sucursal_id: params.sucursal_id,
          tipo: 'recurrente',
          dias_semana: params.dias_semana,
          fecha_inicio: params.fecha_inicio ?? null,
          fecha_fin: params.fecha_fin ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      const row = data as BarberoSucursalRow;
      const today = todayLocalIso();
      const dow = isoDow(new Date());
      const inRange =
        (!row.fecha_inicio || row.fecha_inicio <= today) &&
        (!row.fecha_fin || row.fecha_fin >= today);
      if (inRange && Array.isArray(row.dias_semana) && row.dias_semana.includes(dow)) {
        try { await setDisponible(row.id, true); } catch (e) { console.warn('setDisponible immediate failed', e); }
      }
      return row;
    };

    /** Upsert manual de la fila principal del barbero (1 sola por barbero). */
    const upsertPrincipal = async (barberoId: string, sucursalId: string): Promise<string> => {
      assertOrg();
      const { data: existing, error: e1 } = await supabase
        .from('barberos_sucursales')
        .select('id')
        .eq('organization_id', orgId)
        .eq('barbero_id', barberoId)
        .eq('tipo', 'principal')
        .maybeSingle();
      if (e1) throw e1;
      if (existing?.id) {
        const { error } = await supabase
          .from('barberos_sucursales')
          .update({ sucursal_id: sucursalId })
          .eq('id', existing.id)
          .eq('organization_id', orgId);
        if (error) throw error;
        return existing.id;
      }
      const { data, error } = await supabase
        .from('barberos_sucursales')
        .insert({
          organization_id: orgId,
          barbero_id: barberoId,
          sucursal_id: sucursalId,
          tipo: 'principal',
        })
        .select('id')
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    };

    /**
     * Doble escritura del principal con rollback:
     * 1) Actualiza `barberos.sucursal_id` (legacy).
     * 2) Upsert `barberos_sucursales` tipo='principal'.
     * Si (2) falla, revierte (1).
     */
    const savePrincipalDualWrite = async (barberoId: string, newSucursalId: string): Promise<void> => {
      assertOrg();
      const { data: cur, error: e0 } = await supabase
        .from('barberos')
        .select('sucursal_id, organization_id')
        .eq('id', barberoId)
        .maybeSingle();
      if (e0) throw e0;
      if (!cur) throw new Error('Barbero no encontrado');
      if (cur.organization_id !== orgId) throw new Error('organization_id no coincide');
      const oldSucursalId: string | null = (cur as any).sucursal_id ?? null;
      if (oldSucursalId === newSucursalId) {
        // Solo aseguramos la fila bs por si no existía.
        await upsertPrincipal(barberoId, newSucursalId);
        return;
      }
      const { error: eLegacy } = await supabase
        .from('barberos')
        .update({ sucursal_id: newSucursalId })
        .eq('id', barberoId)
        .eq('organization_id', orgId);
      if (eLegacy) throw eLegacy;
      try {
        await upsertPrincipal(barberoId, newSucursalId);
      } catch (bsErr) {
        // Rollback legacy.
        await supabase
          .from('barberos')
          .update({ sucursal_id: oldSucursalId })
          .eq('id', barberoId)
          .eq('organization_id', orgId);
        throw bsErr;
      }
    };

    return {
      listBySucursal,
      listByBarbero,
      setDisponible,
      deleteRow,
      insertTemporal,
      insertRecurrente,
      upsertPrincipal,
      savePrincipalDualWrite,
    };
  }, [organizationId]);
}
