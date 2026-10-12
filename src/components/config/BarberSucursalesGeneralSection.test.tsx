import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BarberSucursalesGeneralSection } from './BarberSucursalesGeneralSection';

const mock = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  contar: vi.fn(),
  deleteRow: vi.fn(async () => {}),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isOwner: true, isGeneralManager: false }) }));
vi.mock('@/hooks/useDelayedVisible', () => ({ useDelayedVisible: (v: boolean) => v }));
vi.mock('@/hooks/useBarberosSucursales', async importOriginal => ({
  ...(await importOriginal<typeof import('@/hooks/useBarberosSucursales')>()),
  useBarberosSucursales: () => ({
    listByBarbero: async () => mock.rows,
    deleteRow: mock.deleteRow,
    savePrincipalDualWrite: vi.fn(async () => {}),
  }),
}));
vi.mock('@/lib/tareasAutomaticas', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/tareasAutomaticas')>()),
  contarTareasAutomaticasActivas: (...args: unknown[]) => mock.contar(...args),
}));

const fila = (id: string, tipo: string, sucursal_id: string) => ({
  id, barbero_id: 'b1', sucursal_id, organization_id: 'o1', tipo,
  fecha_inicio: null, fecha_fin: null, dias_semana: tipo === 'recurrente' ? [1] : null,
  disponible: false, updated_at: '', created_at: '',
});

function renderSection() {
  render(
    <BarberSucursalesGeneralSection
      barberoId="b1"
      organizationId="o1"
      sucursales={[{ id: 'S1', nombre: 'Centro' }, { id: 'S2', nombre: 'Norte' }]}
    />,
  );
}

describe('Eliminar asignación recurrente · aviso de Tareas automáticas', () => {
  beforeEach(() => { mock.contar.mockReset(); mock.deleteRow.mockClear(); });

  it('avisa cuántas se pausarán cuando era la última asignación vigente en esa sucursal', async () => {
    mock.rows = [fila('p', 'principal', 'S1'), fila('r', 'recurrente', 'S2')];
    mock.contar.mockResolvedValue(2);
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar asignación' }));
    expect(await screen.findByRole('note')).toHaveTextContent('2 Tareas automáticas asignadas a esta persona en esta sucursal se pausarán.');
    expect(mock.contar).toHaveBeenCalledWith({ organizationId: 'o1', sucursalId: 'S2', barberoId: 'b1' });
  });

  it('no avisa ni consulta cuando la persona conserva otra asignación vigente en esa sucursal', async () => {
    mock.rows = [fila('p', 'principal', 'S1'), fila('r', 'recurrente', 'S1')];
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar asignación' }));
    await screen.findByText('Eliminar asignación recurrente');
    await waitFor(() => expect(screen.queryByRole('note')).not.toBeInTheDocument());
    expect(mock.contar).not.toHaveBeenCalled();
  });
});
