import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionPinGateProvider, useRequirePinForAction } from '@/components/ActionPinGate';
import { setFinanceDemoActive } from '@/lib/financeDemoRuntime';

const mock = vi.hoisted(() => ({ active: false, rpc: vi.fn<(...args: unknown[]) => unknown>() }));
vi.mock('@/contexts/FinanceDemoContext', () => ({ useFinanceDemo: () => ({ active: mock.active }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isSucursalAccount: true, isLoading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mock.rpc } }));
let requirePin: ReturnType<typeof useRequirePinForAction>;
function Probe() { requirePin = useRequirePinForAction(); return null; }
function Surface() { return <ActionPinGateProvider><Probe /></ActionPinGateProvider>; }

describe('PIN durante la grabación', () => {
  beforeEach(() => { mock.active = false; setFinanceDemoActive(false); mock.rpc.mockReset(); });
  it('rechaza acciones protegidas sin consultar permisos operativos', async () => {
    mock.active = true; setFinanceDemoActive(true);
    render(<Surface />);
    expect(await requirePin('registrar_pago_sueldo', 'private-branch', 'private-org')).toEqual({ ok: false, cancelled: true });
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('cierra y cancela el diálogo anterior al activar datos ficticios', async () => {
    mock.rpc.mockResolvedValue({ data: true, error: null });
    const view = render(<Surface />);
    let pending: ReturnType<typeof requirePin>;
    act(() => { pending = requirePin('registrar_pago_sueldo', 'private-branch', 'private-org'); });
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    mock.active = true; setFinanceDemoActive(true); view.rerender(<Surface />);
    expect(await pending).toEqual({ ok: false, cancelled: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mock.rpc).toHaveBeenCalledOnce();
  });
});
