import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DrawerForm } from '@/components/ui/drawer-form';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';
import { EditableSectionHeader } from '@/components/ui/EditableSectionHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { TURNO_ESTADO_PILL } from '@/lib/turnoEstadoPill';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Phone, Mail, Calendar, User, Scissors, X, UserPlus, Clock, CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Barber } from '@/types/barbershop';
import { Turno, Servicio } from './hooks/useAgendaData';
import { formatHHMM } from './lib/timeUtils';
import { callUpdateTurnoInternal, type ConflictTurno } from './lib/updateTurnoInternal';
import { TurnoConflictDialog, type TurnoConflictKind } from './TurnoConflictDialog';
import { useClienteSearch, clienteFullName } from './hooks/useClienteSearch';
import { ClienteSearchPicker } from './ClienteSearchPicker';
import { ClienteFormFields } from './ClienteFormFields';
import { EmptySelectHint } from './EmptySelectHint';
import { clienteModeFieldsSchema, validateClienteMode } from './clienteModeSchema';

interface AppointmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turno: Turno | null;
  organizationId: string;
  sucursalId: string;
  barbers: Barber[];
  servicios: Servicio[];
  onChanged: () => void;
  readOnly?: boolean;
}

const clienteEditSchema = z
  .object({
    mode: z.enum(['existing', 'new']),
    ...clienteModeFieldsSchema.shape,
  })
  .superRefine((data, ctx) => validateClienteMode(data.mode, data, ctx));

type ClienteEditFormValues = z.infer<typeof clienteEditSchema>;

const turnoEditSchema = z.object({
  servicioId: z.string().min(1, 'Elegí un servicio'),
  barberoId: z.string().min(1, 'Elegí un profesional'),
  fecha: z.custom<Date | null>((v) => v instanceof Date, { message: 'Elegí una fecha' }),
  hora: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Ingresá una hora válida (HH:MM)'),
});

type TurnoEditFormValues = z.infer<typeof turnoEditSchema>;

export function AppointmentDetailDialog({
  open,
  onOpenChange,
  turno,
  organizationId,
  sucursalId,
  barbers,
  servicios,
  onChanged,
  readOnly = false,
}: AppointmentDetailDialogProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [editingCliente, setEditingCliente] = useState(false);
  const [savingCliente, setSavingCliente] = useState(false);
  const clienteSearchForCliente = useClienteSearch({ organizationId, sucursalId, enabled: editingCliente });

  const clienteForm = useForm<ClienteEditFormValues>({
    resolver: zodResolver(clienteEditSchema),
    defaultValues: { mode: 'existing', clienteId: '', nombre: '', apellido: '', telefono: null, email: '' },
  });
  const clienteMode = clienteForm.watch('mode');

  const [editingTurno, setEditingTurno] = useState(false);
  const [savingTurno, setSavingTurno] = useState(false);
  const [fechaOpen, setFechaOpen] = useState(false);
  const [turnoConflict, setTurnoConflict] = useState<{
    kind: TurnoConflictKind;
    conflicts?: ConflictTurno[];
  } | null>(null);

  const turnoForm = useForm<TurnoEditFormValues>({
    resolver: zodResolver(turnoEditSchema),
    defaultValues: { servicioId: '', barberoId: '', fecha: null, hora: '' },
  });

  const resetClienteEditor = () => {
    clienteSearchForCliente.reset();
    clienteForm.reset({ mode: 'existing', clienteId: '', nombre: '', apellido: '', telefono: null, email: '' });
  };

  useEffect(() => {
    if (!open) {
      setEditingCliente(false);
      resetClienteEditor();
      setConfirmingCancel(false);
      setMotivo('');
      setEditingTurno(false);
      setTurnoConflict(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!turno) return null;
  const barber = barbers.find((b) => b.id === turno.barbero_id);
  const servicio = servicios.find((s) => s.id === turno.servicio_id);
  const estadoPill = TURNO_ESTADO_PILL[turno.estado] ?? { label: turno.estado, status: 'neutral' as const };
  const canCancel = !readOnly && ['pendiente', 'confirmado'].includes(turno.estado);
  const canEditCliente = !readOnly && ['pendiente', 'confirmado', 'en_curso'].includes(turno.estado);
  const canEditTurno = !readOnly && ['pendiente', 'confirmado', 'en_curso'].includes(turno.estado);
  const activeBarbersForEdit = barbers.filter((b) => b.active);

  const startEditTurno = () => {
    let fecha: Date;
    try {
      fecha = parseISO(turno.fecha);
    } catch {
      fecha = new Date();
    }
    turnoForm.reset({
      servicioId: turno.servicio_id,
      barberoId: turno.barbero_id,
      fecha,
      hora: turno.hora_inicio.slice(0, 5),
    });
    setEditingTurno(true);
  };

  const runUpdateTurno = async (
    values: TurnoEditFormValues,
    opts: { confirmOverlap?: boolean; confirmFueraHorario?: boolean } = {},
  ) => {
    if (!values.fecha) return;
    setSavingTurno(true);
    const res = await callUpdateTurnoInternal({
      turno_id: turno.id,
      servicio_id: values.servicioId || undefined,
      barbero_id: values.barberoId || undefined,
      fecha: format(values.fecha, 'yyyy-MM-dd'),
      hora_inicio: values.hora,
      confirm_overlap: opts.confirmOverlap,
      confirm_fuera_horario: opts.confirmFueraHorario,
    });
    setSavingTurno(false);

    if (res.ok) {
      toast.success('Turno actualizado');
      setEditingTurno(false);
      setTurnoConflict(null);
      onChanged();
      return;
    }
    const fail = res as Extract<typeof res, { ok: false }>;
    if (fail.status === 409 && fail.error === 'choque_de_horario') {
      setTurnoConflict({ kind: 'choque_de_horario', conflicts: fail.conflicts });
      return;
    }
    if (fail.status === 409 && fail.error === 'fuera_de_horario') {
      setTurnoConflict({ kind: 'fuera_de_horario' });
      return;
    }
    if (fail.error === 'slot_en_pasado') {
      toast.error('No podés guardar el turno en un horario en el pasado');
      return;
    }
    if (fail.error === 'turno_cerrado') {
      toast.error('Este turno ya no se puede modificar');
      return;
    }
    if (fail.error === 'slot_bloqueado') {
      toast.error('Ese horario está bloqueado en la agenda');
      return;
    }
    if (fail.error === 'forbidden') {
      toast.error('No tenés permiso para editar este turno');
      return;
    }
    if (fail.error === 'barbero_no_disponible_en_sucursal') {
      toast.error('El barbero elegido no está disponible en esta sucursal');
      return;
    }
    toast.error(fail.message || 'No se pudo guardar el turno');
  };

  const handleSaveTurno = () => {
    void turnoForm.handleSubmit((values) => runUpdateTurno(values))();
  };

  const handleConfirmConflict = () => {
    if (!turnoConflict) return;
    const values = turnoForm.getValues();
    if (turnoConflict.kind === 'choque_de_horario') runUpdateTurno(values, { confirmOverlap: true });
    else runUpdateTurno(values, { confirmFueraHorario: true });
  };

  const handleCancel = async () => {
    setCancelling(true);
    const { error } = await supabase
      .from('turnos')
      .update({
        estado: 'cancelado',
        cancelado_at: new Date().toISOString(),
        cancelado_motivo: motivo.trim().slice(0, 240) || null,
      })
      .eq('id', turno.id);
    setCancelling(false);
    if (error) {
      toast.error('Error al cancelar');
      return;
    }
    toast.success('Turno cancelado');
    setConfirmingCancel(false);
    setMotivo('');
    onOpenChange(false);
    onChanged();
  };

  const onSubmitCliente = async (values: ClienteEditFormValues) => {
    setSavingCliente(true);
    try {
      let clienteId: string | null = null;
      let clienteNombre = '';
      let clienteTelefono: string | null = null;
      let clienteEmail: string | null = null;

      if (values.mode === 'existing') {
        const selectedCliente = clienteSearchForCliente.selectedCliente;
        if (!selectedCliente) {
          toast.error('Selecciona un cliente');
          setSavingCliente(false);
          return;
        }
        clienteId = selectedCliente.id;
        clienteNombre = clienteFullName(selectedCliente).slice(0, 80);
        clienteTelefono = selectedCliente.telefono ? selectedCliente.telefono.slice(0, 80) : null;
        clienteEmail = selectedCliente.email ? selectedCliente.email.slice(0, 120) : null;
        if (!selectedCliente.inSucursal) {
          await clienteSearchForCliente.ensureRelacion(selectedCliente.id);
        }
      } else {
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
        clienteNombre = `${values.nombre.trim()} ${values.apellido.trim()}`.slice(0, 80);
        clienteTelefono = telefonoCanonical ? telefonoCanonical.slice(0, 80) : null;
        clienteEmail = values.email.trim() ? values.email.trim().slice(0, 120) : null;
      }

      const { error } = await supabase.from('turnos').update({
        cliente_id: clienteId,
        cliente_nombre: clienteNombre,
        cliente_telefono: clienteTelefono,
        cliente_email: clienteEmail,
      }).eq('id', turno.id);

      if (error) throw error;

      toast.success('Cliente asociado al turno');
      setEditingCliente(false);
      resetClienteEditor();
      onChanged();
    } catch (e: any) {
      console.error('Asociar cliente turno error:', e);
      toast.error(e?.message || 'No se pudo actualizar el cliente del turno');
    } finally {
      setSavingCliente(false);
    }
  };

  const handleSaveCliente = () => {
    void clienteForm.handleSubmit(onSubmitCliente)();
  };

  const titleContent = (
    <div className="flex items-center gap-3 min-w-0">
      <InitialsAvatar name={turno.cliente_nombre || 'Sin nombre'} />
      <span className="flex-1 min-w-0 truncate">{turno.cliente_nombre || 'Sin nombre'}</span>
      <StatusPill status={estadoPill.status} label={estadoPill.label} size="sm" />
    </div>
  );

  return (
    <>
      <DrawerForm
        open={open}
        onOpenChange={onOpenChange}
        title={titleContent}
        size="md"
        footer={
          confirmingCancel ? (
            <div className="flex w-full justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmingCancel(false)} disabled={cancelling}>Volver</Button>
              <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? 'Cancelando...' : 'Si, cancelar'}
              </Button>
            </div>
          ) : (
            canCancel && !editingTurno && !editingCliente && (
              <div className="flex w-full justify-end">
                <Button variant="destructive" onClick={() => setConfirmingCancel(true)}>
                  <X className="h-4 w-4" /> Cancelar turno
                </Button>
              </div>
            )
          )
        }
      >
        <div className="space-y-4 text-sm">
          <section>
            {canEditCliente ? (
              <EditableSectionHeader
                title="Datos de contacto"
                isEditing={editingCliente}
                saving={savingCliente}
                disabled={editingTurno || confirmingCancel}
                onEdit={() => setEditingCliente(true)}
                onCancel={() => { setEditingCliente(false); resetClienteEditor(); }}
                onSave={handleSaveCliente}
              />
            ) : (
              <h3 className="text-sm font-medium mb-3">Datos de contacto</h3>
            )}

            {editingCliente && canEditCliente ? (
              <Form {...clienteForm}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={clienteMode === 'existing' ? 'default' : 'outline'}
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        clienteForm.setValue('mode', 'existing');
                        clienteForm.setValue('nombre', '');
                        clienteForm.setValue('apellido', '');
                        clienteForm.setValue('telefono', null);
                        clienteForm.setValue('email', '');
                      }}
                    >
                      Cliente existente
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={clienteMode === 'new' ? 'default' : 'outline'}
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        clienteForm.setValue('mode', 'new');
                        clienteSearchForCliente.setSelectedCliente(null);
                        clienteSearchForCliente.setSearchOpen(false);
                        clienteSearchForCliente.setQuery('');
                        clienteForm.setValue('clienteId', '');
                      }}
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Crear cliente
                    </Button>
                  </div>
                  {clienteMode === 'existing' ? (
                    <ClienteSearchPicker
                      label="Cliente existente"
                      selectedCliente={clienteSearchForCliente.selectedCliente}
                      onSelect={(c) => {
                        clienteSearchForCliente.setSelectedCliente(c);
                        clienteForm.setValue('clienteId', c?.id ?? '', { shouldValidate: true });
                      }}
                      searchOpen={clienteSearchForCliente.searchOpen}
                      onSearchOpenChange={clienteSearchForCliente.setSearchOpen}
                      query={clienteSearchForCliente.query}
                      onQueryChange={clienteSearchForCliente.setQuery}
                      results={clienteSearchForCliente.results}
                      searching={clienteSearchForCliente.searching}
                    />
                  ) : (
                    <ClienteFormFields
                      control={clienteForm.control}
                      nombreName="nombre"
                      apellidoName="apellido"
                      telefonoName="telefono"
                      emailName="email"
                    />
                  )}
                </div>
              </Form>
            ) : (
              <div className="space-y-2 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{turno.cliente_telefono || 'Sin teléfono'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{turno.cliente_email || 'Sin email'}</span>
                </div>
              </div>
            )}
          </section>

          <Separator />

          <section>
            {canEditTurno ? (
              <EditableSectionHeader
                title="Detalle del turno"
                isEditing={editingTurno}
                saving={savingTurno}
                disabled={editingCliente || confirmingCancel}
                onEdit={startEditTurno}
                onCancel={() => { setEditingTurno(false); setTurnoConflict(null); }}
                onSave={handleSaveTurno}
              />
            ) : (
              <h3 className="text-sm font-medium mb-3">Detalle del turno</h3>
            )}

            {editingTurno && canEditTurno ? (
              <Form {...turnoForm}>
                <div className="space-y-3">
                  {servicios.length === 0 ? (
                    <EmptySelectHint
                      message="No hay servicios cargados."
                      ctaLabel="Configurar servicios"
                      onCta={() => toast.message('Abrí Mi Negocio y entrá en Servicios para cargar al menos uno.')}
                    />
                  ) : (
                    <FormField
                      control={turnoForm.control}
                      name="servicioId"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs">Servicio</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Elegir servicio" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {servicios.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.nombre} · {s.duracion_min} min
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {activeBarbersForEdit.length === 0 ? (
                    <EmptySelectHint
                      message="No hay profesionales activos."
                      ctaLabel="Añadir miembro del equipo"
                      onCta={() => toast.message('Abrí Mi Negocio y entrá en Equipo para añadir o activar profesionales.')}
                    />
                  ) : (
                    <FormField
                      control={turnoForm.control}
                      name="barberoId"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs">Profesional</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Elegir profesional" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {activeBarbersForEdit.map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.firstName} {b.lastName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={turnoForm.control}
                      name="fecha"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs">Fecha</FormLabel>
                          <Popover open={fechaOpen} onOpenChange={setFechaOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button type="button" variant="outline" className="w-full justify-start font-normal">
                                  <CalendarIcon className="h-4 w-4 mr-2 opacity-60" />
                                  {field.value ? format(field.value, "dd 'de' MMM yyyy", { locale: es }) : 'Elegir'}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarUI
                                mode="single"
                                selected={field.value ?? undefined}
                                onSelect={(d) => { if (d) { field.onChange(d); setFechaOpen(false); } }}
                                locale={es}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={turnoForm.control}
                      name="hora"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs">Hora</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Clock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none" />
                              <Input type="time" {...field} className="pl-9" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    La duración se recalcula automáticamente según el servicio.
                  </p>
                </div>
              </Form>
            ) : (
              <div className="space-y-2 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{turno.fecha} · {formatHHMM(turno.hora_inicio)} - {formatHHMM(turno.hora_fin)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Scissors className="h-4 w-4" />
                  <span>{servicio?.nombre || 'Servicio'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{barber ? `${barber.firstName} ${barber.lastName}` : '-'}</span>
                </div>
                {turno.notas && (
                  <div className="text-xs border-l-2 border-border pl-3">{turno.notas}</div>
                )}
              </div>
            )}
          </section>

          {confirmingCancel && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs text-muted-foreground">Motivo de cancelacion (opcional)</p>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={240} rows={2} />
            </div>
          )}
        </div>
      </DrawerForm>
      <TurnoConflictDialog
        open={!!turnoConflict}
        onOpenChange={(v) => { if (!v) setTurnoConflict(null); }}
        kind={turnoConflict?.kind || null}
        conflicts={turnoConflict?.conflicts}
        onConfirm={handleConfirmConflict}
        loading={savingTurno}
      />
    </>
  );
}
