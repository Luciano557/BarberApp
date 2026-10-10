import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { addDays, format } from 'date-fns';
import { OrganizationDetailView, organizationAccessPresentation } from './OrganizationDetailView';
import { OrganizationCommercialDrawer, commercialFormSchema } from './OrganizationCommercialDrawer';
import { adminCommercialFixture as fixture } from '@/test/fixtures/adminCommercial';

describe('commercial admin UI', () => {
  it('distinguishes manual access, trials and configured amounts from payments', () => {
    expect(organizationAccessPresentation(fixture).source).toBe('Acceso manual');
    const trial = { ...fixture, subscription: { ...fixture.subscription!, sourceStatus: 'expired', currentPlanCode: null, trialEndsAt: '2026-01-16T00:00:00Z' } };
    expect(organizationAccessPresentation(trial).source).toBe('Trial');
    expect(organizationAccessPresentation(trial).permitted).toBe(false);
    expect(organizationAccessPresentation(trial).deadline).toBe('2026-01-16T00:00:00Z');
  });
  it('read-only and provider blocks disable commercial access controls', () => {
    render(<MemoryRouter><OrganizationDetailView detail={{ ...fixture, capabilities: { ...fixture.capabilities, mutationsEnabled: false, canAssignManualPlan: false, blockCode: 'PROVIDER_RECONCILIATION_REQUIRED' } }} onAction={vi.fn()} history={null} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Editar datos' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Asignar acceso manual' })).toBeDisabled();
    expect(screen.getByText(/Reconciliá su estado real/)).toBeInTheDocument();
  });
  it('form requires password, reason, impact confirmation and explicit grant expiry', () => {
    const values = { name: 'Fixture', phone: '', address: '', contactEmail: '', planCode: 'basico', date: '', time: '', indefinite: false, reason: 'Motivo comercial válido', password: 'synthetic-test-only', confirmed: true };
    expect(commercialFormSchema('assign_manual_plan').safeParse(values).success).toBe(false);
    expect(commercialFormSchema('assign_manual_plan').safeParse({ ...values, indefinite: true }).success).toBe(true);
    expect(commercialFormSchema('extend_trial').safeParse({ ...values, indefinite: true }).success).toBe(false);
    expect(commercialFormSchema('update_details').safeParse({ ...values, confirmed: false }).success).toBe(false);
    const future = { ...values, date: format(addDays(new Date(), 2), 'yyyy-MM-dd'), time: '14:37' };
    expect(commercialFormSchema('assign_manual_plan').safeParse(future).success).toBe(true);
    expect(commercialFormSchema('extend_trial').safeParse(future).success).toBe(true);
    expect(commercialFormSchema('extend_trial').safeParse({ ...future, time: '25:99' }).success).toBe(false);
    expect(commercialFormSchema('extend_trial').safeParse({ ...future, date: '2026-02-30' }).success).toBe(false);
  });
  it('clears the password after a failed confirmation without retrying automatically', async () => {
    const apply = vi.fn().mockRejectedValue({ status: 403, code: 'REAUTHENTICATION_FAILED' });
    render(<OrganizationCommercialDrawer action="update_details" detail={fixture} onClose={vi.fn()} onStarted={vi.fn()} onResolved={vi.fn()} onApplied={vi.fn()} onApply={apply} onCheck={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Actualizar datos de contacto' } });
    fireEvent.change(screen.getByLabelText('Contraseña administrativa'), { target: { value: 'synthetic-test-only' } });
    fireEvent.click(screen.getByLabelText('Revisé la barbería, el cambio y sus consecuencias.'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambio' }));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByLabelText('Contraseña administrativa')).toHaveValue(''));
    expect(apply.mock.calls[0][0].expectedOrganizationUpdatedAt).toBe(fixture.organization.updatedAt);
  });
  it('an ambiguous write blocks resubmission and offers only status recovery', async () => {
    const apply = vi.fn().mockRejectedValue({ status: 500 });
    render(<OrganizationCommercialDrawer action="update_details" detail={fixture} onClose={vi.fn()} onStarted={vi.fn()} onResolved={vi.fn()} onApplied={vi.fn()} onApply={apply} onCheck={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Actualizar datos de contacto' } });
    fireEvent.change(screen.getByLabelText('Contraseña administrativa'), { target: { value: 'synthetic-test-only' } });
    fireEvent.click(screen.getByLabelText('Revisé la barbería, el cambio y sus consecuencias.'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambio' }));
    await screen.findByRole('button', { name: 'Consultar resultado' });
    expect(screen.getByRole('button', { name: 'Guardar cambio' })).toBeDisabled();
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
