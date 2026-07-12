import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ClienteLite {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  inSucursal?: boolean;
}

export function clienteFullName(c: { nombre: string; apellido: string | null }) {
  return `${c.nombre}${c.apellido ? ' ' + c.apellido : ''}`.trim();
}

interface UseClienteSearchOptions {
  organizationId: string;
  sucursalId: string;
  /** Solo busca mientras el picker está activo (diálogo abierto / sección en edición). */
  enabled: boolean;
}

/** Búsqueda de cliente con debounce + token anti-race, compartida entre NewAppointmentDialog y AppointmentDetailDialog. */
export function useClienteSearch({ organizationId, sucursalId, enabled }: UseClienteSearchOptions) {
  const [selectedCliente, setSelectedCliente] = useState<ClienteLite | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClienteLite[]>([]);
  const [searching, setSearching] = useState(false);
  const tokenRef = useRef(0);

  useEffect(() => {
    if (!enabled || !searchOpen) return;
    const q = query.trim();
    const myToken = ++tokenRef.current;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        let req = supabase
          .from('clientes')
          .select('id, nombre, apellido, telefono, email')
          .eq('organization_id', organizationId)
          .eq('eliminado', false)
          .order('apellido', { ascending: true })
          .limit(20);
        if (q.length > 0) {
          const safe = q.replace(/[%,]/g, ' ');
          req = req.or(`nombre.ilike.%${safe}%,apellido.ilike.%${safe}%,telefono.ilike.%${safe}%,email.ilike.%${safe}%`);
        }
        const [{ data: cliData }, { data: linkData }] = await Promise.all([
          req,
          supabase
            .from('clientes_sucursales')
            .select('cliente_id')
            .eq('organization_id', organizationId)
            .eq('sucursal_id', sucursalId),
        ]);
        if (myToken !== tokenRef.current) return;
        const localIds = new Set((linkData || []).map((l) => l.cliente_id));
        const list: ClienteLite[] = (cliData || []).map((c) => ({ ...c, inSucursal: localIds.has(c.id) }));
        list.sort((a, b) => Number(b.inSucursal) - Number(a.inSucursal));
        setResults(list);
      } catch {
        if (myToken === tokenRef.current) setResults([]);
      } finally {
        if (myToken === tokenRef.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [enabled, query, searchOpen, organizationId, sucursalId]);

  const ensureRelacion = useCallback(async (clienteId: string) => {
    const { data: existing, error: selErr } = await supabase
      .from('clientes_sucursales')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('cliente_id', clienteId)
      .eq('sucursal_id', sucursalId)
      .maybeSingle();
    if (selErr) throw selErr;
    if (existing) return;
    const { error: insErr } = await supabase.from('clientes_sucursales').insert({
      organization_id: organizationId,
      cliente_id: clienteId,
      sucursal_id: sucursalId,
      origen_relacion: 'manual',
    } as any);
    if (insErr) throw insErr;
  }, [organizationId, sucursalId]);

  const reset = useCallback(() => {
    setSelectedCliente(null);
    setSearchOpen(false);
    setQuery('');
    setResults([]);
    setSearching(false);
  }, []);

  return {
    selectedCliente,
    setSelectedCliente,
    searchOpen,
    setSearchOpen,
    query,
    setQuery,
    results,
    searching,
    ensureRelacion,
    reset,
  };
}
