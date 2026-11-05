import { useCallback, useEffect, useRef, useState } from 'react';
import { feedback } from '@/lib/feedback';
import { ReadCancelledError } from '@/lib/readRetry';
import { readPortalFunction } from '../lib/portalRequests';

interface Snapshot<T> { key: string; data: T | null; pending: boolean; error: unknown }

/** Caché solo en memoria del componente. La clave incluye organización, sucursal y teléfono cuando corresponden. */
export function usePortalRead<T>(name: string, body: Record<string, unknown>, message: string, enabled = true) {
  const bodyKey = JSON.stringify(body);
  const key = `${name}:${bodyKey}`;
  const [version, setVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({ key: '', data: null, pending: true, error: null });
  const cache = useRef<{ key: string; data: T } | null>(null);
  const refetch = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const previous = cache.current?.key === key ? cache.current.data : null;
    const toastId = `portal-read:${name}`;
    setSnapshot({ key, data: previous, pending: true, error: null });
    void readPortalFunction<T>(name, JSON.parse(bodyKey), controller.signal).then(data => {
      if (controller.signal.aborted) return;
      cache.current = { key, data };
      setSnapshot({ key, data, pending: false, error: null });
      feedback.dismiss(toastId);
    }).catch(error => {
      if (controller.signal.aborted || error instanceof ReadCancelledError) return;
      setSnapshot({ key, data: previous, pending: false, error });
      if (previous !== null) feedback.error(message, { retry: { id: toastId, onRetry: refetch } });
    });
    return () => { controller.abort(); feedback.dismiss(toastId); };
  }, [name, bodyKey, key, message, enabled, version, refetch]);

  const current = snapshot.key === key && enabled;
  return {
    data: current ? snapshot.data : null,
    error: current ? snapshot.error : null,
    loading: enabled && (!current || (snapshot.pending && snapshot.data === null)),
    refreshing: current && snapshot.pending && snapshot.data !== null,
    refetch,
  };
}
