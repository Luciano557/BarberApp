import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  parseMesLocal,
  parseMetodosCobro,
  toNumber,
  toNumberOrNull,
  type ResumenMensual,
} from '@/components/resumenMensual/resumenHelpers';
import type { Json } from '@/integrations/supabase/types';

/**
 * Resúmenes mensuales pendientes de leer para el usuario actual.
 *
 * CANDADO DE ALCANCE: este hook solo LEE `resumenes_mensuales` (que ya pobló el
 * cron) y escribe `resumenes_mensuales_estado`. No calcula métricas ni toca la
 * generación.
 *
 * "Pendiente" = no existe fila de estado para este usuario, o existe con
 * `read_at IS NULL AND dismissed_at IS NULL` (nunca visto, o pospuesto).
 */

interface EstadoRow {
  read_at: string | null;
  postponed_at: string | null;
  dismissed_at: string | null;
}

interface EstadoPatch {
  read_at?: string | null;
  postponed_at?: string | null;
  dismissed_at?: string | null;
}

interface ResumenRow {
  id: string;
  organization_id: string;
  sucursal_id: string;
  mes: string;
  facturacion_actual: number | string;
  facturacion_mes_anterior: number | string | null;
  facturacion_hace_2_meses: number | string | null;
  servicios_actual: number | string;
  servicios_mes_anterior: number | string | null;
  servicios_hace_2_meses: number | string | null;
  rentabilidad_pct: number | string | null;
  rentabilidad_mes_anterior_pct: number | string | null;
  rentabilidad_hace_2_meses_pct: number | string | null;
  metodos_cobro: Json;
  sucursales: { nombre: string; deleted_at: string | null } | null;
  resumenes_mensuales_estado: Array<EstadoRow & { user_id: string }> | null;
}

export interface UseResumenesMensualesResult {
  /** Resúmenes sin leer ni descartar, del más viejo al más nuevo. */
  pendientes: ResumenMensual[];
  isLoading: boolean;
  /** El usuario tiene rol para ver resúmenes (owner o general_manager). */
  habilitado: boolean;
  /** "Entendido": marca este resumen como leído. */
  marcarLeido: (resumenId: string) => Promise<void>;
  /** "Ver más tarde": pospone TODOS los pendientes; vuelven a aparecer. */
  posponerTodos: () => Promise<void>;
  /** "Sí, no mostrar más": descarta TODOS los pendientes para siempre. */
  descartarTodos: () => Promise<void>;
}

export function useResumenesMensuales(): UseResumenesMensualesResult {
  const { user, isOwner, isGeneralManager } = useAuth();
  const { organization } = useOrganization();
  const [pendientes, setPendientes] = useState<ResumenMensual[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estado previo por resumen: se reenvía completo en cada upsert para que la
  // fila escrita quede totalmente determinada (y no dependa del merge parcial
  // de PostgREST). Ver `escribirEstado`.
  const estadosRef = useRef<Map<string, EstadoRow>>(new Map());

  const userId = user?.id;
  const organizationId = organization?.id;
  const habilitado = Boolean(userId && organizationId && (isOwner || isGeneralManager));

  useEffect(() => {
    if (!habilitado || !userId || !organizationId) {
      estadosRef.current = new Map();
      setPendientes([]);
      setIsLoading(false);
      return;
    }

    let cancelado = false;
    setIsLoading(true);

    (async () => {
      // El embed de estado ya viene filtrado por RLS al usuario actual; igual se
      // vuelve a filtrar por user_id acá para no depender solo de la política.
      const { data, error } = await supabase
        .from('resumenes_mensuales')
        .select(
          'id, organization_id, sucursal_id, mes, ' +
            'facturacion_actual, facturacion_mes_anterior, facturacion_hace_2_meses, ' +
            'servicios_actual, servicios_mes_anterior, servicios_hace_2_meses, ' +
            'rentabilidad_pct, rentabilidad_mes_anterior_pct, rentabilidad_hace_2_meses_pct, ' +
            'metodos_cobro, ' +
            'sucursales!inner(nombre, deleted_at), ' +
            'resumenes_mensuales_estado(user_id, read_at, postponed_at, dismissed_at)',
        )
        .eq('organization_id', organizationId)
        .order('mes', { ascending: true })
        .returns<ResumenRow[]>();

      if (cancelado) return;

      if (error) {
        console.error('[ResumenMensual] No se pudieron cargar los resúmenes:', error);
        setPendientes([]);
        setIsLoading(false);
        return;
      }

      const estados = new Map<string, EstadoRow>();
      const abiertos: ResumenMensual[] = [];

      for (const row of data ?? []) {
        // Una sucursal borrada no tiene resumen que valga la pena contar.
        if (row.sucursales?.deleted_at) continue;

        const estado = (row.resumenes_mensuales_estado ?? []).find(e => e.user_id === userId);
        if (estado) {
          estados.set(row.id, {
            read_at: estado.read_at,
            postponed_at: estado.postponed_at,
            dismissed_at: estado.dismissed_at,
          });
          if (estado.read_at !== null || estado.dismissed_at !== null) continue;
        }

        abiertos.push({
          id: row.id,
          organizationId: row.organization_id,
          sucursalId: row.sucursal_id,
          sucursalNombre: row.sucursales?.nombre ?? 'Sucursal',
          mes: parseMesLocal(row.mes),
          facturacion: {
            actual: toNumber(row.facturacion_actual),
            mesAnterior: toNumberOrNull(row.facturacion_mes_anterior),
            hace2Meses: toNumberOrNull(row.facturacion_hace_2_meses),
          },
          servicios: {
            actual: toNumber(row.servicios_actual),
            mesAnterior: toNumberOrNull(row.servicios_mes_anterior),
            hace2Meses: toNumberOrNull(row.servicios_hace_2_meses),
          },
          rentabilidad: {
            actual: toNumber(row.rentabilidad_pct),
            mesAnterior: toNumberOrNull(row.rentabilidad_mes_anterior_pct),
            hace2Meses: toNumberOrNull(row.rentabilidad_hace_2_meses_pct),
          },
          metodos: parseMetodosCobro(row.metodos_cobro),
        });
      }

      // Orden de la secuencia: mes más viejo primero y, dentro del mes, por
      // nombre de sucursal, para que la historia se lea cronológica y estable.
      abiertos.sort((a, b) => {
        const porMes = a.mes.getTime() - b.mes.getTime();
        if (porMes !== 0) return porMes;
        return a.sucursalNombre.localeCompare(b.sucursalNombre, 'es');
      });

      estadosRef.current = estados;
      setPendientes(abiertos);
      setIsLoading(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [habilitado, userId, organizationId]);

  /**
   * Upsert sobre la única `(resumen_id, user_id)`. Se manda SIEMPRE la terna
   * completa (read/postponed/dismissed) partiendo del estado previo conocido,
   * así el resultado no depende de qué columnas mergea PostgREST y el CHECK
   * `read_at IS NULL OR dismissed_at IS NULL` nunca se puede violar.
   */
  const escribirEstado = useCallback(
    async (resumenIds: string[], patch: EstadoPatch) => {
      if (!userId || !organizationId || resumenIds.length === 0) return;

      const filas = resumenIds.map(resumenId => {
        const previo = estadosRef.current.get(resumenId);
        return {
          resumen_id: resumenId,
          user_id: userId,
          organization_id: organizationId,
          read_at: previo?.read_at ?? null,
          postponed_at: previo?.postponed_at ?? null,
          dismissed_at: previo?.dismissed_at ?? null,
          ...patch,
        };
      });

      const { error } = await supabase
        .from('resumenes_mensuales_estado')
        .upsert(filas, { onConflict: 'resumen_id,user_id' });

      if (error) {
        // No se bloquea la salida del usuario por un fallo de guardado: el
        // resumen simplemente vuelve a aparecer la próxima vez.
        console.error('[ResumenMensual] No se pudo guardar el estado:', error);
        throw error;
      }

      filas.forEach(fila => {
        estadosRef.current.set(fila.resumen_id, {
          read_at: fila.read_at,
          postponed_at: fila.postponed_at,
          dismissed_at: fila.dismissed_at,
        });
      });
    },
    [userId, organizationId],
  );

  const marcarLeido = useCallback(
    async (resumenId: string) => {
      await escribirEstado([resumenId], {
        read_at: new Date().toISOString(),
        dismissed_at: null,
      });
    },
    [escribirEstado],
  );

  const posponerTodos = useCallback(async () => {
    await escribirEstado(
      pendientes.map(r => r.id),
      { postponed_at: new Date().toISOString() },
    );
  }, [escribirEstado, pendientes]);

  const descartarTodos = useCallback(async () => {
    await escribirEstado(
      pendientes.map(r => r.id),
      { dismissed_at: new Date().toISOString(), read_at: null },
    );
  }, [escribirEstado, pendientes]);

  return { pendientes, isLoading, habilitado, marcarLeido, posponerTodos, descartarTodos };
}
