import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetBrowserClock, setBrowserClock } from '@/test/browserClock';
import { EquipoSucursalPanel } from './EquipoSucursalPanel';

const mock = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  tz: 'America/Argentina/Buenos_Aires',
  contar: vi.fn(),
  // Stable identity: the component lists the team in an effect that depends on this object.
  api: {
    listBySucursal: async () => [] as Array<Record<string, unknown>>,
    setDisponible: async () => {},
    deleteRow: async () => {},
  },
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isOwner: true, isGeneralManager: false, isManager: false }) }));
vi.mock('@/contexts/OrganizationContext', () => ({ useOrganization: () => ({ organization: { id: 'o1', timezone: mock.tz } }) }));
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

const fila = (id: string, tipo: string, disponible: boolean, fecha_inicio: string | null = null, fecha_fin: string | null = null) => ({
  id, barbero_id: 'b1', sucursal_id: 'S1', organization_id: 'o1', tipo,
  fecha_inicio, fecha_fin, dias_semana: tipo === 'recurrente' ? [1, 2, 3, 4, 5, 6, 7] : null,
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

describe('EquipoSucursalPanel · vigencia de una asignación temporal según la zona horaria de la organización', () => {
  const BA = 'America/Argentina/Buenos_Aires';
  const AUCKLAND = 'Pacific/Auckland';
  beforeEach(() => { mock.contar.mockReset(); mock.tz = BA; });
  afterEach(() => { resetBrowserClock(); mock.tz = BA; });

  // Eliminar la recurrente R: ¿la temporal T sostiene la pertenencia? Lo decide el "hoy" de la organización (como la base),
  // aunque el navegador esté en otro día. El navegador y la organización quedan siempre en días distintos.
  const casos: Array<[string, string, string, string, string, string, boolean]> = [
    // descripción, zona org, zona navegador, instante, inicio de T, fin de T, ¿avisa?
    ['T vence en el límite (hoy es su último día en la organización): R no es la última, no avisa', BA, AUCKLAND, '2026-10-13T02:00:00Z', '2026-10-01', '2026-10-12', false],
    ['T venció ayer en la organización (el navegador aún está en ese día): R es la última, avisa', AUCKLAND, BA, '2026-10-12T20:00:00Z', '2026-10-01', '2026-10-12', true],
    ['T empieza en el límite (hoy es su primer día en la organización): R no es la última, no avisa', AUCKLAND, BA, '2026-10-12T20:00:00Z', '2026-10-13', '2026-10-20', false],
    ['T empieza mañana en la organización (el navegador ya está en ese día): R es la última, avisa', BA, AUCKLAND, '2026-10-13T02:00:00Z', '2026-10-13', '2026-10-20', true],
  ];

  it.each(casos)('%s', async (_desc, zonaOrg, zonaNavegador, instante, ini, fin, avisa) => {
    mock.tz = zonaOrg;
    setBrowserClock(zonaNavegador, instante);
    mock.rows = [fila('r', 'recurrente', true), fila('t', 'temporal', true, ini, fin)];
    mock.contar.mockResolvedValue(2);
    renderPanel();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Eliminar asignación' }))[0]);
    if (avisa) {
      expect(await screen.findByRole('note')).toHaveTextContent('2 Tareas automáticas asignadas a esta persona en esta sucursal se pausarán.');
      expect(mock.contar).toHaveBeenCalledWith({ organizationId: 'o1', sucursalId: 'S1', barberoId: 'b1' });
    } else {
      await screen.findByText(/Verificando turnos futuros|No hay turnos futuros/);
      await waitFor(() => expect(screen.queryByRole('note')).not.toBeInTheDocument());
      expect(mock.contar).not.toHaveBeenCalled();
    }
  });
});
