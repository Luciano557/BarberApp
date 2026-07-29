import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { canonicalizePhoneAR } from '@/lib/phone';

export interface Cliente {
  id: string;
  organization_id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  instagram: string | null;
  tiktok: string | null;
  otra_red_social: string | null;
  fecha_nacimiento: string | null;
  alergias: string | null;
  acepta_marketing: boolean;
  bloqueado: boolean;
  motivo_bloqueo: string | null;
  origen: 'manual' | 'importado' | 'reserva';
  nota_interna: string | null;
  eliminado: boolean;
  eliminado_at: string | null;
  eliminado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReservaCliente {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  barbero_id: string;
  servicio_id: string;
  sucursal_id: string;
}

export interface CreateClienteParams {
  nombre: string;
  apellido: string;
  sucursalId: string;
  telefono?: string | null;
  email?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  otra_red_social?: string | null;
  fecha_nacimiento?: string | null;
  alergias?: string | null;
  acepta_marketing?: boolean;
  posible_duplicado_de?: string | null;
}

export interface ClienteMatch {
  cliente_id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  eliminado: boolean;
  sucursales: { sucursal_id: string; nombre: string }[];
}


export type ClienteUpdate = Partial<Pick<Cliente,
  | 'nombre'
  | 'apellido'
  | 'telefono'
  | 'email'
  | 'instagram'
  | 'tiktok'
  | 'otra_red_social'
  | 'fecha_nacimiento'
  | 'alergias'
  | 'acepta_marketing'
  | 'nota_interna'
>>;

export function useClientes() {
  const { organization } = useOrganization();
  const { currentSucursal, isAllMode } = useSucursal();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClientes = useCallback(async () => {
    if (!organization?.id) {
      setClientes([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      if (currentSucursal) {
        const { data: links, error: linkErr } = await supabase
          .from('clientes_sucursales')
          .select('cliente_id')
          .eq('organization_id', organization.id)
          .eq('sucursal_id', currentSucursal.id);

        if (linkErr) throw linkErr;
        const ids = Array.from(new Set((links || []).map(l => l.cliente_id)));
        if (ids.length === 0) {
          setClientes([]);
        } else {
          const { data, error: cliErr } = await supabase
            .from('clientes')
            .select('*')
            .in('id', ids)
            .eq('eliminado', false)
            .order('apellido', { ascending: true });
          if (cliErr) throw cliErr;
          setClientes((data || []) as Cliente[]);
        }
      } else if (isAllMode) {
        const { data, error: cliErr } = await supabase
          .from('clientes')
          .select('*')
          .eq('organization_id', organization.id)
          .eq('eliminado', false)
          .order('apellido', { ascending: true });
        if (cliErr) throw cliErr;
        setClientes((data || []) as Cliente[]);
      } else {
        setClientes([]);
      }
    } catch (e: any) {
      console.error('useClientes fetch error', e);
      setError(e?.message || 'Error al cargar clientes');
    } finally {
      setIsLoading(false);
    }
  }, [organization?.id, currentSucursal?.id, isAllMode]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const createCliente = useCallback(async (params: CreateClienteParams): Promise<{ id: string | null; error: string | null }> => {
    try {
      // Canonicalizar teléfono AR antes de persistir.
      let telefonoCanon: string | null = null;
      const rawTel = (params.telefono ?? '').toString().trim();
      if (rawTel) {
        const r = canonicalizePhoneAR(rawTel);
        if (!r.ok) {
          return { id: null, error: 'Teléfono inválido. Ejemplo: 11 2516-2528.' };
        }
        telefonoCanon = r.e164;
      }

      const { data, error } = await supabase.rpc('create_cliente_with_sucursal', {
        _nombre: params.nombre,
        _apellido: params.apellido,
        _sucursal_id: params.sucursalId,
        _telefono: telefonoCanon,
        _email: params.email ?? null,
        _instagram: params.instagram ?? null,
        _tiktok: params.tiktok ?? null,
        _otra_red_social: params.otra_red_social ?? null,
        _fecha_nacimiento: params.fecha_nacimiento ?? null,
        _alergias: params.alergias ?? null,
        _acepta_marketing: params.acepta_marketing ?? true,
        _posible_duplicado_de: params.posible_duplicado_de ?? null,
      } as any);
      if (error) return { id: null, error: error.message };
      await fetchClientes();
      return { id: (data as string) ?? null, error: null };
    } catch (e: any) {
      return { id: null, error: e?.message || 'Error al crear cliente' };
    }
  }, [fetchClientes]);

  const findClienteByPhone = useCallback(async (
    telefonoE164: string
  ): Promise<{ matches: ClienteMatch[]; error: string | null }> => {
    if (!organization?.id) return { matches: [], error: null };
    const tel = (telefonoE164 || '').trim();
    if (!tel) return { matches: [], error: null };
    try {
      const { data, error } = await supabase.rpc('find_cliente_by_phone_in_org', {
        _telefono: tel,
        _organization_id: organization.id,
      } as any);
      if (error) return { matches: [], error: error.message };
      const rows = (data as any[]) || [];
      const matches: ClienteMatch[] = rows.map((r) => ({
        cliente_id: r.cliente_id,
        nombre: r.nombre,
        apellido: r.apellido,
        telefono: r.telefono,
        email: r.email,
        eliminado: !!r.eliminado,
        sucursales: Array.isArray(r.sucursales) ? r.sucursales : [],
      }));
      return { matches, error: null };
    } catch (e: any) {
      return { matches: [], error: e?.message || 'Error al buscar duplicados' };
    }
  }, [organization?.id]);

  const linkClienteToSucursal = useCallback(async (
    clienteId: string,
    sucursalId: string
  ): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.rpc('link_cliente_to_sucursal', {
        _cliente_id: clienteId,
        _sucursal_id: sucursalId,
      } as any);
      if (error) return { error: error.message };
      await fetchClientes();
      return { error: null };
    } catch (e: any) {
      return { error: e?.message || 'Error al vincular cliente' };
    }
  }, [fetchClientes]);


  const updateCliente = useCallback(async (
    id: string,
    patch: ClienteUpdate
  ): Promise<{ error: string | null }> => {
    try {
      const finalPatch: any = { ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'telefono')) {
        const rawTel = (patch.telefono ?? '') as string | null;
        if (rawTel && rawTel.toString().trim()) {
          const r = canonicalizePhoneAR(rawTel);
          if (!r.ok) {
            return { error: 'Teléfono inválido. Ejemplo: 11 2516-2528.' };
          }
          finalPatch.telefono = r.e164;
        } else {
          finalPatch.telefono = null;
        }
      }
      const { error } = await supabase
        .from('clientes')
        .update(finalPatch)
        .eq('id', id);
      if (error) return { error: error.message };
      await fetchClientes();
      return { error: null };
    } catch (e: any) {
      return { error: e?.message || 'Error al actualizar cliente' };
    }
  }, [fetchClientes]);

  const blockCliente = useCallback(async (id: string, motivo: string): Promise<{ error: string | null }> => {
    const m = motivo.trim();
    if (!m) return { error: 'El motivo es obligatorio' };
    try {
      const { error } = await supabase
        .from('clientes')
        .update({ bloqueado: true, motivo_bloqueo: m } as any)
        .eq('id', id);
      if (error) return { error: error.message };
      await fetchClientes();
      return { error: null };
    } catch (e: any) {
      return { error: e?.message || 'Error al bloquear cliente' };
    }
  }, [fetchClientes]);

  const unblockCliente = useCallback(async (id: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase
        .from('clientes')
        .update({ bloqueado: false, motivo_bloqueo: null } as any)
        .eq('id', id);
      if (error) return { error: error.message };
      await fetchClientes();
      return { error: null };
    } catch (e: any) {
      return { error: e?.message || 'Error al desbloquear cliente' };
    }
  }, [fetchClientes]);

  const deleteCliente = useCallback(async (id: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.rpc('soft_delete_cliente', { _cliente_id: id } as any);
      if (error) return { error: error.message };
      await fetchClientes();
      return { error: null };
    } catch (e: any) {
      return { error: e?.message || 'Error al eliminar cliente' };
    }
  }, [fetchClientes]);

  const getClienteById = useCallback(async (id: string): Promise<Cliente | null> => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      console.error(error);
      return null;
    }
    return data as Cliente;
  }, []);

  const getSucursalesByCliente = useCallback(async (clienteId: string): Promise<Array<{ sucursal_id: string; nombre: string }>> => {
    const { data: links } = await supabase
      .from('clientes_sucursales')
      .select('sucursal_id')
      .eq('cliente_id', clienteId);
    const ids = (links || []).map(l => l.sucursal_id);
    if (ids.length === 0) return [];
    const { data: sucs } = await supabase
      .from('sucursales')
      .select('id, nombre')
      .in('id', ids)
      .is('deleted_at', null);
    return (sucs || []).map(s => ({ sucursal_id: s.id, nombre: s.nombre }));
  }, []);

  const getReservasByCliente = useCallback(async (clienteId: string): Promise<ReservaCliente[]> => {
    const { data, error } = await supabase
      .from('turnos')
      .select('id, fecha, hora_inicio, hora_fin, estado, barbero_id, servicio_id, sucursal_id')
      .eq('cliente_id', clienteId)
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false });
    if (error) {
      console.error(error);
      return [];
    }
    return (data || []) as ReservaCliente[];
  }, []);

  return {
    clientes,
    isLoading,
    error,
    refresh: fetchClientes,
    createCliente,
    findClienteByPhone,
    linkClienteToSucursal,
    updateCliente,
    blockCliente,
    unblockCliente,
    deleteCliente,
    getClienteById,
    getSucursalesByCliente,
    getReservasByCliente,
  };
}
