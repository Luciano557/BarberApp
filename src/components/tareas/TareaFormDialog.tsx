import { useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { X, CheckCircle, CalendarIcon, Clock, RefreshCw, ChevronRight } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Barber, getBarberDisplayName } from '@/types/barbershop';
import { RepeatPicker, getRepeatLabel } from './RepeatPicker';
import { CustomRepeatSheet, getCustomRepeatLabel } from './CustomRepeatSheet';
import type { TareaInsert } from '@/hooks/useTareas';

interface TareaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barbers: Barber[];
  onSubmit: (tarea: TareaInsert) => void;
  isPending?: boolean;
  tipo: 'tarea' | 'peticion';
  creadorNombre?: string;
}

export function TareaFormDialog({ open, onOpenChange, barbers, onSubmit, isPending, tipo, creadorNombre }: TareaFormDialogProps) {
  const TEAM_VALUE = '__team__';
  const TITLE_MAX = 80;
  const TITLE_MIN = 3;
  const DESC_MAX = 500;

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [asignadoId, setAsignadoId] = useState<string>(TEAM_VALUE);
  const [submitted, setSubmitted] = useState(false);

  // Date
  const [hasDate, setHasDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Time
  const [hasTime, setHasTime] = useState(false);
  const [selectedTime, setSelectedTime] = useState('09:00');

  // Repeat
  const [repeatPreset, setRepeatPreset] = useState('never');
  const [repeatFrequency, setRepeatFrequency] = useState('weekly');
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatByweekday, setRepeatByweekday] = useState<number[]>([]);

  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [showCustomRepeat, setShowCustomRepeat] = useState(false);

  // Vencimiento (peticiones)
  const [vencimientoDias, setVencimientoDias] = useState(60);

  const isPeticion = tipo === 'peticion';
  const activeBarbers = barbers.filter(b => b.active);

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
  const descError = trimmedDesc.length > DESC_MAX
    ? `La descripción no puede superar ${DESC_MAX} caracteres.`
    : null;
  const isValid = !titleError && !descError;

  const handleConfirm = () => {
    setSubmitted(true);
    if (!isValid) return;

    if (isPeticion) {
      const tarea: TareaInsert = {
        tipo: 'peticion',
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        creado_por_nombre: creadorNombre,
        vencimiento_dias: vencimientoDias,
      };
      onSubmit(tarea);
    } else {
      const barber = activeBarbers.find(b => b.id === asignadoId);
      const barberName = barber ? getBarberDisplayName(barber) : undefined;
      const tarea: TareaInsert = {
        tipo: 'tarea',
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        asignado_a_id: asignadoId || undefined,
        asignado_a_nombre: barberName,
        fecha_limite: hasDate && selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined,
        hora: hasTime ? selectedTime : undefined,
        repeat_preset: repeatPreset,
        repeat_frequency: repeatPreset === 'custom' ? repeatFrequency : undefined,
        repeat_interval: repeatPreset === 'custom' ? repeatInterval : undefined,
        repeat_byweekday: repeatPreset === 'custom' && repeatFrequency === 'weekly' ? repeatByweekday : undefined,
        recurrente: repeatPreset !== 'never',
      };
      onSubmit(tarea);
    }

    resetForm();
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
    if (checked && !selectedDate) {
      setSelectedDate(new Date());
    }
    if (!checked) {
      setRepeatPreset('never');
    }
  };

  const getRepeatDisplayLabel = () => {
    if (repeatPreset === 'custom') {
      return getCustomRepeatLabel(repeatFrequency, repeatInterval, repeatByweekday);
    }
    return getRepeatLabel(repeatPreset);
  };

  const dateSubtext = () => {
    if (!hasDate || !selectedDate) return '';
    if (isToday(selectedDate)) return 'hoy';
    return format(selectedDate, 'dd MMM yyyy', { locale: es });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <Button variant="ghost" size="icon" onClick={() => { resetForm(); onOpenChange(false); }}>
              <X className="h-5 w-5" />
            </Button>
            <span className="font-semibold text-base">
              {isPeticion ? 'Nueva petición' : 'Nueva tarea'}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary"
              disabled={!titulo.trim() || isPending}
              onClick={handleConfirm}
            >
              <CheckCircle className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-4 space-y-4">
            {/* Creado por (peticiones) */}
            {isPeticion && creadorNombre && (
              <div className="text-sm text-muted-foreground">
                Creado por: <span className="font-medium text-foreground">{creadorNombre}</span>
              </div>
            )}

            {/* Title & Description */}
            <div className="space-y-3">
              <Input
                placeholder={isPeticion ? 'Título de la petición' : 'Título de la tarea'}
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                className="text-base font-medium border-0 border-b border-border rounded-none px-0 focus-visible:ring-0"
              />
              <Textarea
                placeholder="Notas"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                rows={2}
                className="border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 resize-none text-sm"
              />
            </div>

            {/* Vencimiento (peticiones) */}
            {isPeticion && (
              <div className="rounded-xl border border-border overflow-hidden bg-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Vencimiento</p>
                    <p className="text-xs text-muted-foreground">Días hasta que la petición expire</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[15, 30, 60, 90].map(d => (
                    <Button
                      key={d}
                      type="button"
                      variant={vencimientoDias === d ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
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
                    className="w-20 h-7 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">días</span>
                </div>
              </div>
            )}

            {/* Tarea-only fields */}
            {!isPeticion && (
              <>
                {/* Assign */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Asignar a</Label>
                  <Select value={asignadoId} onValueChange={setAsignadoId}>
                    <SelectTrigger className="border-0 border-b border-border rounded-none px-0">
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeBarbers.map(b => (
                        <SelectItem key={b.id} value={b.id}>{getBarberDisplayName(b)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date/Time/Repeat cards */}
                <div className="rounded-xl border border-border overflow-hidden divide-y divide-border bg-card">
                  {/* Date row */}
                  <div className="px-4">
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                          <CalendarIcon className="h-4 w-4 text-destructive" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Fecha</p>
                          {hasDate && <p className="text-xs text-muted-foreground">{dateSubtext()}</p>}
                        </div>
                      </div>
                      <Switch checked={hasDate} onCheckedChange={handleDateToggle} />
                    </div>
                    {hasDate && (
                      <div className="pb-3">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          locale={es}
                          className="p-0 pointer-events-auto mx-auto"
                        />
                      </div>
                    )}
                  </div>

                  {/* Time row */}
                  <div className="px-4">
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-status-info-bg flex items-center justify-center">
                          <Clock className="h-4 w-4 text-status-info-foreground" />
                        </div>
                        <p className="text-sm font-medium">Hora</p>
                      </div>
                      <Switch checked={hasTime} onCheckedChange={setHasTime} />
                    </div>
                    {hasTime && (
                      <div className="pb-3">
                        <Input
                          type="time"
                          value={selectedTime}
                          onChange={e => setSelectedTime(e.target.value)}
                          className="w-32"
                        />
                      </div>
                    )}
                  </div>

                  {/* Repeat row */}
                  <button
                    className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors"
                    onClick={() => setShowRepeatPicker(true)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">Repetir</p>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span className="text-sm">{getRepeatDisplayLabel()}</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </button>
                </div>
              </>
            )}
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
