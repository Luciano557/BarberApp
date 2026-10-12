import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EquipoSucursalPanel } from './EquipoSucursalPanel';

const mock = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  contar: vi.fn(),
  // Stable identity: the component lists the team in an effect that depends on this object.
  api: {
    listBySucursal: async () => [] as Array<Record<string, unknown>>,
    setDisponible: async () => {},
    deleteRow: async () => {},
  },
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isOwner: true, isGeneralManager: false, isManager: false }) }));
vi.mock('@/hooks/useDelayedVisible', () => ({ useDelayedVisible: (v: boolean) => v }));
vi.mock('@/hooks/useBarberosSucursalesRealtime', () => ({ useBarberosSucursalesRealtime: () => {} }));
vi.mock('@/hooks/useBarberosSucursales', async importOriginal => ({
  ...(await importOriginal<typeof import('@/hooks/useBarberosSucursales')>()),
  useBarberosSucursales: () => mock.api,
}));
vi.mock('@/lib/tareasAutomaticas', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/tareasAutomaticas')>()),
  contarTareasAutomaticasActivas: (...args: unknown[]) => mock.contar(...args),
}));
// Every Supabase read (barberos, turnos count) resolves to the same harmless payload.
vi.mock('@/integrations/supabase/client', () => {
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, key) => key === 'then'
      ? (resolve: (v: unknown) => void) => resolve({
        data: [{ id: 'b1', nombre: 'Ana', apellido: 'Test', rol_equipo: 'barbero', activo: true, telefono: null, comision: 0, access_email: null }],
        count: 0, error: null,
      })
      : () => chain,
  });
  return { supabase: { from: () => chain } };
});

const fila = (id: string, tipo: string, disponible: boolean) => ({
  id, barbero_id: 'b1', sucursal_id: 'S1', organization_id: 'o1', tipo,
  fecha_inicio: null, fecha_fin: null, dias_semana: tipo === 'recurrente' ? [1, 2, 3, 4, 5, 6, 7] : null,
  disponible, updated_at: '', created_at: '',
});

mock.api.listBySucursal = async () => mock.rows;

const renderPanel = () => render(<EquipoSucursalPanel sucursalId="S1" sucursalNombre="Centro" organizationId="o1" />);

describe('EquipoSucursalPanel · aviso de Tareas automáticas', () => {
  beforeEach(() => { mock.contar.mockReset(); });

  it('"Desactivar de la sucursal" solo cambia la disponibilidad: no avisa ni consulta Tareas automáticas', async () => {
    mock.rows = [fila('p', 'principal', true)];
    renderPanel();
    fireEvent.click(await screen.findByTitle('Opciones'));
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));
    await screen.findByText('Desactivar de la sucursal');
    await waitFor(() => expect(screen.queryByRole('note')).not.toBeInTheDocument());
    expect(mock.contar).not.toHaveBeenCalled();
  });

  it('eliminar la última asignación vigente de la persona en la sucursal avisa cuántas Tareas automáticas se pausan', async () => {
    mock.rows = [fila('r', 'recurrente', true)];
    mock.contar.mockResolvedValue(3);
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar asignación' }));
    expect(await screen.findByRole('note')).toHaveTextContent('3 Tareas automáticas asignadas a esta persona en esta sucursal se pausarán.');
    expect(mock.contar).toHaveBeenCalledWith({ organizationId: 'o1', sucursalId: 'S1', barberoId: 'b1' });
  });

  it('eliminar una asignación cuando queda otra vigente (la principal) no avisa', async () => {
    mock.rows = [fila('p', 'principal', false), fila('r', 'recurrente', true)];
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar asignación' }));
    await screen.findByText(/Verificando turnos futuros|No hay turnos futuros/);
    await waitFor(() => expect(screen.queryByRole('note')).not.toBeInTheDocument());
    expect(mock.contar).not.toHaveBeenCalled();
  });
});
