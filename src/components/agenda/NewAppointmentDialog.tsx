import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DrawerForm } from '@/components/ui/drawer-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Barber } from '@/types/barbershop';
import { Servicio } from './hooks/useAgendaData';
import { timeToMinutes, minutesToTime } from './lib/timeUtils';
import { format } from 'date-fns';
import { UserPlus, Zap, ArrowLeft } from 'lucide-react';
import { useClienteSearch, clienteFullName } from './hooks/useClienteSearch';
import { ClienteSearchPicker } from './ClienteSearchPicker';
import { ClienteFormFields } from './ClienteFormFields';
import { EmptySelectHint } from './EmptySelectHint';
import { clienteModeFieldsSchema, validateClienteMode } from './clienteModeSchema';
import { TurnoConflictDialog } from './TurnoConflictDialog';
import type { ConflictTurno } from './lib/updateTurnoInternal';

interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  sucursalId: string;
  sucursalTimezone: string;
  barbers: Barber[];
  servicios: Servicio[];
  defaultDate: Date;
  defaultBarberId?: string;
  defaultHoraInicio?: string;
  onCreated: () => void;
}

const newAppointmentSchema = z
  .object({
    mode: z.enum(['existing', 'new', 'quick']),
    ...clienteModeFieldsSchema.shape,
    barberoId: z.string().min(1, 'Selecciona un barbero'),
    servicioId: z.string().min(1, 'Selecciona un servicio'),
    fecha: z.string().min(1, 'Selecciona una fecha'),
    horaInicio: z.string().min(1, 'Selecciona una hora'),
    notas: z.string().max(1500).optional().default(''),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'existing' || data.mode === 'new') {
      validateClienteMode(data.mode, data, ctx);
    }
  });

type NewAppointmentFormValues = z.infer<typeof newAppointmentSchema>;

export function NewAppointmentDialog({
  open, onOpenChange, organizationId, sucursalId, sucursalTimezone, barbers, servicios,
  defaultDate, defaultBarberId, defaultHoraInicio, onCreated,
}: NewAppointmentDialogProps) {
  const activeBarbers = barbers.filter((b) => b.active);
  const clienteSearch = useClienteSearch({ organizationId, sucursalId, enabled: open });

  const defaultValues = (): NewAppointmentFormValues => ({
    mode: 'existing',
    clienteId: '',
    nombre: '',
    apellido: '',
    telefono: null,
    email: '',
    barberoId: defaultBarberId || '',
    servicioId: '',
    fecha: format(defaultDate, 'yyyy-MM-dd'),
    horaInicio: defaultHoraInicio || '10:00',
    notas: '',
  });

  const form = useForm<NewAppointmentFormValues>({
    resolver: zodResolver(newAppointmentSchema),
    defaultValues: defaultValues(),
  });

  const mode = form.watch('mode');

  // Resync con los defaults actuales de la agenda en cada apertura (mismo patrón que
  // corrigió el bug de fecha congelada en DayOffDialog/UnavailableSlotDialog).
  useEffect(() => {
    if (open) {
      clienteSearch.reset();
      form.reset(defaultValues());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultBarberId, defaultHoraInicio, defaultDate]);

  const handleSwitchToNew = () => {
    form.setValue('mode', 'new');
    clienteSearch.setSelectedCliente(null);
    form.setValue('clienteId', '');
  };

  const handleSwitchToQuick = () => {
    form.setValue('mode', 'quick');
    clienteSearch.setSelectedCliente(null);
    form.setValue('clienteId', '');
    form.setValue('nombre', '');
    form.setValue('apellido', '');
    form.setValue('telefono', null);
    form.setValue('email', '');
  };

  const handleBackFromQuick = () => form.setValue('mode', 'existing');

  const handleBackFromNew = () => {
    form.setValue('mode', 'existing');
    form.setValue('nombre', '');
    form.setValue('apellido', '');
    form.setValue('telefono', null);
    form.setValue('email', '');
  };

  const ensureRelacion = clienteSearch.ensureRelacion;

  const onSubmit = async (values: NewAppointmentFormValues) => {
    const servicio = servicios.find((s) => s.id === values.servicioId);
    if (!servicio) return;

    try {
      let clienteId: string | null = null;
      let snapNombre = '';
      let snapTelefono: string | null = null;
      let snapEmail: string | null = null;

      if (values.mode === 'existing' && clienteSearch.selectedCliente) {
        const selectedCliente = clienteSearch.selectedCliente;
        clienteId = selectedCliente.id;
        snapNombre = clienteFullName(selectedCliente).slice(0, 80);
        snapTelefono = selectedCliente.telefono || null;
        snapEmail = selectedCliente.email || null;
        if (!selectedCliente.inSucursal) {
          await ensureRelacion(selectedCliente.id);
        }
      } else if (values.mode === 'new') {
        const telefonoCanonical = values.telefono?.e164 ?? null;
        const { data: rpcData, error: rpcErr } = await supabase.rpc('create_cliente_with_sucursal', {
          _nombre: values.nombre.trim(),
          _apellido: values.apellido.trim(),
          _sucursal_id: sucursalId,
          _telefono: telefonoCanonical,
          _email: values.email.trim() || null,
          _instagram: null,
          _tiktok: null,
          _otra_red_social: null,
          _fecha_nacimiento: null,
          _alergias: null,
          _acepta_marketing: true,
        } as any);
        if (rpcErr) throw rpcErr;
        clienteId = (rpcData as string) || null;
        snapNombre = `${values.nombre.trim()} ${values.apellido.trim()}`.slice(0, 80);
        snapTelefono = telefonoCanonical;
        snapEmail = values.email.trim() || null;
      } else {
        clienteId = null;
        snapNombre = 'Cita rápida';
        snapTelefono = null;
        snapEmail = null;
      }

      const horaFin = minutesToTime(timeToMinutes(values.horaInicio) + servicio.duracion_min);
      const { error: turnoErr } = await supabase.from('turnos').insert({
        organization_id: organizationId,
        sucursal_id: sucursalId,
        barbero_id: values.barberoId,
        servicio_id: values.servicioId,
        cliente_id: clienteId,
        cliente_nombre: snapNombre,
        cliente_telefono: snapTelefono ? snapTelefono.slice(0, 80) : null,
        cliente_email: snapEmail ? snapEmail.slice(0, 120) : null,
        fecha: values.fecha,
        hora_inicio: values.horaInicio,
        hora_fin: horaFin,
        timezone: sucursalTimezone || 'America/Argentina/Buenos_Aires',
        estado: 'pendiente',
        notas: values.notas?.trim().slice(0, 1500) || null,
        eligio_barbero: true,
      });
      if (turnoErr) throw turnoErr;

      toast.success('Turno creado');
      clienteSearch.reset();
      form.reset(defaultValues());
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      console.error('Crear turno error:', e);
      // El insert directo no tiene pre-chequeo de choque de horario (a diferencia de
      // update-turno-internal, que sí lo hace); el exclusion constraint de Postgres
      // es la única red de seguridad. Se traduce a un mensaje claro antes de que el
      // texto crudo del constraint llegue al usuario.
      const isOverlapConstraint = e?.code === '23P01' || (typeof e?.message === 'string' && e.message.includes('no_overlap_turnos'));
      if (isOverlapConstraint) {
        toast.error('Ese horario ya está ocupado. Elegí otro horario o profesional.');
      } else {
        toast.error(e?.message || 'Error al crear el turno');
      }
    }
  };

  const renderClienteBlock = () => {
    if (mode === 'existing') {
      return (
        <ClienteSearchPicker
          selectedCliente={clienteSearch.selectedCliente}
          onSelect={(c) => {
            clienteSearch.setSelectedCliente(c);
            form.setValue('clienteId', c?.id ?? '', { shouldValidate: true });
          }}
          searchOpen={clienteSearch.searchOpen}
          onSearchOpenChange={clienteSearch.setSearchOpen}
          query={clienteSearch.query}
          onQueryChange={clienteSearch.setQuery}
          results={clienteSearch.results}
          searching={clienteSearch.searching}
        />
      );
    }

    if (mode === 'quick') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Cita rápida sin cliente</Label>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleBackFromQuick}>
              <ArrowLeft className="h-3 w-3 mr-1" /> Volver
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Se crea con nombre "Cita rápida", sin telefono/email y sin alta en CRM.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Datos del nuevo cliente</Label>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleBackFromNew}>
            <ArrowLeft className="h-3 w-3 mr-1" /> Volver
          </Button>
        </div>
        <ClienteFormFields
          control={form.control}
          nombreName="nombre"
          apellidoName="apellido"
          telefonoName="telefono"
          emailName="email"
        />
      </div>
    );
  };

  return (
    <DrawerForm
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva cita"
      size="md"
      isDirty={form.formState.isDirty}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="new-appointment-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando...' : 'Crear cita'}
          </Button>
        </div>
      }
    >
      <Form {...form}>
        <form id="new-appointment-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {renderClienteBlock()}

          {mode === 'existing' && (
            <div className="flex flex-wrap gap-2 -mt-1">
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={handleSwitchToNew}>
                <UserPlus className="h-3.5 w-3.5 mr-1" /> Nuevo cliente
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={handleSwitchToQuick}>
                <Zap className="h-3.5 w-3.5 mr-1" /> Cita rápida sin cliente
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {activeBarbers.length === 0 ? (
              <EmptySelectHint
                message="No hay barberos activos."
                ctaLabel="Añadir miembro del equipo"
                onCta={() => toast.message('Abrí Mi Negocio y entrá en Equipo para añadir o activar barberos.')}
              />
            ) : (
              <FormField
                control={form.control}
                name="barberoId"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Barbero</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Elegir" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeBarbers.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.firstName} {b.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {servicios.length === 0 ? (
              <EmptySelectHint
                message="No hay servicios cargados."
                ctaLabel="Configurar servicios"
                onCta={() => toast.message('Abrí Mi Negocio y entrá en Servicios para cargar al menos uno.')}
              />
            ) : (
              <FormField
                control={form.control}
                name="servicioId"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Servicio</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Elegir" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {servicios.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.nombre} · {s.duracion_min}min</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="fecha"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">Fecha</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="horaInicio"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">Hora inicio</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="notas"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-xs">Notas (opcional)</FormLabel>
                <FormControl>
                  <Textarea {...field} maxLength={1500} rows={2} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </DrawerForm>
  );
}
