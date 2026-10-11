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
  it('new trial action supports shortening and past deadlines; legacy extension still forbids shortening', () => {
    const values = { name: 'Fixture', phone: '', address: '', contactEmail: '', planCode: 'basico',
      date: '2020-01-01', time: '14:37', indefinite: false, reason: 'Prueba de vencimiento inmediato',
      password: 'synthetic-test-only', confirmed: true };
    expect(commercialFormSchema('set_trial_end').safeParse(values).success).toBe(true);
    expect(commercialFormSchema('set_trial_end').safeParse({ ...values, confirmed: false }).success).toBe(false);
    const future = { ...values, date: format(addDays(new Date(), 2), 'yyyy-MM-dd') };
    expect(commercialFormSchema('set_trial_end', '2099-01-01T00:00:00Z').safeParse(future).success).toBe(true);
    expect(commercialFormSchema('extend_trial', '2099-01-01T00:00:00Z').safeParse(future).success).toBe(false);
  });
  it('ending a trial now explicitly confirms loss of access and submits the exact new action', async () => {
    const apply = vi.fn().mockResolvedValue({});
    render(<OrganizationCommercialDrawer action="set_trial_end" detail={{ ...fixture, subscription: {
      ...fixture.subscription!, provider: 'mercadopago', sourceStatus: 'trialing', currentPlanCode: null,
      trialEndsAt: '2099-01-01T00:00:00Z' } }} onClose={vi.fn()} onStarted={vi.fn()}
      onResolved={vi.fn()} onApplied={vi.fn()} onApply={apply} onCheck={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vencer ahora' }));
    expect(screen.getByText(/El trial quedará vencido al guardar/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Prueba de vencimiento inmediato' } });
    fireEvent.change(screen.getByLabelText('Contraseña administrativa'), { target: { value: 'synthetic-test-only' } });
    fireEvent.click(screen.getByLabelText('Confirmo que el trial vencerá y la barbería perderá el acceso de prueba al guardar.'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambio' }));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(apply.mock.calls[0][0].action).toBe('set_trial_end');
    expect(Date.parse(apply.mock.calls[0][0].changes.endsAt)).toBeLessThanOrEqual(Date.now());
  });
  it('changing the deadline resets the previous impact confirmation', () => {
    render(<OrganizationCommercialDrawer action="set_trial_end" detail={fixture} onClose={vi.fn()}
      onStarted={vi.fn()} onResolved={vi.fn()} onApplied={vi.fn()} onApply={vi.fn()} onCheck={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Revisé la barbería, el cambio y sus consecuencias.'));
    fireEvent.click(screen.getByRole('button', { name: 'Vencer ahora' }));
    expect(screen.getByLabelText('Confirmo que el trial vencerá y la barbería perderá el acceso de prueba al guardar.')).not.toBeChecked();
  });
  it('a new request key is generated after a definitive rejection', async () => {
    const apply = vi.fn().mockRejectedValue({ status: 403, code: 'REAUTHENTICATION_FAILED' });
    render(<OrganizationCommercialDrawer action="update_details" detail={fixture} onClose={vi.fn()}
      onStarted={vi.fn()} onResolved={vi.fn()} onApplied={vi.fn()} onApply={apply} onCheck={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Actualizar datos de contacto' } });
    fireEvent.click(screen.getByLabelText('Revisé la barbería, el cambio y sus consecuencias.'));
    for (let attempt = 1; attempt <= 2; attempt++) {
      fireEvent.change(screen.getByLabelText('Contraseña administrativa'), { target: { value: 'synthetic-test-only' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cambio' }));
      await waitFor(() => expect(apply).toHaveBeenCalledTimes(attempt));
      await waitFor(() => expect(screen.getByLabelText('Contraseña administrativa')).toHaveValue(''));
    }
    expect(apply.mock.calls[0][1]).not.toBe(apply.mock.calls[1][1]);
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
  it('a confirmed failed receipt releases the recovery marker without submitting again', async () => {
    const apply = vi.fn().mockRejectedValue({ status: 500 });
    const resolved = vi.fn();
    const check = vi.fn().mockResolvedValue({ status: 'failed', code: 'COMMERCIAL_CONFLICT', message: 'Rechazado sin cambios.' });
    render(<OrganizationCommercialDrawer action="update_details" detail={fixture} onClose={vi.fn()}
      onStarted={vi.fn()} onResolved={resolved} onApplied={vi.fn()} onApply={apply} onCheck={check} />);
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Actualizar datos de contacto' } });
    fireEvent.change(screen.getByLabelText('Contraseña administrativa'), { target: { value: 'synthetic-test-only' } });
    fireEvent.click(screen.getByLabelText('Revisé la barbería, el cambio y sus consecuencias.'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambio' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Consultar resultado' }));
    await waitFor(() => expect(resolved).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Rechazado sin cambios.')).toBeInTheDocument();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Guardar cambio' })).toBeDisabled();
  });
  it('not_found alone never releases an uncertain write', async () => {
    const resolved = vi.fn();
    render(<OrganizationCommercialDrawer action="update_details" detail={fixture} onClose={vi.fn()}
      onStarted={vi.fn()} onResolved={resolved} onApplied={vi.fn()}
      onApply={vi.fn().mockRejectedValue({ status: 500 })} onCheck={vi.fn().mockResolvedValue({ status: 'not_found' })} />);
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Actualizar datos de contacto' } });
    fireEvent.change(screen.getByLabelText('Contraseña administrativa'), { target: { value: 'synthetic-test-only' } });
    fireEvent.click(screen.getByLabelText('Revisé la barbería, el cambio y sus consecuencias.'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambio' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Consultar resultado' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Consultar resultado' })).not.toBeDisabled());
    expect(resolved).not.toHaveBeenCalled();
  });
});
