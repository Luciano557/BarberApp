import { useEffect, useState } from 'react';
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
import type { TareaRecurrente, TareaRecurrenteInsert, TareaRecurrenteUpdate } from '@/hooks/useTareasRecurrentes';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barbers: Barber[];
  onSubmit: (data: TareaRecurrenteInsert) => void;
  onUpdate?: (patch: TareaRecurrenteUpdate) => void;
  isPending?: boolean;
  receta?: TareaRecurrente | null;
}

const TEAM_VALUE = '__team__';
const TITLE_MAX = 80;
const TITLE_MIN = 3;
const DESC_MAX = 240;

export function TareaRecurrenteFormDialog({
  open,
  onOpenChange,
  barbers,
  onSubmit,
  onUpdate,
  isPending,
  receta,
}: Props) {
  const isEdit = !!receta;
  const activeBarbers = barbers.filter(b => b.active);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [asignadoId, setAsignadoId] = useState<string>(TEAM_VALUE);
  const [submitted, setSubmitted] = useState(false);

  // Fecha de inicio (obligatoria, default hoy).
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateOpen, setDateOpen] = useState(false);

  // Hora opcional.
  const [hasTime, setHasTime] = useState(false);
  const [selectedTime, setSelectedTime] = useState('09:00');

  // Repetición (default 'weekly' al crear, jamás 'never').
  const [repeatPreset, setRepeatPreset] = useState('weekly');
  const [repeatFrequency, setRepeatFrequency] = useState('weekly');
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatByweekday, setRepeatByweekday] = useState<number[]>([]);

  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [showCustomRepeat, setShowCustomRepeat] = useState(false);

  const resetForm = () => {
    setTitulo('');
    setDescripcion('');
    setAsignadoId(TEAM_VALUE);
    setSelectedDate(new Date());
    setHasTime(false);
    setSelectedTime('09:00');
    setRepeatPreset('weekly');
    setRepeatFrequency('weekly');
    setRepeatInterval(1);
    setRepeatByweekday([]);
    setSubmitted(false);
  };

  useEffect(() => {
    if (!open) return;
    if (receta) {
      setTitulo(receta.titulo ?? '');
      setDescripcion(receta.descripcion ?? '');
      const isTeam = receta.assignment_scope === 'team' || !receta.asignado_a;
      setAsignadoId(isTeam ? TEAM_VALUE : receta.asignado_a!);
      try {
        setSelectedDate(parseISO(receta.fecha_inicio));
      } catch {
        setSelectedDate(new Date());
      }
      if (receta.hora) {
        setHasTime(true);
        setSelectedTime(receta.hora);
      } else {
        setHasTime(false);
        setSelectedTime('09:00');
      }
      setRepeatPreset(receta.repeat_preset && receta.repeat_preset !== 'never' ? receta.repeat_preset : 'weekly');
      setRepeatFrequency(receta.repeat_frequency ?? 'weekly');
      setRepeatInterval(receta.repeat_interval ?? 1);
      setRepeatByweekday(receta.repeat_byweekday ?? []);
      setSubmitted(false);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, receta?.id]);

  const trimmedTitle = titulo.trim();
  const trimmedDesc = descripcion.trim();
  const titleError =
    trimmedTitle.length === 0
      ? 'El título es obligatorio.'
      : trimmedTitle.length < TITLE_MIN
      ? `El título debe tener al menos ${TITLE_MIN} caracteres.`
      : trimmedTitle.length > TITLE_MAX
      ? `El título no puede superar ${TITLE_MAX} caracteres.`
      : null;
  const descError =
    trimmedDesc.length > DESC_MAX ? `La descripción no puede superar ${DESC_MAX} caracteres.` : null;
  const repeatError = repeatPreset === 'never' ? 'Elegí una frecuencia de repetición.' : null;
  const isValid = !titleError && !descError && !repeatError;

  const handleAsignacionChange = (value: string) => {
    setAsignadoId(value && value.length > 0 ? value : TEAM_VALUE);
  };

  const handleConfirm = () => {
    setSubmitted(true);
    if (!isValid) return;

    const isTeam = asignadoId === TEAM_VALUE || !asignadoId;
    const barber = !isTeam ? activeBarbers.find(b => b.id === asignadoId) : undefined;
    const fecha_inicio = format(selectedDate, 'yyyy-MM-dd');
    const hora = hasTime ? selectedTime : null;
    const repeat_frequency = repeatPreset === 'custom' ? repeatFrequency : null;
    const repeat_interval = repeatPreset === 'custom' ? repeatInterval : null;
    const repeat_byweekday =
      repeatPreset === 'custom' && repeatFrequency === 'weekly' ? repeatByweekday : null;
    const asignado_nombre = isTeam
      ? 'Todo el equipo'
      : barber
      ? getBarberDisplayName(barber)
      : receta?.asignado_nombre ?? null;

    if (isEdit && receta && onUpdate) {
      onUpdate({
        id: receta.id,
        titulo: trimmedTitle,
        descripcion: trimmedDesc || null,
        assignment_scope: isTeam ? 'team' : 'individual',
        asignado_a: isTeam ? null : asignadoId,
        asignado_nombre,
        hora,
        repeat_preset: repeatPreset,
        repeat_frequency,
        repeat_interval,
        repeat_byweekday,
        fecha_inicio,
      });
    } else {
      const payload: TareaRecurrenteInsert = {
        titulo: trimmedTitle,
        descripcion: trimmedDesc || null,
        assignment_scope: isTeam ? 'team' : 'individual',
        asignado_a: isTeam ? null : asignadoId,
        asignado_nombre,
        hora,
        repeat_preset: repeatPreset,
        repeat_frequency,
        repeat_interval,
        repeat_byweekday,
        fecha_inicio,
      };
      onSubmit(payload);
    }

    if (!isEdit) resetForm();
    onOpenChange(false);
  };

  const handleRepeatChange = (value: string) => {
    // Nunca permitir 'never'.
    setRepeatPreset(value === 'never' ? 'weekly' : value);
  };

  const repeatLabel =
    repeatPreset === 'custom'
      ? getCustomRepeatLabel(repeatFrequency, repeatInterval, repeatByweekday)
      : getRepeatLabel(repeatPreset);

  const headerTitle = isEdit ? 'Editar recurrencia' : 'Nueva recurrencia';
  const headerSubtitle = 'Definí qué hay que hacer, quién lo hace y cada cuánto se repite.';

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
            {/* Título */}
            <div className="space-y-1.5">
              <Label htmlFor="rec-titulo" className="text-xs font-medium text-muted-foreground">Título</Label>
              <Input
                id="rec-titulo"
                placeholder="Ej: Limpiar herramientas"
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
              <Label htmlFor="rec-desc" className="text-xs font-medium text-muted-foreground">Descripción (opcional)</Label>
              <Textarea
                id="rec-desc"
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

            {/* Asignación */}
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

            {/* Fecha de inicio (obligatoria) */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Fecha de inicio</p>
                <p className="text-xs text-muted-foreground">Desde cuándo empieza a generarse esta recurrencia.</p>
              </div>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {isToday(selectedDate) ? 'Hoy' : format(selectedDate, 'PPP', { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => { if (d) { setSelectedDate(d); setDateOpen(false); } }}
                    locale={es}
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Hora opcional */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Hora</p>
                  <p className="text-xs text-muted-foreground">Opcional. Sumá una hora si la tarea tiene horario fijo.</p>
                </div>
                <Switch checked={hasTime} onCheckedChange={setHasTime} />
              </div>
              {hasTime && (
                <Input
                  type="time"
                  value={selectedTime}
                  onChange={e => setSelectedTime(e.target.value)}
                  className="w-32"
                />
              )}
            </div>

            {/* Repetición (obligatoria) */}
            <button
              type="button"
              className="w-full flex items-center justify-between rounded-lg border border-border px-3 py-3 hover:bg-muted/50 transition-colors text-left"
              onClick={() => setShowRepeatPicker(true)}
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Repetición</p>
                <p className={cn('text-xs', submitted && repeatError ? 'text-destructive' : 'text-muted-foreground')}>
                  {submitted && repeatError ? repeatError : repeatLabel}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>

            {isEdit && receta && (
              <div className="text-xs text-muted-foreground border-t border-border pt-4">
                Creada el {format(new Date(receta.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={!isValid || isPending}>
              {isEdit ? 'Guardar cambios' : 'Crear recurrencia'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

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
        }}
      />
    </>
  );
}
