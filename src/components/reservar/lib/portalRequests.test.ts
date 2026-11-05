import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mutatePortalFunction, readPortalFunction } from './portalRequests';
import { ReadFailure } from '@/lib/readRetry';

const state = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/integrations/supabase/client', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  return { supabase: createClient('https://example.test', 'test-public-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (...args) => state.fetch(...args) } }) };
});
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
beforeEach(() => state.fetch.mockReset());
afterEach(() => vi.useRealTimers());

describe('contrato real del SDK Supabase con transporte simulado', () => {
  it('reintenta una lectura 503 y mantiene el scope en ambos requests', async () => {
    vi.useFakeTimers();
    state.fetch.mockResolvedValueOnce(response({ error: 'Internal error' }, 503)).mockResolvedValueOnce(response({ slots: [] }));
    const promise = readPortalFunction('get-availability', { organization_id: 'org-a', sucursal_id: 'branch-a', servicio_id: 'service-a', fecha: '2026-11-05' }, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toEqual({ slots: [] });
    expect(state.fetch).toHaveBeenCalledTimes(2);
    for (const [, options] of state.fetch.mock.calls) expect(JSON.parse(options.body)).toMatchObject({ organization_id: 'org-a', sucursal_id: 'branch-a' });
  });

  it('un 403 falla de inmediato y no se convierte en una lectura vacía', async () => {
    state.fetch.mockResolvedValue(response({ error: 'Not authorized' }, 403));
    await expect(readPortalFunction('get-my-turnos-by-phone', { organization_id: 'org-a', telefono: 'test-phone' }, new AbortController().signal)).rejects.toMatchObject({ classification: 'permanent' });
    expect(state.fetch).toHaveBeenCalledTimes(1);
  });

  it('rechaza un payload incompleto en lugar de mostrar ausencia de horarios', async () => {
    state.fetch.mockResolvedValue(response({}));
    await expect(readPortalFunction('get-availability', {}, new AbortController().signal)).rejects.toBeInstanceOf(ReadFailure);
    expect(state.fetch).toHaveBeenCalledTimes(1);
  });

  it('recupera el código de un FunctionsHttpError y nunca reintenta una escritura', async () => {
    state.fetch.mockResolvedValue(response({ error: 'slot_taken' }, 409));
    await expect(mutatePortalFunction('validate-turno', { organization_id: 'org-a', sucursal_id: 'branch-a' })).rejects.toMatchObject({ code: 'slot_taken', status: 409 });
    expect(state.fetch).toHaveBeenCalledTimes(1);
    state.fetch.mockResolvedValue(response({ error: 'Internal error' }, 503));
    await expect(mutatePortalFunction('cancel-turno', { turno_id: 'turno-a', telefono: 'test-phone' })).rejects.toMatchObject({ status: 503 });
    expect(state.fetch).toHaveBeenCalledTimes(2);
  });
});
