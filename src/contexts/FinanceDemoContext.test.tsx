import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FINANCE_DEMO_STORAGE_KEY, FinanceDemoProvider, useFinanceDemo } from './FinanceDemoContext';
import { runFinanceWrite, setFinanceDemoActive } from '@/lib/financeDemoRuntime';
import { useEstadisticasData } from '@/components/estadisticas/useEstadisticasData';
import { useEquipoData } from '@/components/estadisticas/useEquipoData';
import { useOcupacionResumen } from '@/components/estadisticas/useOcupacionResumen';
import { usePagoMetodoData } from '@/components/estadisticas/usePagoMetodoData';
import { useServiciosClientesData } from '@/components/estadisticas/useServiciosClientesData';
import { useDeudaPendienteData } from '@/components/estadisticas/useDeudaPendienteData';
import { useSueldosData } from '@/hooks/useSueldosData';
import { useGastos } from '@/hooks/useGastos';
import { useGastosRecurrentes } from '@/hooks/useGastosRecurrentes';
import { useInversiones } from '@/hooks/useInversiones';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useTransactions } from '@/hooks/useTransactions';
import { useCobrarBarbers } from '@/hooks/useCobrarBarbers';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useDeudas } from '@/hooks/useDeudas';

const mock = vi.hoisted(() => ({
  auth: { user: { id: 'user-real' }, isOwner: true, isGeneralManager: false, roles: ['owner'], hasNoAccess: false, isLoading: false },
  branch: { id: 'branch-real', nombre: 'Sucursal privada' },
  org: { organization: { id: 'organization-real' }, isLoading: false },
  from: vi.fn<(...args: unknown[]) => unknown>(),
  channel: vi.fn(() => { throw new Error('Unexpected realtime subscription'); }),
  rpc: vi.fn(() => { throw new Error('Unexpected operational RPC'); }),
}));
vi.mock('./AuthContext', () => ({ useAuth: () => mock.auth }));
vi.mock('./OrganizationContext', () => ({ useOrganization: () => mock.org }));
vi.mock('./SucursalContext', () => ({ useSucursal: () => ({ currentSucursal: mock.branch }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mock.from, rpc: mock.rpc, channel: mock.channel } }));
let demo: ReturnType<typeof useFinanceDemo>;
function Probe() { demo = useFinanceDemo(); return <span data-testid="mode">{demo.active ? 'ficticio' : 'real'}</span>; }
function FinanceHooks() {
  const context = useFinanceDemo();
  useSupabaseData(); useTransactions(); useCobrarBarbers(); useOnboardingState();
  const stats = useEstadisticasData('organization-real', null, '6');
  useEquipoData('organization-real', null, '6'); useOcupacionResumen('organization-real', null, '6');
  usePagoMetodoData('organization-real', null); useServiciosClientesData('organization-real', null, '6');
  useDeudaPendienteData('organization-real', null); useSueldosData(context.data.barbers);
  const expenses = useGastos(); const recurring = useGastosRecurrentes();
  const investments = useInversiones(); const debts = useDeudas();
  return <button onClick={async () => {
    await expenses.addGasto({ categoria: 'Prueba', monto: 1, descripcion: '', fecha: new Date(), tipoCosto: 'fijo' });
    await recurring.syncGastosRecurrentes(); await investments.deleteInversion('demo-investment');
    await debts.registrarPago(context.data.deudas[0], 1, '2026-10-01');
  }}>{stats.monthlyData.length} meses</button>;
}
function InvestmentsProbe() {
  const investments = useInversiones();
  return <span data-testid="investments">{investments.inversiones.map(row => row.nombre).join(', ')}</span>;
}
function StartupProbe() { useOnboardingState(); return <Probe />; }
function saveMode() { sessionStorage.setItem(FINANCE_DEMO_STORAGE_KEY, JSON.stringify({ identity: 'user-real:organization-real', branch: null, referenceDate: '2026-10-20T12:00:00' })); }
describe('modo ficticio de Finanzas', () => {
  beforeEach(() => { sessionStorage.clear(); setFinanceDemoActive(false); mock.auth.isLoading = false; mock.org.isLoading = false; mock.auth.user = { id: 'user-real' }; mock.org.organization = { id: 'organization-real' }; mock.from.mockReset().mockImplementation(() => { throw new Error('Unexpected operational read'); }); });
  it('restaura el modo antes de consultar y bloquea lecturas, pagos y sincronizaciones', async () => {
    saveMode(); render(<FinanceDemoProvider><Probe /><FinanceHooks /></FinanceDemoProvider>);
    expect(screen.getByTestId('mode')).toHaveTextContent('ficticio');
    await act(async () => screen.getByText('6 meses').click());
    expect(mock.from).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled(); expect(mock.channel).not.toHaveBeenCalled();
  });
  it('pausa el onboarding mientras se verifica la identidad guardada', () => {
    saveMode(); mock.auth.isLoading = true; mock.org.isLoading = true;
    const view = render(<FinanceDemoProvider><StartupProbe /></FinanceDemoProvider>);
    expect(mock.from).not.toHaveBeenCalled();
    mock.auth.isLoading = false; mock.org.isLoading = false;
    view.rerender(<FinanceDemoProvider><StartupProbe /></FinanceDemoProvider>);
    expect(demo.active).toBe(true); expect(mock.from).not.toHaveBeenCalled();
  });
  it('conserva el modo al cancelar y ejecuta la salida solo después de confirmar', () => {
    render(<FinanceDemoProvider><Probe /></FinanceDemoProvider>);
    act(() => { demo.activate(); });
    const navigate = vi.fn();
    act(() => demo.requestExit(navigate)); expect(navigate).not.toHaveBeenCalled();
    act(() => demo.cancelExit()); expect(demo.active).toBe(true);
    act(() => demo.requestExit(navigate)); act(() => demo.confirmExit());
    expect(navigate).toHaveBeenCalledOnce(); expect(demo.active).toBe(false);
    expect(sessionStorage.getItem(FINANCE_DEMO_STORAGE_KEY)).toBeNull();
  });
  it.each(['usuario', 'organización', 'cierre de sesión'])('borra el modo por cambio de %s', async change => {
    saveMode(); const view = render(<FinanceDemoProvider><Probe /></FinanceDemoProvider>);
    if (change === 'usuario') mock.auth.user = { id: 'other-user' };
    if (change === 'organización') mock.org.organization = { id: 'other-org' };
    if (change === 'cierre de sesión') mock.auth.user = null;
    view.rerender(<FinanceDemoProvider><Probe /></FinanceDemoProvider>);
    await waitFor(() => expect(demo.active).toBe(false));
    expect(sessionStorage.getItem(FINANCE_DEMO_STORAGE_KEY)).toBeNull();
  });
  it('no activa si el navegador rechaza la persistencia', () => {
    render(<FinanceDemoProvider><Probe /></FinanceDemoProvider>);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked storage'); });
    act(() => { expect(demo.activate()).toBe(false); });
    expect(demo.active).toBe(false);
  });
  it('aborta la lectura anterior, descarta su respuesta tardía y vuelve a leer al salir', async () => {
    let resolveLate: (value: { data: { id: string; nombre: string }[]; error: null }) => void;
    const pending = new Promise<{ data: { id: string; nombre: string }[]; error: null }>(resolve => { resolveLate = resolve; });
    const signals: AbortSignal[] = [];
    const query = { select: () => query, eq: () => query, order: () => query,
      abortSignal: vi.fn((signal: AbortSignal) => { signals.push(signal); return pending; }) };
    mock.from.mockReturnValue(query);
    render(<FinanceDemoProvider><Probe /><InvestmentsProbe /></FinanceDemoProvider>);
    expect(mock.from).toHaveBeenCalledOnce();
    act(() => { demo.activate(); });
    expect(signals[0].aborted).toBe(true);
    await act(async () => { resolveLate({ data: [{ id: 'late-real', nombre: 'Respuesta privada tardía' }], error: null }); });
    expect(screen.getByTestId('investments')).not.toHaveTextContent('Respuesta privada tardía');
    expect(screen.getByTestId('investments')).toHaveTextContent('Sillones de trabajo');
    query.abortSignal.mockImplementation(() => Promise.resolve({ data: [{ id: 'real-new', nombre: 'Inversión real nueva' }], error: null }));
    act(() => demo.requestExit()); act(() => demo.confirmExit());
    await waitFor(() => expect(screen.getByTestId('investments')).toHaveTextContent('Inversión real nueva'));
    expect(screen.getByTestId('investments')).not.toHaveTextContent('Respuesta privada tardía');
    expect(mock.from).toHaveBeenCalledTimes(2);
  });
  it('impide activar mientras se termina una escritura real', async () => {
    render(<FinanceDemoProvider><Probe /></FinanceDemoProvider>);
    let finish: () => void;
    const pending = runFinanceWrite(() => new Promise<void>(resolve => { finish = resolve; }));
    act(() => { expect(demo.activate()).toBe(false); });
    finish(); await pending;
    act(() => { expect(demo.activate()).toBe(true); });
  });
});
