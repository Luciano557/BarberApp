import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SubscriptionGate } from '@/components/billing/SubscriptionGate';

const mock = vi.hoisted(() => ({ requestExit: vi.fn(), invoke: vi.fn() }));
vi.mock('@/contexts/FinanceDemoContext', () => ({ useFinanceDemo: () => ({ active: true, requestExit: mock.requestExit }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isOwner: true, isGeneralManager: false, signOut: () => {} }) }));
vi.mock('@/contexts/OrganizationContext', () => ({ useOrganization: () => ({ organization: { name: 'Barbería privada QA' } }) }));
vi.mock('@/hooks/useSubscriptionPlans', () => ({
  useSubscriptionPlans: () => ({ data: [{ code: 'premium', name: 'Premium', amount_ars: 10000 }], isLoading: false, isError: false, refetch: () => {} }),
  formatSubscriptionPrice: () => '$10.000',
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mock.invoke } } }));

describe('suscripción durante la grabación', () => {
  it('conserva la restricción, oculta el negocio real y pide salir antes del checkout', () => {
    render(<SubscriptionGate access={null} onRetry={() => {}} />);
    expect(screen.getByText('La suscripcion esta vencida')).toBeInTheDocument();
    expect(screen.getByText('Barbería Demo')).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('Barbería privada QA');
    fireEvent.click(screen.getByRole('button', { name: 'Elegir plan' }));
    expect(mock.requestExit).toHaveBeenCalledOnce();
    expect(mock.invoke).not.toHaveBeenCalled();
  });
});
