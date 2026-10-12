import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecurrenteCard } from './RecurrenteCard';
import { TareasAutomaticasPausaAviso } from './TareasAutomaticasPausaAviso';
import type { TareaRecurrente } from '@/hooks/useTareasRecurrentes';

vi.mock('@/components/ActionPinGate', () => ({
  useRequirePinForAction: () => async () => ({ ok: true }),
}));

const base: TareaRecurrente = {
  id: 'r1',
  organization_id: 'o1',
  sucursal_id: 's1',
  titulo: 'Limpiar herramientas',
  descripcion: null,
  assignment_scope: 'team',
  asignado_a: null,
  asignado_nombre: 'Todo el equipo',
  hora: null,
  repeat_preset: 'weekly',
  repeat_frequency: null,
  repeat_interval: null,
  repeat_byweekday: null,
  fecha_inicio: '2026-10-05',
  proxima_fecha: '2026-10-19',
  activo: true,
  pausa_motivo: null,
  pausada_at: null,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  created_by: null,
};

function renderCard(receta: TareaRecurrente, onToggle = vi.fn()) {
  render(
    <RecurrenteCard
      receta={receta}
      sucursalNombre="Centro"
      canManage
      canDelete
      isSucursalAccount={false}
      onEdit={vi.fn()}
      onToggle={onToggle}
      onDelete={vi.fn()}
    />,
  );
  return onToggle;
}

describe('RecurrenteCard · motivo de pausa', () => {
  it('una tarea automática activa se puede pausar y no muestra motivo', () => {
    const onToggle = renderCard(base);
    expect(screen.getByText('Activa')).toBeInTheDocument();
    expect(screen.queryByText(/Sucursal inactiva|Barbero inactivo|manualmente/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pausar/ }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('una pausa manual explica que la pausó la persona y se puede reanudar a mano', async () => {
    const onToggle = renderCard({ ...base, activo: false, pausa_motivo: 'manual' });
    expect(screen.getByText('Pausada')).toBeInTheDocument();
    expect(screen.getByText(/Pausada manualmente/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reanudar/ }));
    await vi.waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['sucursal_inactiva', /Sucursal inactiva/],
    ['barbero_inactivo', /Barbero inactivo/],
    ['barbero_sin_asignacion', /Barbero sin asignación en la sucursal/],
  ] as const)('una pausa automática (%s) muestra el motivo, dice que se reanuda sola y no ofrece reanudar a mano', (motivo, texto) => {
    renderCard({ ...base, activo: false, pausa_motivo: motivo });
    expect(screen.getByText(texto)).toBeInTheDocument();
    expect(screen.getByText(/Se reanuda sola/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reanudar|Pausar/ })).not.toBeInTheDocument();
  });
});

describe('TareasAutomaticasPausaAviso', () => {
  it('no muestra nada mientras consulta ni cuando no hay Tareas automáticas afectadas', () => {
    const { container, rerender } = render(<TareasAutomaticasPausaAviso tipo="sucursal" cantidad={undefined} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<TareasAutomaticasPausaAviso tipo="sucursal" cantidad={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('avisa cuántas se pausarán, con la terminología "Tareas automáticas"', () => {
    render(<TareasAutomaticasPausaAviso tipo="barbero" cantidad={2} />);
    expect(screen.getByRole('note')).toHaveTextContent('2 Tareas automáticas asignadas a esta persona se pausarán.');
  });

  it('si no se pudo consultar, lo dice en vez de callar', () => {
    render(<TareasAutomaticasPausaAviso tipo="asignacion" cantidad={null} />);
    expect(screen.getByRole('note')).toHaveTextContent('No pudimos verificar');
  });
});
