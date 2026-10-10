import { fireEvent, render, screen } from '@testing-library/react';
import { Users } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { AdminCollectionCard } from '@/admin/components/AdminCollectionCard';

const baseProps = {
  toolbar: <h2>Usuarios</h2>,
  isPending: false,
  isError: false,
  hasData: false,
  isEmpty: false,
  errorMessage: 'No pudimos cargar.',
  emptyIcon: Users,
  emptyTitle: 'Sin usuarios',
  emptyDescription: 'Todavía no hay usuarios.',
  onRetry: vi.fn(),
};

describe('AdminCollectionCard', () => {
  it('diferencia un error de lectura de un estado vacío', () => {
    render(<AdminCollectionCard {...baseProps} isError><p>Contenido</p></AdminCollectionCard>);
    expect(screen.getByText('No pudimos cargar.')).toBeInTheDocument();
    expect(screen.queryByText('Sin usuarios')).not.toBeInTheDocument();
  });

  it('muestra ausencia real solo cuando la lectura terminó correctamente', () => {
    render(<AdminCollectionCard {...baseProps} isEmpty><p>Contenido</p></AdminCollectionCard>);
    expect(screen.getByText('Sin usuarios')).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay usuarios.')).toBeInTheDocument();
  });

  it('mantiene datos anteriores y permite reintentar si falla un refetch', () => {
    const retry = vi.fn();
    render(
      <AdminCollectionCard {...baseProps} isError hasData onRetry={retry}>
        <p>Dato anterior</p>
      </AdminCollectionCard>,
    );
    expect(screen.getByText('Dato anterior')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
