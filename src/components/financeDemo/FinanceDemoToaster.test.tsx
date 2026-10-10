import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceDemoToaster } from './FinanceDemoToaster';
import { setFinanceDemoActive } from '@/lib/financeDemoRuntime';

vi.mock('@/components/ui/sonner', () => ({ Toaster: () => <aside>Notificación privada pendiente</aside> }));

describe('avisos globales al grabar', () => {
  beforeEach(() => setFinanceDemoActive(false));
  it('retira el contenido real al activar y lo restaura solamente al salir', () => {
    render(<FinanceDemoToaster />);
    expect(screen.getByText('Notificación privada pendiente')).toBeInTheDocument();
    act(() => setFinanceDemoActive(true));
    expect(document.body.innerHTML).not.toContain('Notificación privada pendiente');
    act(() => setFinanceDemoActive(false));
    expect(screen.getByText('Notificación privada pendiente')).toBeInTheDocument();
  });
  it('no monta avisos al recargar con la protección restaurada', () => {
    setFinanceDemoActive(true); render(<FinanceDemoToaster />);
    expect(document.body.innerHTML).not.toContain('Notificación privada pendiente');
  });
});
