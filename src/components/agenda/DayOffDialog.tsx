import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DrawerForm } from '@/components/ui/drawer-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DayOffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  sucursalId: string;
  defaultDate: Date;
  onCreated: () => void;
}

const dayOffSchema = z
  .object({
    fechaInicio: z.string().min(1, 'Elegí una fecha'),
    fechaFin: z.string().min(1, 'Elegí una fecha'),
    motivo: z.string().max(240).optional().default(''),
  })
  .refine((data) => data.fechaFin >= data.fechaInicio, {
    message: 'La fecha fin no puede ser anterior a la fecha inicio',
    path: ['fechaFin'],
  });

type DayOffFormValues = z.infer<typeof dayOffSchema>;

export function DayOffDialog({ open, onOpenChange, organizationId, sucursalId, defaultDate, onCreated }: DayOffDialogProps) {
  const form = useForm<DayOffFormValues>({
    resolver: zodResolver(dayOffSchema),
    defaultValues: {
      fechaInicio: format(defaultDate, 'yyyy-MM-dd'),
      fechaFin: format(defaultDate, 'yyyy-MM-dd'),
      motivo: '',
    },
  });

  // Resync con la fecha actual de la agenda en cada apertura (antes se congelaba en el primer render).
  useEffect(() => {
    if (open) {
      form.reset({
        fechaInicio: format(defaultDate, 'yyyy-MM-dd'),
        fechaFin: format(defaultDate, 'yyyy-MM-dd'),
        motivo: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate]);

  const onSubmit = async (values: DayOffFormValues) => {
    const { error } = await supabase.from('bloqueos_agenda').insert({
      organization_id: organizationId,
      sucursal_id: sucursalId,
      barbero_id: null,
      fecha_inicio: values.fechaInicio,
      fecha_fin: values.fechaFin,
      todo_el_dia: true,
      motivo: values.motivo?.trim().slice(0, 240) || null,
    });
    if (error) {
      toast.error('Error al crear el día off');
      return;
    }
    toast.success('Día off registrado. Las reservas online estarán bloqueadas.');
    onOpenChange(false);
    onCreated();
  };

  return (
    <DrawerForm
      open={open}
      onOpenChange={onOpenChange}
      title="Día off de la sucursal"
      size="sm"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="dayoff-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando…' : 'Cerrar día'}
          </Button>
        </div>
      }
    >
      <p className="text-xs text-muted-foreground mb-4">
        Cierra la sucursal completa para una fecha o rango. Impide reservas online y operación interna ese día.
      </p>
      <Form {...form}>
        <form id="dayoff-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="fechaInicio"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">Desde</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fechaFin"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">Hasta</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
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
                  <Textarea {...field} maxLength={240} rows={2} placeholder="Feriado, mantenimiento…" />
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
