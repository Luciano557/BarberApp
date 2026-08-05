import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusPill } from '@/components/ui/StatusPill';
import { Switch } from '@/components/ui/switch';
import { Form, FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form';
import { DrawerForm } from '@/components/ui/drawer-form';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Pencil, Eraser, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DIAS, fmt, type HorarioRow } from './types';

interface PendingRange {
  hora_inicio: string;
  hora_fin: string;
}

function hasOverlap(ranges: { hora_inicio: string; hora_fin: string }[]): boolean {
  const sorted = [...ranges].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].hora_inicio < sorted[i - 1].hora_fin) return true;
  }
  return false;
}

// ============================================================
// Bloque rápido: aplicar horario a múltiples días
// ============================================================
function QuickApplyCard({
  sucursalId,
  organizationId,
  barberoId,
  onApplied,
}: {
  sucursalId: string;
  organizationId: string;
  barberoId: string | null;
  onApplied: () => void;
}) {
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [ranges, setRanges] = useState<PendingRange[]>([]);
  const [draftStart, setDraftStart] = useState('09:00');
  const [draftEnd, setDraftEnd] = useState('13:00');
  const [applying, setApplying] = useState(false);

  const toggleDay = (n: number) => {
    setSelectedDays(prev => prev.includes(n) ? prev.filter(d => d !== n) : [...prev, n].sort());
  };

  const addRange = () => {
    if (draftStart >= draftEnd) {
      toast.error('La hora fin debe ser mayor que la de inicio');
      return;
    }
    if (ranges.some(r => r.hora_inicio === draftStart && r.hora_fin === draftEnd)) {
      toast.error('Ese rango ya está agregado');
      return;
    }
    const next = [...ranges, { hora_inicio: draftStart, hora_fin: draftEnd }];
    if (hasOverlap(next)) {
      toast.error('El rango se superpone con otro');
      return;
    }
    setRanges(next.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)));
  };

  const removeRange = (i: number) => setRanges(prev => prev.filter((_, idx) => idx !== i));

  const apply = async () => {
    if (selectedDays.length === 0) { toast.error('Seleccioná al menos un día'); return; }
    if (ranges.length === 0) { toast.error('Agregá al menos un rango horario'); return; }

    setApplying(true);
    // Reemplazar: borrar existentes en los días seleccionados
    let del = supabase.from('horarios_trabajo').delete()
      .eq('sucursal_id', sucursalId)
      .in('dia_semana', selectedDays);
    del = barberoId ? del.eq('barbero_id', barberoId) : del.is('barbero_id', null);
    const { error: delErr } = await del;
    if (delErr) { toast.error('Error al reemplazar horarios'); setApplying(false); return; }

    const inserts: any[] = [];
    for (const dia of selectedDays) {
      for (const r of ranges) {
        const row: any = {
          sucursal_id: sucursalId,
          organization_id: organizationId,
          dia_semana: dia,
          hora_inicio: r.hora_inicio,
          hora_fin: r.hora_fin,
          activo: true,
        };
        if (barberoId) row.barbero_id = barberoId;
        inserts.push(row);
      }
    }
    const { error: insErr } = await supabase.from('horarios_trabajo').insert(inserts);
    setApplying(false);
    if (insErr) { toast.error('Error al aplicar horarios'); return; }

    toast.success(`Aplicado a ${selectedDays.length} día${selectedDays.length > 1 ? 's' : ''}`);
    setSelectedDays([]);
    setRanges([]);
    onApplied();
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Aplicar horario a días</CardTitle>
        <p className="text-xs text-muted-foreground">
          Seleccioná los días, agregá uno o más rangos y aplicalos. Reemplaza los horarios anteriores de esos días.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Day chips */}
        <div className="flex flex-wrap gap-2">
          {DIAS.map(d => {
            const selected = selectedDays.includes(d.num);
            return (
              <button
                key={d.num}
                type="button"
                onClick={() => toggleDay(d.num)}
                title={d.full}
                className={cn(
                  'h-10 min-w-10 px-3 rounded-full text-xs font-medium transition-colors',
                  'border flex items-center justify-center',
                  selected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground border-border hover:bg-muted',
                )}
              >
                {d.label}
              </button>
            );
          })}
        </div>

        {/* Range builder */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Desde</label>
            <Input type="time" value={draftStart} onChange={e => setDraftStart(e.target.value)} className="w-28 h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Hasta</label>
            <Input type="time" value={draftEnd} onChange={e => setDraftEnd(e.target.value)} className="w-28 h-9 text-sm" />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addRange} className="h-9">
            <Plus className="h-4 w-4 mr-1" /> Agregar rango
          </Button>
        </div>

        {/* Pending ranges */}
        {ranges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {ranges.map((r, i) => (
              <Badge key={i} variant="secondary" className="h-7 px-2 gap-1.5 text-xs">
                {fmt(r.hora_inicio)}–{fmt(r.hora_fin)}
                <button type="button" onClick={() => removeRange(i)} className="hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            onClick={apply}
            disabled={applying || selectedDays.length === 0 || ranges.length === 0}
          >
            <Check className="h-4 w-4 mr-1" /> Aplicar a días seleccionados
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Edit Sheet: edición individual por día
// ============================================================
const dayRangeSchema = z.object({
  dbId: z.string().optional(),
  hora_inicio: z.string().min(1, 'Obligatorio.'),
  hora_fin: z.string().min(1, 'Obligatorio.'),
  activo: z.boolean(),
});

const dayFormSchema = z.object({
  ranges: z.array(dayRangeSchema),
}).superRefine((data, ctx) => {
  data.ranges.forEach((r, i) => {
    if (r.hora_inicio >= r.hora_fin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ranges', i, 'hora_fin'],
        message: 'La hora fin debe ser mayor que la de inicio.',
      });
    }
  });
  const byStart = data.ranges
    .map((r, i) => ({ ...r, i }))
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  for (let k = 1; k < byStart.length; k++) {
    if (byStart[k].hora_inicio < byStart[k - 1].hora_fin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ranges', byStart[k].i, 'hora_inicio'],
        message: 'Este rango se superpone con otro.',
      });
    }
  }
});

type DayFormValues = z.infer<typeof dayFormSchema>;

function DayEditSheet({
  open, onOpenChange, dia, dayRanges, sucursalId, organizationId, barberoId, onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dia: typeof DIAS[number] | null;
  dayRanges: HorarioRow[];
  sucursalId: string;
  organizationId: string;
  barberoId: string | null;
  onChanged: () => void;
}) {
  const form = useForm<DayFormValues>({
    resolver: zodResolver(dayFormSchema),
    defaultValues: { ranges: [] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'ranges' });
  const originalRangesRef = useRef<HorarioRow[]>([]);

  useEffect(() => {
    if (!open || !dia) return;
    const sorted = [...dayRanges].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    originalRangesRef.current = sorted;
    form.reset({
      ranges: sorted.map(h => ({ dbId: h.id, hora_inicio: h.hora_inicio, hora_fin: h.hora_fin, activo: h.activo })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dia?.num]);

  const addRange = () => {
    const current = form.getValues('ranges');
    const sorted = [...current].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    const lastEnd = sorted.length > 0 ? sorted[sorted.length - 1].hora_fin : '09:00';
    const startH = parseInt(lastEnd.split(':')[0]);
    const endH = Math.min(23, startH + 4);
    append({ hora_inicio: lastEnd, hora_fin: `${String(endH).padStart(2, '0')}:00`, activo: true });
  };

  const handleCancel = () => onOpenChange(false);

  const onSubmit = async (values: DayFormValues) => {
    if (!dia) return;
    const original = originalRangesRef.current;
    const originalById = new Map(original.map(r => [r.id, r]));
    const currentDbIds = new Set(values.ranges.filter(r => r.dbId).map(r => r.dbId!));
    const toDelete = original.filter(r => !currentDbIds.has(r.id));
    const toInsert = values.ranges.filter(r => !r.dbId);
    const toUpdate = values.ranges.filter(r => {
      if (!r.dbId) return false;
      const orig = originalById.get(r.dbId);
      return !!orig && (orig.hora_inicio !== r.hora_inicio || orig.hora_fin !== r.hora_fin || orig.activo !== r.activo);
    });

    try {
      if (toDelete.length > 0) {
        const { error } = await supabase.from('horarios_trabajo').delete().in('id', toDelete.map(r => r.id));
        if (error) throw error;
      }
      if (toInsert.length > 0) {
        const inserts = toInsert.map(r => {
          const row: any = {
            sucursal_id: sucursalId,
            organization_id: organizationId,
            dia_semana: dia.num,
            hora_inicio: r.hora_inicio,
            hora_fin: r.hora_fin,
            activo: r.activo,
          };
          if (barberoId) row.barbero_id = barberoId;
          return row;
        });
        const { error } = await supabase.from('horarios_trabajo').insert(inserts);
        if (error) throw error;
      }
      for (const r of toUpdate) {
        const { error } = await supabase
          .from('horarios_trabajo')
          .update({ hora_inicio: r.hora_inicio, hora_fin: r.hora_fin, activo: r.activo })
          .eq('id', r.dbId!);
        if (error) throw error;
      }
    } catch (e) {
      toast.error('Error al guardar el horario');
      return;
    }

    toast.success('Horario actualizado');
    onChanged();
    onOpenChange(false);
  };

  return (
    <DrawerForm
      open={open}
      onOpenChange={onOpenChange}
      title={dia ? `Editar ${dia.full}` : 'Editar día'}
      size="md"
      isDirty={form.formState.isDirty}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="ghost" onClick={handleCancel} disabled={form.formState.isSubmitting}>Cancelar</Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      }
    >
      <p className="text-xs text-muted-foreground mb-4">Agregá, ajustá o quitá rangos horarios de este día.</p>
      <Form {...form}>
        <div className="space-y-3">
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Este día no tiene horarios.</p>
          )}
          {fields.map((field, index) => {
            const isActive = form.watch(`ranges.${index}.activo`);
            return (
              <div key={field.id} className="flex items-start gap-2 border rounded-lg p-2">
                <FormField
                  control={form.control}
                  name={`ranges.${index}.activo`}
                  render={({ field: f }) => (
                    <FormItem className="mt-1 space-y-0">
                      <FormControl>
                        <Switch checked={f.value} onCheckedChange={f.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex-1 flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name={`ranges.${index}.hora_inicio`}
                    render={({ field: f }) => (
                      <FormItem className="flex-1 space-y-0">
                        <FormControl>
                          <Input type="time" {...f} className="h-8 text-sm" disabled={!isActive} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <span className="text-xs text-muted-foreground">a</span>
                  <FormField
                    control={form.control}
                    name={`ranges.${index}.hora_fin`}
                    render={({ field: f }) => (
                      <FormItem className="flex-1 space-y-0">
                        <FormControl>
                          <Input type="time" {...f} className="h-8 text-sm" disabled={!isActive} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
          <Button type="button" variant="outline" size="sm" onClick={addRange} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Agregar rango
          </Button>
        </div>
      </Form>
    </DrawerForm>
  );
}

// ============================================================
// Day summary cards
// ============================================================
function DayCardsGrid({
  horarios, sucursalId, organizationId, barberoId, onRefresh,
}: {
  horarios: HorarioRow[];
  sucursalId: string;
  organizationId: string;
  barberoId: string | null;
  onRefresh: () => void;
}) {
  const [editDia, setEditDia] = useState<typeof DIAS[number] | null>(null);
  const [clearDia, setClearDia] = useState<typeof DIAS[number] | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<number, HorarioRow[]>();
    DIAS.forEach(d => m.set(d.num, []));
    for (const h of horarios) {
      m.get(h.dia_semana)?.push(h);
    }
    return m;
  }, [horarios]);

  const confirmClear = async () => {
    if (!clearDia) return;
    let q = supabase.from('horarios_trabajo').delete()
      .eq('sucursal_id', sucursalId)
      .eq('dia_semana', clearDia.num);
    q = barberoId ? q.eq('barbero_id', barberoId) : q.is('barbero_id', null);
    const { error } = await q;
    if (error) { toast.error('Error al limpiar día'); return; }
    toast.success(`${clearDia.full} sin horario`);
    setClearDia(null);
    onRefresh();
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DIAS.map(d => {
          const ranges = (byDay.get(d.num) || []).slice().sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
          const open = ranges.some(r => r.activo);
          return (
            <div key={d.num} className="border rounded-lg p-3 bg-card flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{d.full}</span>
                {ranges.length === 0 ? (
                  <StatusPill status="neutral" label="Sin horario" />
                ) : open ? (
                  <StatusPill status="success" label="Abierto" />
                ) : (
                  <StatusPill status="warning" label="Pausado" />
                )}
              </div>
              <div className="min-h-[40px] space-y-0.5">
                {ranges.length === 0 && (
                  <p className="text-xs text-muted-foreground">No configurado</p>
                )}
                {ranges.map(r => (
                  <p key={r.id} className={cn('text-xs tabular-nums', !r.activo && 'text-muted-foreground line-through')}>
                    {fmt(r.hora_inicio)}–{fmt(r.hora_fin)}
                  </p>
                ))}
              </div>
              <div className="flex items-center gap-1 pt-1 border-t">
                <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => setEditDia(d)}>
                  <Pencil className="h-3 w-3 mr-1" /> Editar
                </Button>
                {ranges.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive"
                    onClick={() => setClearDia(d)}
                  >
                    <Eraser className="h-3 w-3 mr-1" /> Limpiar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DayEditSheet
        open={!!editDia}
        onOpenChange={v => { if (!v) setEditDia(null); }}
        dia={editDia}
        dayRanges={editDia ? (byDay.get(editDia.num) || []) : []}
        sucursalId={sucursalId}
        organizationId={organizationId}
        barberoId={barberoId}
        onChanged={onRefresh}
      />

      <AlertDialog open={!!clearDia} onOpenChange={v => { if (!v) setClearDia(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpiar {clearDia?.full}</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitarán todos los rangos de este día. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClear}>Limpiar día</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================
// Editor combinado
// ============================================================
export function ScheduleEditor({
  horarios, sucursalId, organizationId, barberoId, onRefresh,
}: {
  horarios: HorarioRow[];
  sucursalId: string;
  organizationId: string;
  barberoId: string | null;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <QuickApplyCard
        sucursalId={sucursalId}
        organizationId={organizationId}
        barberoId={barberoId}
        onApplied={onRefresh}
      />
      <DayCardsGrid
        horarios={horarios}
        sucursalId={sucursalId}
        organizationId={organizationId}
        barberoId={barberoId}
        onRefresh={onRefresh}
      />
    </div>
  );
}
