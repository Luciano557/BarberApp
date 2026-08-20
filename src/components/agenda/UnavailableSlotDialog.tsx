import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DrawerForm, DrawerFormSection } from '@/components/ui/drawer-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { EmptySelectHint } from './EmptySelectHint';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Barber } from '@/types/barbershop';
import { format } from 'date-fns';
import { Ban, User, Clock } from 'lucide-react';

interface UnavailableSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  sucursalId: string;
  barbers: Barber[];
  defaultDate: Date;
  defaultBarberId?: string;
  onCreated: () => void;
}

const unavailableSlotSchema = z
  .object({
    barberoId: z.string().min(1, 'Seleccioná un barbero'),
    fecha: z.string().min(1, 'Elegí una fecha'),
    horaInicio: z.string().min(1, 'Elegí una hora'),
    horaFin: z.string().min(1, 'Elegí una hora'),
    motivo: z.string().max(240).optional().default(''),
  })
  .refine((data) => data.horaFin > data.horaInicio, {
    message: 'La hora fin debe ser posterior',
    path: ['horaFin'],
  });

type UnavailableSlotFormValues = z.infer<typeof unavailableSlotSchema>;

export function UnavailableSlotDialog({
  open, onOpenChange, organizationId, sucursalId, barbers, defaultDate, defaultBarberId, onCreated,
}: UnavailableSlotDialogProps) {
  const activeBarbers = barbers.filter((b) => b.active);

  const form = useForm<UnavailableSlotFormValues>({
    resolver: zodResolver(unavailableSlotSchema),
    defaultValues: {
      barberoId: defaultBarberId || '',
      fecha: format(defaultDate, 'yyyy-MM-dd'),
      horaInicio: '12:00',
      horaFin: '13:00',
      motivo: '',
    },
  });

  // Resync con la fecha/barbero actuales de la agenda en cada apertura (antes se congelaba en el primer render).
  useEffect(() => {
    if (open) {
      form.reset({
        barberoId: defaultBarberId || '',
        fecha: format(defaultDate, 'yyyy-MM-dd'),
        horaInicio: '12:00',
        horaFin: '13:00',
        motivo: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate, defaultBarberId]);

  const onSubmit = async (values: UnavailableSlotFormValues) => {
    const { error } = await supabase.from('bloqueos_agenda').insert({
      organization_id: organizationId,
      sucursal_id: sucursalId,
      barbero_id: values.barberoId,
      fecha_inicio: values.fecha,
      fecha_fin: values.fecha,
      todo_el_dia: false,
      hora_inicio: values.horaInicio,
      hora_fin: values.horaFin,
      motivo: values.motivo?.trim().slice(0, 240) || null,
    });
    if (error) {
      toast.error('Error al crear el bloqueo');
      return;
    }
    toast.success('Horario no disponible registrado');
    onOpenChange(false);
    onCreated();
  };

  return (
    <DrawerForm
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <Ban className="h-4 w-4 text-muted-foreground" />
          Horario no disponible
        </span>
      }
      size="sm"
      isDirty={form.formState.isDirty}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="unavailable-slot-form" disabled={form.formState.isSubmitting || activeBarbers.length === 0}>
            {form.formState.isSubmitting ? 'Guardando…' : 'Registrar'}
          </Button>
        </div>
      }
    >
      <Form {...form}>
        <form id="unavailable-slot-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <DrawerFormSection
            icon={User}
            title="Quién"
            description="Bloquea una franja horaria para un barbero específico."
          >
            {activeBarbers.length === 0 ? (
              <EmptySelectHint
                message="No hay barberos activos en esta sucursal."
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
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            )}
          </DrawerFormSection>

          <DrawerFormSection icon={Clock} title="Cuándo" description="Franja horaria que se bloquea para este barbero.">
            {/* Fecha a ancho completo, no en la misma fila que las horas: a
                380px fijos (size="sm"), 3 columnas dejan ~103px cada una para
                un input date/time con chrome nativo que no se achica — y
                sm:grid-cols-3 no lo resuelve, porque el drawer queda fijo en
                380px apenas el viewport pasa el breakpoint sm (640px), sea
                mobile en horizontal, tablet o desktop. */}
            <FormField
              control={form.control}
              name="fecha"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">Fecha</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="horaInicio"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Desde</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="horaFin"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Hasta</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="motivo"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">Motivo (opcional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} maxLength={240} rows={2} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </DrawerFormSection>
        </form>
      </Form>
    </DrawerForm>
  );
}
