import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceDemoProvider, FINANCE_DEMO_STORAGE_KEY, useFinanceDemo } from '@/contexts/FinanceDemoContext';
import { FinanzasPanel } from '@/components/FinanzasPanel';
import { AppSidebar } from '@/components/AppSidebar';
import { FinanceDemoExitDialog } from './FinanceDemoExitDialog';
import { setFinanceDemoActive } from '@/lib/financeDemoRuntime';

const mock = vi.hoisted(() => ({
  from: vi.fn(() => { throw new Error('Unexpected operational request'); }),
  rpc: vi.fn(() => { throw new Error('Unexpected operational RPC'); }),
  realBranchChange: vi.fn(), navigate: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({
  user: { id: 'qa-user' }, profile: { full_name: 'Nombre privado QA', email: 'privado@example.invalid' }, roles: ['owner'],
  isOwner: true, isGeneralManager: false, isManager: false, isBarber: false, isSucursalAccount: false,
  canManagePayments: true, canOperarCajaYGastos: true, canManageConfig: true, canViewConfig: true,
  canViewResumen: true, canViewTareas: true, canViewMiNegocio: true, canViewFinanzas: true,
  canViewTurnosAgenda: true, canViewClientes: true, signOut: () => {}, isLoading: false,
}) }));
vi.mock('@/contexts/OrganizationContext', () => ({ useOrganization: () => ({ organization: { id: 'qa-org', name: 'Barbería privada QA', plan: 'premium' }, isLoading: false }) }));
vi.mock('@/contexts/SucursalContext', () => ({ useSucursal: () => ({
  sucursales: [{ id: 'qa-branch', nombre: 'Sucursal privada QA' }], currentSucursal: { id: 'qa-branch', nombre: 'Sucursal privada QA' },
  isAllMode: false, setCurrentSucursal: mock.realBranchChange,
}) }));
vi.mock('@/hooks/useSubscriptionAccess', () => ({ useSubscriptionAccess: () => ({ access: { effective_plan_code: 'premium' } }) }));
vi.mock('@/hooks/usePinProtection', () => ({ usePinProtection: () => ({ isUnlocked: true, requiresPin: true, unlockedBy: 'Operador privado QA', lock: () => {} }) }));
vi.mock('@/components/ActionPinGate', () => ({ useRequirePinForAction: () => async () => ({ ok: true }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mock.from, rpc: mock.rpc } }));
vi.mock('@/components/notifications/NotificationsBell', () => ({ NotificationsBell: () => { throw new Error('Live notifications must not mount'); } }));

function RecordingSurface() {
  const demo = useFinanceDemo();
  return <><AppSidebar activeTab="finanzas" onTabChange={() => demo.requestExit(mock.navigate)} />
    <FinanzasPanel barbers={[]} currentPlan="premium" onNavigateToBilling={() => demo.requestExit(mock.navigate)} />
    <FinanceDemoExitDialog /></>;
}
function tab(name: string) { fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false }); }
describe('interfaz de grabación', () => {
  beforeEach(() => {
    setFinanceDemoActive(false);
    sessionStorage.setItem(FINANCE_DEMO_STORAGE_KEY, JSON.stringify({ identity: 'qa-user:qa-org', branch: null, referenceDate: new Date().toISOString() }));
  });
  it('muestra las cinco pestañas, conserva detalles y deshabilita operaciones', async () => {
    render(<FinanceDemoProvider><RecordingSurface /></FinanceDemoProvider>);
    expect(screen.getByText('Datos ficticios · Solo lectura')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desactivar datos ficticios' })).toBeInTheDocument();
    tab('Sueldos');
    expect(screen.getByRole('button', { name: 'Registrar Pago' })).toBeDisabled();
    expect(screen.getAllByText('Lucas Méndez')[0]).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Lucas Méndez')[0]);
    expect(screen.getByText('Cierres de Caja')).toBeInTheDocument();
    tab('Gastos');
    expect(screen.getByRole('button', { name: 'Registrar gasto' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Eliminar gasto recurrente' }).every(button => button.hasAttribute('disabled'))).toBe(true);
    tab('Inversiones');
    expect(screen.getByRole('button', { name: 'Nueva' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Eliminar inversión' }).every(button => button.hasAttribute('disabled'))).toBe(true);
    tab('Deudas');
    expect(screen.getByRole('button', { name: 'Nueva' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Registrar pago' }).every(button => button.hasAttribute('disabled'))).toBe(true);
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver historial de pagos' })[0]);
    await waitFor(() => expect(screen.getByText('Cuota 1')).toBeInTheDocument());
    expect(mock.from).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('oculta identidades reales también en menús y tooltips y no cambia la sucursal real', () => {
    render(<FinanceDemoProvider><RecordingSurface /></FinanceDemoProvider>);
    for (const secret of ['Nombre privado QA', 'privado@example.invalid', 'Barbería privada QA', 'Sucursal privada QA', 'Operador privado QA']) expect(document.body.innerHTML).not.toContain(secret);
    const branchSelect = screen.getAllByRole('combobox')[0];
    fireEvent.keyDown(branchSelect, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'Sucursal Norte' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Sucursal Norte' }));
    expect(mock.realBranchChange).not.toHaveBeenCalled();
    expect(document.body.innerHTML).not.toContain('privada QA');
  });
  it('mantiene protegida la pantalla al cancelar la salida a otro módulo', () => {
    render(<FinanceDemoProvider><RecordingSurface /></FinanceDemoProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Clientes' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Se volverán a mostrar datos reales');
    expect(mock.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir con datos ficticios' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Datos ficticios · Solo lectura')).toBeInTheDocument();
    expect(mock.navigate).not.toHaveBeenCalled();
  });
});
