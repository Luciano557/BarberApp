import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ invoke: vi.fn(), signOut: vi.fn() }));
vi.mock('@/integrations/supabase/adminClient', () => ({ adminSupabase: { functions: { invoke: mock.invoke }, auth: { signOut: mock.signOut } } }));
import { getPlatformAdminCommercialStatus, usePlatformAdminCommercialMutation } from './usePlatformAdmin';

describe('commercial frontend transport', () => {
  beforeEach(() => { mock.invoke.mockReset(); mock.signOut.mockReset(); });
  it('never caches the confirmation password and sends one stable request ID', async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => usePlatformAdminCommercialMutation(), { wrapper });
    mock.invoke.mockResolvedValue({ data: { organizationId: 'org', requestId: 'key', action: 'update_details', replayed: false }, error: null });
    await act(async () => result.current.apply({ action: 'update_details', organizationId: 'org', expectedOrganizationUpdatedAt: null, expectedSubscriptionUpdatedAt: null, changes: { name: 'Fixture', phone: null, address: null, contactEmail: null }, reason: 'Commercial fixture update', password: 'synthetic-test-only' }, 'key'));
    expect(mock.invoke).toHaveBeenCalledTimes(1);
    expect(mock.invoke.mock.calls[0][1].headers).toEqual({ 'x-request-id': 'key' });
    expect(JSON.stringify(client.getMutationCache().getAll().map(item => item.state))).not.toContain('synthetic-test-only');
    client.clear();
  });
  it('a wrong confirmation password does not sign out the administrative session', async () => {
    mock.invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ code: 'REAUTHENTICATION_FAILED', error: 'Identity confirmation failed' }), { status: 403 }) } });
    await expect(getPlatformAdminCommercialStatus('org', 'key')).rejects.toMatchObject({ status: 403, code: 'REAUTHENTICATION_FAILED' });
    expect(mock.signOut).not.toHaveBeenCalled();
  });
  it('a real authorization denial signs out only the dedicated client', async () => {
    mock.invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ code: 'FORBIDDEN' }), { status: 403 }) } });
    await expect(getPlatformAdminCommercialStatus('org', 'key')).rejects.toMatchObject({ status: 403 });
    expect(mock.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
