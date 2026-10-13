import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetBrowserClock, setBrowserClock } from '@/test/browserClock';
import { BarberSucursalesGeneralSection } from './BarberSucursalesGeneralSection';

const mock = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  tz: 'America/Argentina/Buenos_Aires',
  contar: vi.fn(),
  deleteRow: vi.fn(async () => {}),
  savePrincipal: vi.fn(async () => {}),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isOwner: true, isGeneralManager: false }) }));
vi.mock('@/contexts/OrganizationContext', () => ({ useOrganization: () => ({ organization: { id: 'o1', timezone: mock.tz } }) }));
// El desplegable de Radix tarda ~20 s en abrirse en jsdom. Se reemplaza solo el selector (cada opción llama a onValueChange);
// el componente que se prueba, con su lógica de aviso, es el real.
vi.mock('@/components/ui/select', async () => {
  const React = await import('react');
  const OnChange = React.createContext<(v: string) => void>(() => {});
  return {
    Select: ({ onValueChange, children }: { onValueChange: (v: string) => void; children: React.ReactNode }) =>
      React.createElement(OnChange.Provider, { value: onValueChange }, children),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const onChange = React.useContext(OnChange);
      return React.createElement('button', { type: 'button', role: 'option', 'aria-selected': false, onClick: () => onChange(value) }, children);
    },
  };
});
vi.mock('@/hooks/useDelayedVisible', () => ({ useDelayedVisible: (v: boolean) => v }));
vi.mock('@/hooks/useBarberosSucursales', async importOriginal => ({
  ...(await importOriginal<typeof import('@/hooks/useBarberosSucursales')>()),
  useBarberosSucursales: () => ({
    listByBarbero: async () => mock.rows,
    deleteRow: mock.deleteRow,
    savePrincipalDualWrite: mock.savePrincipal,
  }),
}));
vi.mock('@/lib/tareasAutomaticas', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/tareasAutomaticas')>()),
  contarTareasAutomaticasActivas: (...args: unknown[]) => mock.contar(...args),
}));

const fila = (id: string, tipo: string, sucursal_id: string, fecha_inicio: string | null = null, fecha_fin: string | null = null) => ({
  id, barbero_id: 'b1', sucursal_id, organization_id: 'o1', tipo,
  fecha_inicio, fecha_fin, dias_semana: tipo === 'recurrente' ? [1] : null,
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

describe('Equipo General · vigencia de una asignación temporal según la zona horaria de la organización', () => {
  const BA = 'America/Argentina/Buenos_Aires';
  const AUCKLAND = 'Pacific/Auckland';
  beforeEach(() => { mock.contar.mockReset(); mock.savePrincipal.mockClear(); mock.tz = BA; });
  afterEach(() => { resetBrowserClock(); mock.tz = BA; });

  // La temporal T de la misma sucursal: ¿sostiene la pertenencia? Lo decide el "hoy" de la organización (como la base),
  // aunque el navegador esté en otro día. El navegador y la organización quedan siempre en días distintos.
  const casos: Array<[string, string, string, string, string, string, boolean]> = [
    // descripción, zona org, zona navegador, instante, inicio de T, fin de T, ¿avisa?
    ['T vence en el límite (hoy es su último día en la organización): no es la última, no avisa', BA, AUCKLAND, '2026-10-13T02:00:00Z', '2026-10-01', '2026-10-12', false],
    ['T venció ayer en la organización (el navegador aún está en ese día): es la última, avisa', AUCKLAND, BA, '2026-10-12T20:00:00Z', '2026-10-01', '2026-10-12', true],
    ['T empieza en el límite (hoy es su primer día en la organización): no es la última, no avisa', AUCKLAND, BA, '2026-10-12T20:00:00Z', '2026-10-13', '2026-10-20', false],
    ['T empieza mañana en la organización (el navegador ya está en ese día): es la última, avisa', BA, AUCKLAND, '2026-10-13T02:00:00Z', '2026-10-13', '2026-10-20', true],
  ];

  it.each(casos)('eliminar la recurrente R · %s', async (_desc, zonaOrg, zonaNavegador, instante, ini, fin, avisa) => {
    mock.tz = zonaOrg;
    setBrowserClock(zonaNavegador, instante);
    mock.rows = [fila('p', 'principal', 'S1'), fila('r', 'recurrente', 'S2'), fila('t', 'temporal', 'S2', ini, fin)];
    mock.contar.mockResolvedValue(2);
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar asignación' }));
    await screen.findByText('Eliminar asignación recurrente');
    if (avisa) {
      expect(await screen.findByRole('note')).toHaveTextContent('2 Tareas automáticas asignadas a esta persona en esta sucursal se pausarán.');
      expect(mock.contar).toHaveBeenCalledWith({ organizationId: 'o1', sucursalId: 'S2', barberoId: 'b1' });
    } else {
      await waitFor(() => expect(screen.queryByRole('note')).not.toBeInTheDocument());
      expect(mock.contar).not.toHaveBeenCalled();
    }
  });

  it.each(casos)('cambiar la sucursal principal de S1 a S2 · %s', async (_desc, zonaOrg, zonaNavegador, instante, ini, fin, avisa) => {
    mock.tz = zonaOrg;
    setBrowserClock(zonaNavegador, instante);
    mock.rows = [fila('p', 'principal', 'S1'), fila('t', 'temporal', 'S1', ini, fin)];
    mock.contar.mockResolvedValue(2);
    renderSection();
    fireEvent.click(await screen.findByRole('option', { name: 'Norte' }));
    if (avisa) {
      expect(await screen.findByText('Cambiar sucursal principal')).toBeInTheDocument();
      expect(await screen.findByRole('note')).toHaveTextContent('2 Tareas automáticas asignadas a esta persona en esta sucursal se pausarán.');
      expect(mock.contar).toHaveBeenCalledWith({ organizationId: 'o1', sucursalId: 'S1', barberoId: 'b1' });
      expect(mock.savePrincipal).not.toHaveBeenCalled();
    } else {
      await waitFor(() => expect(mock.savePrincipal).toHaveBeenCalledWith('b1', 'S2'));
      expect(mock.contar).not.toHaveBeenCalled();
      expect(screen.queryByText('Cambiar sucursal principal')).not.toBeInTheDocument();
    }
  });
});
