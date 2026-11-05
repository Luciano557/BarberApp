import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStepper } from './BookingStepper';
import { DatosClienteStep } from './DatosClienteStep';
import { FechaHorarioStep } from './FechaHorarioStep';
import { MisTurnosStep } from './MisTurnosStep';
import { RescheduleFlow } from './RescheduleFlow';
import { CancelTurnoDialog } from './CancelTurnoDialog';
import { usePortalRead } from './hooks/usePortalRead';
import type { OrgPublicData } from '@/pages/Reservar';

const state = vi.hoisted(() => ({ invoke: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: state.invoke } } }));
vi.mock('@/lib/feedback', () => ({ feedback: { error: state.error, success: vi.fn(), dismiss: state.dismiss } }));

const day = (offset = 0) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const ok = (data: unknown) => ({ data, error: null });
const failure = (code = 'forbidden', status = 403) => ({ data: null, error: { context: new Response(JSON.stringify({ error: code }), { status }) } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const org: OrgPublicData = {
  organization: { id: 'org-a', name: 'Barbería de prueba', logo_url: null, timezone: 'America/Argentina/Buenos_Aires' },
  sucursales: [{ id: 'branch-a', nombre: 'Centro' }],
  servicios: [
    { id: 'service-a', nombre: 'Corte', precio: 20000, duracion_min: 30, sucursal_id: 'branch-a' },
    { id: 'service-b', nombre: 'Barba', precio: 12000, duracion_min: 30, sucursal_id: 'branch-a' },
  ],
  barberos: [{ id: 'barber-a', nombre: 'Alex', apellido: 'Prueba', sucursal_id: 'branch-a' }], portal: null,
};
const turno = {
  id: 'turno-a', fecha: day(), hora_inicio: '11:00', hora_fin: '11:30', estado: 'confirmado',
  cliente_nombre: 'Cliente', sucursal_id: 'branch-a', sucursal_nombre: 'Centro', barbero_id: 'barber-a',
  barbero_nombre: 'Alex Prueba', servicio_id: 'service-a', servicio_nombre: 'Corte', servicio_precio: 20000,
  servicio_duracion: 30, organization_id: 'org-a', puede_cancelar: true, puede_reprogramar: true,
  cancelacion_limite_min: 120, modificacion_limite_min: 120,
};
const slot = (hora = '11:00') => ({ hora_inicio: hora, hora_fin: '11:30', barberos: [{ id: 'barber-a', nombre: 'Alex Prueba' }] });
beforeEach(() => {
  state.invoke.mockReset(); state.error.mockReset(); state.dismiss.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
  state.invoke.mockImplementation(async (name: string) => {
    if (name === 'get-available-dates') return ok({ available_dates: [day(), day(1)], max_date: day(29) });
    if (name === 'get-availability') return ok({ slots: [slot()] });
    if (name === 'lookup-cliente-by-phone') return ok({ found: false });
    if (name === 'get-my-turnos-by-phone') return ok({ turnos: [turno] });
    return ok({ success: true });
  });
});

describe('reserva pública y conservación de datos', () => {
  it('cuenta cinco pasos para una sucursal y conserva el borrador al volver desde datos', async () => {
    render(<BookingStepper orgData={org} mode="book" onBackToLanding={vi.fn()} onBookNew={vi.fn()} />);
    await screen.findByText('Paso 1 de 5');
    fireEvent.click(screen.getByRole('button', { name: /Corte 30 min/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cualquiera disponible/ }));
    fireEvent.click(await screen.findByRole('button', { name: '11:00' }));
    // Primero se pide solo el teléfono; el registro no compite con esa tarea.
    expect(screen.queryByRole('textbox', { name: 'Nombre *' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Teléfono para buscar tus datos' }), { target: { value: '1123456789' } });
    fireEvent.click(screen.getByRole('button', { name: 'Completar mis datos' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre *' }), { target: { value: 'Cliente' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Apellido *' }), { target: { value: 'Prueba' } });
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    fireEvent.click(await screen.findByRole('button', { name: '11:00' }));
    expect(screen.getByRole('textbox', { name: 'Nombre *' })).toHaveValue('Cliente');
    expect(screen.getByRole('textbox', { name: 'Teléfono *' })).toHaveValue('1123456789');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText('Paso 5 de 5')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Confirmá tu turno' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByRole('textbox', { name: 'Apellido *' })).toHaveValue('Prueba');
    // Cambiar el servicio invalida su selección dependiente, pero no la identidad.
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    fireEvent.click(screen.getByRole('button', { name: /Barba 30 min/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cualquiera disponible/ }));
    fireEvent.click(await screen.findByRole('button', { name: '11:00' }));
    expect(screen.getByRole('textbox', { name: 'Nombre *' })).toHaveValue('Cliente');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    await screen.findByText('¡Turno confirmado!');
    expect(state.invoke.mock.calls.find(([name]) => name === 'validate-turno')?.[1].body).toMatchObject({ servicio_id: 'service-b', cliente_nombre: 'Cliente', organization_id: 'org-a', sucursal_id: 'branch-a' });
    const availabilityCalls = state.invoke.mock.calls.filter(([name]) => name === 'get-availability');
    expect(availabilityCalls.every(([, options]) => options.body.barbero_id === null)).toBe(true);
  });

  it('mantiene seis pasos con más de una sucursal', () => {
    render(<BookingStepper orgData={{ ...org, sucursales: [...org.sucursales, { id: 'branch-b', nombre: 'Norte' }] }} mode="book" onBackToLanding={vi.fn()} onBookNew={vi.fn()} />);
    expect(screen.getByText('Paso 1 de 6')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Centro' }));
    expect(screen.getByText('Paso 2 de 6')).toBeInTheDocument();
  });

  it('prefiere la fecha que el cliente ya había elegido', async () => {
    render(<FechaHorarioStep organizationId="org-a" sucursalId="branch-a" servicioId="service-a" barberoId={null} initialFecha={day(1)} onSelect={vi.fn()} onChangeBarbero={vi.fn()} />);
    await screen.findByRole('button', { name: '11:00' });
    expect(state.invoke.mock.calls.find(([name]) => name === 'get-availability')?.[1].body.fecha).toBe(day(1));
  });

  it('identifica un cliente o pasa al registro conservando el teléfono', async () => {
    const submit = vi.fn();
    state.invoke.mockResolvedValue(ok({ found: true, cliente: { nombre: 'Cliente', apellido: 'Prueba', telefono: '+5491123456789', email: null, birth_date: null } }));
    render(<DatosClienteStep organizationId="org-a" onSubmit={submit} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Teléfono para buscar tus datos' }), { target: { value: '1123456789' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar mis datos' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, soy yo. Continuar' }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ telefono: '+5491123456789', nombre: 'Cliente' }));
    expect(state.invoke.mock.calls[0][1].body.organization_id).toBe('org-a');
  });

  it('abre el registro de un teléfono nuevo con el número ya ingresado', async () => {
    render(<DatosClienteStep organizationId="org-a" onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Teléfono para buscar tus datos' }), { target: { value: '1123456789' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar mis datos' }));
    await screen.findByRole('textbox', { name: 'Nombre *' });
    expect(screen.getByRole('textbox', { name: 'Teléfono *' })).toHaveValue('1123456789');
    expect(screen.queryByRole('button', { name: 'Buscar mis datos' })).not.toBeInTheDocument();
  });
});

describe('errores, refetch y respuestas fuera de orden', () => {
  it('un fallo al buscar turnos muestra reintento, nunca una agenda vacía', async () => {
    state.invoke.mockResolvedValue(failure('raw_database_error'));
    render(<MisTurnosStep organizationId="org-a" telefono="+5491123456789" onReschedule={vi.fn()} onBookNew={vi.fn()} />);
    await screen.findByRole('button', { name: 'Reintentar' });
    expect(screen.queryByText(/No tenés turnos próximos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/raw_database_error/)).not.toBeInTheDocument();
    state.invoke.mockResolvedValue(ok({ turnos: [] }));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText(/No tenés turnos próximos/);
  });

  it('no reutiliza respuestas de otro teléfono u organización aunque lleguen tarde', async () => {
    const old = deferred<ReturnType<typeof ok>>();
    state.invoke.mockReturnValueOnce(old.promise).mockResolvedValue(ok({ turnos: [{ ...turno, id: 'turno-b' }] }));
    const { result, rerender } = renderHook(({ orgId, phone }) => usePortalRead<{ turnos: typeof turno[] }>('get-my-turnos-by-phone', { organization_id: orgId, telefono: phone }, 'No pudimos actualizar.'), { initialProps: { orgId: 'org-a', phone: 'phone-a' } });
    rerender({ orgId: 'org-b', phone: 'phone-b' });
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.data?.turnos[0].id).toBe('turno-b'));
    await act(async () => old.resolve(ok({ turnos: [turno] })));
    expect(result.current.data?.turnos[0].id).toBe('turno-b');
    expect(state.invoke.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('mantiene los turnos visibles durante un refetch que falla y ofrece reintento', async () => {
    const next = deferred<ReturnType<typeof failure>>();
    state.invoke.mockResolvedValueOnce(ok({ turnos: [turno] })).mockReturnValueOnce(next.promise);
    const { result } = renderHook(() => usePortalRead<{ turnos: typeof turno[] }>('get-my-turnos-by-phone', { organization_id: 'org-a', telefono: 'phone-a' }, 'No pudimos actualizar.'));
    await waitFor(() => expect(result.current.data?.turnos).toHaveLength(1));
    act(() => result.current.refetch());
    expect(result.current.loading).toBe(false);
    expect(result.current.data?.turnos).toHaveLength(1);
    await act(async () => next.resolve(failure()));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data?.turnos).toHaveLength(1);
    expect(state.error).toHaveBeenCalledWith('No pudimos actualizar.', expect.objectContaining({ retry: expect.any(Object) }));
  });

  it('no sustituye un fallo de fechas por falta de disponibilidad', async () => {
    state.invoke.mockResolvedValue(failure());
    render(<FechaHorarioStep organizationId="org-a" sucursalId="branch-a" servicioId="service-a" barberoId={null} onSelect={vi.fn()} onChangeBarbero={vi.fn()} />);
    await screen.findByText('No pudimos cargar las fechas disponibles.');
    expect(screen.queryByText('No hay turnos próximos disponibles')).not.toBeInTheDocument();
  });

  it('un horario tardío de otra fecha no reemplaza la selección actual', async () => {
    const old = deferred<ReturnType<typeof ok>>();
    state.invoke.mockImplementation(async (name, options) => {
      if (name === 'get-available-dates') return ok({ available_dates: [day(), day(1)], max_date: day(29) });
      return options.body.fecha === day() ? old.promise : ok({ slots: [slot('12:00')] });
    });
    render(<FechaHorarioStep organizationId="org-a" sucursalId="branch-a" servicioId="service-a" barberoId={null} onSelect={vi.fn()} onChangeBarbero={vi.fn()} />);
    await waitFor(() => expect(state.invoke.mock.calls.some(([name]) => name === 'get-availability')).toBe(true));
    const days = screen.getAllByRole('button', { pressed: false });
    fireEvent.click(days[0]);
    await screen.findByRole('button', { name: '12:00' });
    await act(async () => old.resolve(ok({ slots: [slot('10:00')] })));
    expect(screen.queryByRole('button', { name: '10:00' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '12:00' })).toBeInTheDocument();
  });

  it('cambiar el teléfono cancela una identificación pendiente', async () => {
    const old = deferred<ReturnType<typeof ok>>();
    state.invoke.mockReturnValue(old.promise);
    render(<DatosClienteStep organizationId="org-a" onSubmit={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: 'Teléfono para buscar tus datos' });
    fireEvent.change(input, { target: { value: '1123456789' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar mis datos' }));
    fireEvent.change(input, { target: { value: '1198765432' } });
    await act(async () => old.resolve(ok({ found: true, cliente: { nombre: 'Otra persona', apellido: 'Anterior', telefono: 'old-phone' } })));
    expect(screen.queryByText(/Otra persona/)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Teléfono para buscar tus datos' })).toHaveValue('1198765432');
    expect(state.invoke.mock.calls[0][1].signal.aborted).toBe(true);
  });
});

describe('gestión de un turno existente', () => {
  it('reprogramar mantiene el profesional y no ofrece acciones sin implementación', async () => {
    state.invoke.mockResolvedValue(ok({ slots: [] }));
    render(<RescheduleFlow turno={turno} telefono="+5491123456789" onDone={vi.fn()} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    await screen.findByText('No hay turnos disponibles');
    expect(screen.queryByRole('button', { name: 'Elegir otro barbero' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cualquiera disponible/ })).not.toBeInTheDocument();
    expect(state.invoke.mock.calls[0][1].body).toMatchObject({ organization_id: 'org-a', sucursal_id: 'branch-a', barbero_id: 'barber-a', exclude_turno_id: 'turno-a' });
    expect(screen.queryByRole('button', { name: 'Confirmar reprogramación' })).not.toBeInTheDocument();
  });

  it('un conflicto HTTP al reprogramar vuelve a consultar horarios y no repite la escritura', async () => {
    state.invoke.mockImplementation(async name => name === 'reschedule-turno' ? failure('slot_taken', 409) : ok({ slots: [slot()] }));
    render(<RescheduleFlow turno={turno} telefono="+5491123456789" onDone={vi.fn()} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    fireEvent.click(await screen.findByRole('button', { name: '11:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reprogramación' }));
    await screen.findByRole('button', { name: '11:00' });
    expect(state.invoke.mock.calls.filter(([name]) => name === 'reschedule-turno')).toHaveLength(1);
    expect(state.invoke.mock.calls.filter(([name]) => name === 'get-availability')).toHaveLength(2);
  });

  it('una cancelación fallida mantiene el diálogo y el motivo para reintentar', async () => {
    state.invoke.mockResolvedValue(failure('time_limit', 400));
    const cancelled = vi.fn(); const close = vi.fn();
    render(<CancelTurnoDialog turno={turno} telefono="+5491123456789" open onOpenChange={close} onCancelled={cancelled} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Motivo de cancelación (opcional)' }), { target: { value: 'Cambio de planes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar turno' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Cambio de planes');
    expect(cancelled).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
    expect(state.invoke).toHaveBeenCalledTimes(1);
  });

  it('bloquea envíos duplicados mientras la cancelación está pendiente', async () => {
    const pending = deferred<ReturnType<typeof ok>>();
    state.invoke.mockReturnValue(pending.promise);
    const cancelled = vi.fn();
    render(<CancelTurnoDialog turno={turno} telefono="test-phone" open onOpenChange={vi.fn()} onCancelled={cancelled} />);
    const button = screen.getByRole('button', { name: 'Sí, cancelar turno' });
    fireEvent.click(button); fireEvent.click(button);
    expect(state.invoke).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(ok({ success: true })));
    expect(cancelled).toHaveBeenCalledTimes(1);
  });
});
