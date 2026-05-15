import { useState, useEffect } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { X, CalendarIcon, ChevronRight, Users } from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Barber, getBarberDisplayName } from '@/types/barbershop';
import { RepeatPicker, getRepeatLabel } from './RepeatPicker';
import { CustomRepeatSheet, getCustomRepeatLabel } from './CustomRepeatSheet';
import type { TareaInsert, Tarea } from '@/hooks/useTareas';
import { cn } from '@/lib/utils';

interface TareaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barbers: Barber[];
  onSubmit: (tarea: TareaInsert) => void;
  onUpdate?: (id: string, patch: Partial<Tarea> & { id: string }) => void;
  isPending?: boolean;
  tipo: 'tarea' | 'peticion';
  creadorNombre?: string;
  /** Si se pasa, el modal entra en modo edición. */
  tarea?: Tarea | null;
}

const TEAM_VALUE = '__team__';
const TITLE_MAX = 80;
const TITLE_MIN = 3;
const DESC_MAX = 240;

export function TareaFormDialog({
  open,
  onOpenChange,
  barbers,
  onSubmit,
  onUpdate,
  isPending,
  tipo,
  creadorNombre,
  tarea,
}: TareaFormDialogProps) {
  const isEdit = !!tarea;
  const isPeticion = tipo === 'peticion';
  const activeBarbers = barbers.filter(b => b.active);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [asignadoId, setAsignadoId] = useState<string>(TEAM_VALUE);
  const [submitted, setSubmitted] = useState(false);

  // Fecha de inicio (columna real fecha_inicio)
  const [hasDate, setHasDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [dateOpen, setDateOpen] = useState(false);

  // Hora
  const [hasTime, setHasTime] = useState(false);
  const [selectedTime, setSelectedTime] = useState('09:00');

  // Repetición
  const [repeatPreset, setRepeatPreset] = useState('never');
  const [repeatFrequency, setRepeatFrequency] = useState('weekly');
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatByweekday, setRepeatByweekday] = useState<number[]>([]);

  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [showCustomRepeat, setShowCustomRepeat] = useState(false);

  // Vencimiento (solo peticiones, sin cambios en esta fase)
  const [vencimientoDias, setVencimientoDias] = useState(60);

  const resetForm = () => {
    setTitulo('');
    setDescripcion('');
    setAsignadoId(TEAM_VALUE);
    setHasDate(false);
    setSelectedDate(undefined);
    setHasTime(false);
    setSelectedTime('09:00');
    setRepeatPreset('never');
    setRepeatFrequency('weekly');
    setRepeatInterval(1);
    setRepeatByweekday([]);
    setVencimientoDias(60);
    setSubmitted(false);
  };

  // Hidratar al abrir
  useEffect(() => {
    if (!open) return;
    if (tarea) {
      setTitulo(tarea.titulo ?? '');
      setDescripcion(tarea.descripcion ?? '');
      const isTeam = tarea.assignment_scope === 'team' || !tarea.asignado_a_id;
      setAsignadoId(isTeam ? TEAM_VALUE : tarea.asignado_a_id!);
      const fechaSrc = tarea.fecha_inicio ?? tarea.fecha_limite ?? null;
      if (fechaSrc) {
        setHasDate(true);
        try { setSelectedDate(parseISO(fechaSrc)); } catch { setSelectedDate(new Date()); }
      } else {
        setHasDate(false);
        setSelectedDate(undefined);
      }
      if (tarea.hora) {
        setHasTime(true);
        setSelectedTime(tarea.hora);
      } else {
        setHasTime(false);
        setSelectedTime('09:00');
      }
      setRepeatPreset(tarea.repeat_preset ?? (tarea.recurrente ? 'custom' : 'never'));
      setRepeatFrequency(tarea.repeat_frequency ?? 'weekly');
      setRepeatInterval(tarea.repeat_interval ?? 1);
      setRepeatByweekday(tarea.repeat_byweekday ?? []);
      setVencimientoDias(tarea.vencimiento_dias ?? 60);
      setSubmitted(false);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tarea?.id]);

  const trimmedTitle = titulo.trim();
  const trimmedDesc = descripcion.trim();
  const titleError =
    trimmedTitle.length === 0 ? 'El título es obligatorio.'
    : trimmedTitle.length < TITLE_MIN ? `El título debe tener al menos ${TITLE_MIN} caracteres.`
    : trimmedTitle.length > TITLE_MAX ? `El título no puede superar ${TITLE_MAX} caracteres.` : null;
  const descError = trimmedDesc.length > DESC_MAX
    ? `La descripción no puede superar ${DESC_MAX} caracteres.` : null;
  const isValid = !titleError && !descError;

  const handleAsignacionChange = (value: string) => {
    // Si limpia o queda vacío, vuelve a "Todo el equipo"
    setAsignadoId(value && value.length > 0 ? value : TEAM_VALUE);
  };

  const handleConfirm = () => {
    setSubmitted(true);
    if (!isValid) return;

    if (isPeticion) {
      const payload: TareaInsert = {
        tipo: 'peticion',
        titulo: trimmedTitle,
        descripcion: trimmedDesc || undefined,
        creado_por_nombre: creadorNombre,
        vencimiento_dias: vencimientoDias,
      };
      onSubmit(payload);
    } else {
      const isTeam = asignadoId === TEAM_VALUE || !asignadoId;
      const barber = !isTeam ? activeBarbers.find(b => b.id === asignadoId) : undefined;
      const fecha_inicio = hasDate && selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
      const hora = hasTime ? selectedTime : null;
      const repeat_preset = repeatPreset;
      const repeat_frequency = repeatPreset === 'custom' ? repeatFrequency : null;
      const repeat_interval = repeatPreset === 'custom' ? repeatInterval : null;
      const repeat_byweekday = repeatPreset === 'custom' && repeatFrequency === 'weekly' ? repeatByweekday : null;
      const recurrente = repeatPreset !== 'never';

      if (isEdit && tarea && onUpdate) {
        onUpdate(tarea.id, {
          id: tarea.id,
          titulo: trimmedTitle,
          descripcion: trimmedDesc || null,
          asignado_a_id: isTeam ? null : asignadoId,
          asignado_a_nombre: isTeam ? 'Todo el equipo' : (barber ? getBarberDisplayName(barber) : tarea.asignado_a_nombre),
          assignment_scope: isTeam ? 'team' : 'individual',
          fecha_inicio,
          hora,
          repeat_preset,
          repeat_frequency,
          repeat_interval,
          repeat_byweekday,
          recurrente,
        } as Partial<Tarea> & { id: string });
      } else {
        const payload: TareaInsert = {
          tipo: 'tarea',
          titulo: trimmedTitle,
          descripcion: trimmedDesc || undefined,
          asignado_a_id: isTeam ? null : asignadoId,
          asignado_a_nombre: isTeam ? 'Todo el equipo' : (barber ? getBarberDisplayName(barber) : undefined),
          assignment_scope: isTeam ? 'team' : 'individual',
          fecha_inicio: fecha_inicio ?? undefined,
          hora: hora ?? undefined,
          repeat_preset,
          repeat_frequency: repeat_frequency ?? undefined,
          repeat_interval: repeat_interval ?? undefined,
          repeat_byweekday: repeat_byweekday ?? undefined,
          recurrente,
        };
        onSubmit(payload);
      }
    }

    if (!isEdit) resetForm();
    onOpenChange(false);
  };

  const handleRepeatChange = (value: string) => {
    setRepeatPreset(value);
    if (value !== 'never' && !hasDate) {
      setHasDate(true);
      if (!selectedDate) setSelectedDate(new Date());
    }
  };

  const handleDateToggle = (checked: boolean) => {
    setHasDate(checked);
    if (checked && !selectedDate) setSelectedDate(new Date());
    if (!checked) setRepeatPreset('never');
  };

  const repeatLabel = repeatPreset === 'custom'
    ? getCustomRepeatLabel(repeatFrequency, repeatInterval, repeatByweekday)
    : getRepeatLabel(repeatPreset);

  const headerTitle = isPeticion
    ? (isEdit ? 'Editar petición' : 'Nueva petición')
    : (isEdit ? 'Editar tarea' : 'Nueva tarea');
  const headerSubtitle = isPeticion
    ? 'Pedile algo al equipo de gestión y definí en cuántos días debería resolverse.'
    : 'Definí qué hay que hacer, quién lo hace y cuándo arranca.';

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o && !isEdit) resetForm(); onOpenChange(o); }}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <h2 className="text-base font-semibold text-foreground truncate">{headerTitle}</h2>
              <p className="text-xs text-muted-foreground">{headerSubtitle}</p>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 -mt-1" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {isPeticion && creadorNombre && (
              <div className="text-xs text-muted-foreground">
                Creada por <span className="font-medium text-foreground">{creadorNombre}</span>
              </div>
            )}

            {/* Título */}
            <div className="space-y-1.5">
              <Label htmlFor="tarea-titulo" className="text-xs font-medium text-muted-foreground">Título</Label>
              <Input
                id="tarea-titulo"
                placeholder={isPeticion ? 'Ej: Comprar toallas nuevas' : 'Ej: Limpiar herramientas'}
                value={titulo}
                onChange={e => setTitulo(e.target.value.slice(0, TITLE_MAX))}
                maxLength={TITLE_MAX}
                aria-invalid={submitted && !!titleError}
              />
              <div className="flex items-center justify-between min-h-[16px]">
                <span className={cn('text-xs', submitted && titleError ? 'text-destructive' : 'text-muted-foreground')}>
                  {submitted && titleError ? titleError : ''}
                </span>
                <span className="text-xs text-muted-foreground">{trimmedTitle.length}/{TITLE_MAX}</span>
              </div>
            </div>

            {/* Descripción */}
            <div className="space-y-1.5">
              <Label htmlFor="tarea-desc" className="text-xs font-medium text-muted-foreground">Descripción (opcional)</Label>
              <Textarea
                id="tarea-desc"
                placeholder="Agregá detalles que ayuden a entender la tarea."
                value={descripcion}
                onChange={e => setDescripcion(e.target.value.slice(0, DESC_MAX))}
                rows={3}
                maxLength={DESC_MAX}
                aria-invalid={submitted && !!descError}
                className="resize-none"
              />
              <div className="flex items-center justify-between min-h-[16px]">
                <span className={cn('text-xs', submitted && descError ? 'text-destructive' : 'text-muted-foreground')}>
                  {submitted && descError ? descError : ''}
                </span>
                <span className="text-xs text-muted-foreground">{trimmedDesc.length}/{DESC_MAX}</span>
              </div>
            </div>

            {/* Asignación + Fecha + Hora + Repetición (solo tareas) */}
            {!isPeticion && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Asignación</Label>
                  <Select value={asignadoId} onValueChange={handleAsignacionChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TEAM_VALUE}>
                        <span className="inline-flex items-center gap-2">
                          <Users className="h-3.5 w-3.5" />Todo el equipo
                        </span>
                      </SelectItem>
                      {activeBarbers.map(b => (
                        <SelectItem key={b.id} value={b.id}>{getBarberDisplayName(b)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {asignadoId === TEAM_VALUE && (
                    <p className="text-xs text-muted-foreground">Si no elegís una persona, queda visible para todo el equipo.</p>
                  )}
                </div>

                {/* Fecha de inicio */}
                <div className="rounded-lg border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Fecha de inicio</p>
                      <p className="text-xs text-muted-foreground">Cuándo empieza o corresponde realizar la tarea.</p>
                    </div>
                    <Switch checked={hasDate} onCheckedChange={handleDateToggle} />
                  </div>
                  {hasDate && (
                    <Popover open={dateOpen} onOpenChange={setDateOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start font-normal">
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          {selectedDate
                            ? (isToday(selectedDate) ? 'Hoy' : format(selectedDate, 'PPP', { locale: es }))
                            : 'Elegir fecha'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(d) => { setSelectedDate(d ?? undefined); setDateOpen(false); }}
                          locale={es}
                          className={cn('p-3 pointer-events-auto')}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {/* Hora */}
                <div className="rounded-lg border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Hora</p>
                      <p className="text-xs text-muted-foreground">Opcional. Sumá una hora si la tarea tiene horario fijo.</p>
                    </div>
                    <Switch checked={hasTime} onCheckedChange={setHasTime} disabled={!hasDate} />
                  </div>
                  {hasTime && hasDate && (
                    <Input
                      type="time"
                      value={selectedTime}
                      onChange={e => setSelectedTime(e.target.value)}
                      className="w-32"
                    />
                  )}
                </div>

                {/* Repetición */}
                <button
                  type="button"
                  className="w-full flex items-center justify-between rounded-lg border border-border px-3 py-3 hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setShowRepeatPicker(true)}
                  disabled={!hasDate}
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Repetición</p>
                    <p className="text-xs text-muted-foreground">
                      {hasDate ? repeatLabel : 'Activá la fecha de inicio para configurar repetición.'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>

                {isEdit && tarea && (
                  <div className="text-xs text-muted-foreground border-t border-border pt-4">
                    Creada el {format(new Date(tarea.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                  </div>
                )}
              </>
            )}

            {/* Vencimiento (solo peticiones) — sin cambios en esta fase */}
            {isPeticion && (
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Vencimiento</p>
                  <p className="text-xs text-muted-foreground">Días hasta que la petición expire si nadie la resuelve.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[15, 30, 60, 90].map(d => (
                    <Button
                      key={d}
                      type="button"
                      variant={vencimientoDias === d ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setVencimientoDias(d)}
                    >
                      {d} días
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground shrink-0">Personalizado:</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={365}
                    value={vencimientoDias}
                    onChange={e => setVencimientoDias(parseInt(e.target.value) || 60)}
                    className="w-20 h-8 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">días</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={!isValid || isPending}>
              {isEdit ? 'Guardar cambios' : (isPeticion ? 'Crear petición' : 'Crear tarea')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {!isPeticion && (
        <>
          <RepeatPicker
            open={showRepeatPicker}
            onOpenChange={setShowRepeatPicker}
            value={repeatPreset}
            onChange={handleRepeatChange}
            onCustom={() => {
              setShowRepeatPicker(false);
              setShowCustomRepeat(true);
            }}
          />

          <CustomRepeatSheet
            open={showCustomRepeat}
            onOpenChange={setShowCustomRepeat}
            frequency={repeatFrequency}
            interval={repeatInterval}
            byweekday={repeatByweekday}
            onConfirm={(freq, intv, days) => {
              setRepeatFrequency(freq);
              setRepeatInterval(intv);
              setRepeatByweekday(days);
              setRepeatPreset('custom');
              if (!hasDate) {
                setHasDate(true);
                if (!selectedDate) setSelectedDate(new Date());
              }
            }}
          />
        </>
      )}
    </>
  );
}
