import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceDemoProvider, useFinanceDemo } from '@/contexts/FinanceDemoContext';
import { FinanzasPanel } from '@/components/FinanzasPanel';
import { setFinanceDemoActive } from '@/lib/financeDemoRuntime';

const mock = vi.hoisted(() => ({ state: 'error', branchAccount: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'qa-user' }, isOwner: true, isLoading: false, isSucursalAccount: mock.branchAccount }) }));
vi.mock('@/contexts/OrganizationContext', () => ({ useOrganization: () => ({ organization: { id: 'qa-org' }, isLoading: false }) }));
vi.mock('@/components/EstadisticasPanel', () => ({ EstadisticasPanel: () => <p>{mock.state}</p> }));
vi.mock('@/components/SueldosPanel', () => ({ SueldosPanel: () => <p>Sueldos</p> }));
vi.mock('@/components/GastosPanel', () => ({ GastosPanel: () => <p>Gastos</p> }));
vi.mock('@/components/InversionesPanel', () => ({ InversionesPanel: () => null }));
vi.mock('@/components/DeudasPanel', () => ({ DeudasPanel: () => null }));

let mode: ReturnType<typeof useFinanceDemo>;
function Probe() { mode = useFinanceDemo(); return null; }

describe('entrada al modo de grabación', () => {
  beforeEach(() => { sessionStorage.clear(); setFinanceDemoActive(false); mock.branchAccount = false; });
  it.each(['error', 'loading', 'empty'])('permite activar aunque Estadísticas muestre %s', state => {
    mock.state = state;
    render(<FinanceDemoProvider><Probe /><FinanzasPanel barbers={[]} currentPlan="premium" onNavigateToBilling={() => {}} /></FinanceDemoProvider>);
    expect(screen.getByText(state)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar datos ficticios' }));
    expect(mode.active).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('Datos ficticios · Solo lectura');
    expect(screen.getByRole('button', { name: 'Desactivar datos ficticios' })).toBeInTheDocument();
  });
  it('conserva la restricción de plan para Estadísticas', () => {
    render(<FinanceDemoProvider><FinanzasPanel barbers={[]} currentPlan="basico" onNavigateToBilling={() => {}} /></FinanceDemoProvider>);
    expect(screen.getByText('Estadisticas esta disponible en Premium')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mostrar datos ficticios' })).not.toBeInTheDocument();
  });
  it('conserva las pestañas permitidas para cuentas de sucursal', () => {
    mock.branchAccount = true;
    render(<FinanceDemoProvider><FinanzasPanel barbers={[]} currentPlan="premium" onNavigateToBilling={() => {}} /></FinanceDemoProvider>);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.queryByRole('tab', { name: 'Estadisticas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mostrar datos ficticios' })).not.toBeInTheDocument();
  });
});
