import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
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

const TEAM_VALUE = '__team__';
const TITLE_MIN = 3;
const TITLE_MAX = 80;
const DESC_MAX = 500;

export function TareaFormDialog({ open, onOpenChange, barbers, onSubmit, isPending, tipo, creadorNombre }: TareaFormDialogProps) {
  const isPeticion = tipo === 'peticion';
  const activeBarbers = barbers.filter(b => b.active);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [asignadoId, setAsignadoId] = useState<string>(TEAM_VALUE);
  const [submitted, setSubmitted] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState('');

  const [repeatPreset, setRepeatPreset] = useState('never');
  const [repeatFrequency, setRepeatFrequency] = useState('weekly');
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatByweekday, setRepeatByweekday] = useState<number[]>([]);
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [showCustomRepeat, setShowCustomRepeat] = useState(false);

  const [vencimientoDias, setVencimientoDias] = useState(60);

  const resetForm = () => {
    setTitulo('');
    setDescripcion('');
    setAsignadoId(TEAM_VALUE);
    setSelectedDate(undefined);
    setSelectedTime('');
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
      onSubmit({
        tipo: 'peticion',
        titulo: trimmedTitle,
        descripcion: trimmedDesc || undefined,
        creado_por_nombre: creadorNombre,
        vencimiento_dias: vencimientoDias,
      });
    } else {
      const isTeam = asignadoId === TEAM_VALUE || !asignadoId;
      const barber = !isTeam ? activeBarbers.find(b => b.id === asignadoId) : undefined;
      onSubmit({
        tipo: 'tarea',
        titulo: trimmedTitle,
        descripcion: trimmedDesc || undefined,
        asignado_a_id: isTeam ? null : asignadoId,
        asignado_a_nombre: isTeam ? 'Todo el equipo' : (barber ? getBarberDisplayName(barber) : undefined),
        assignment_scope: isTeam ? 'team' : 'individual',
        fecha_limite: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined,
        hora: selectedDate && selectedTime ? selectedTime : undefined,
        repeat_preset: repeatPreset,
        repeat_frequency: repeatPreset === 'custom' ? repeatFrequency : undefined,
        repeat_interval: repeatPreset === 'custom' ? repeatInterval : undefined,
        repeat_byweekday: repeatPreset === 'custom' && repeatFrequency === 'weekly' ? repeatByweekday : undefined,
        recurrente: repeatPreset !== 'never',
      });
    }

    resetForm();
    onOpenChange(false);
  };

  const handleClearDate = () => {
    setSelectedDate(undefined);
    setSelectedTime('');
    setRepeatPreset('never');
  };

  const getRepeatDisplayLabel = () => {
    if (repeatPreset === 'custom') {
      return getCustomRepeatLabel(repeatFrequency, repeatInterval, repeatByweekday);
    }
    return getRepeatLabel(repeatPreset);
  };

  const primaryLabel = isPeticion ? 'Crear petición' : 'Crear tarea';

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isPeticion ? 'Nueva petición' : 'Nueva tarea'}</DialogTitle>
            <DialogDescription>
              {isPeticion
                ? 'Enviá una petición al equipo administrativo para revisión.'
                : 'Creá una tarea operativa y asignala al equipo o a un responsable.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {isPeticion && creadorNombre && (
              <div className="text-sm text-muted-foreground">
                Creado por: <span className="font-medium text-foreground">{creadorNombre}</span>
              </div>
            )}

            {/* Información */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="tarea-titulo">Título</Label>
                <Input
                  id="tarea-titulo"
                  placeholder={isPeticion ? 'Título de la petición' : 'Título de la tarea'}
                  value={titulo}
                  onChange={e => setTitulo(e.target.value.slice(0, TITLE_MAX))}
                  maxLength={TITLE_MAX}
                  aria-invalid={submitted && !!titleError}
                />
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${submitted && titleError ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {submitted && titleError ? titleError : '\u00A0'}
                  </span>
                  <span className="text-xs text-muted-foreground">{trimmedTitle.length}/{TITLE_MAX}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tarea-desc">Descripción</Label>
                <Textarea
                  id="tarea-desc"
                  placeholder="Descripción (opcional)"
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value.slice(0, DESC_MAX))}
                  rows={3}
                  maxLength={DESC_MAX}
                  aria-invalid={submitted && !!descError}
                  className="resize-none"
                />
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${submitted && descError ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {submitted && descError ? descError : '\u00A0'}
                  </span>
                  <span className="text-xs text-muted-foreground">{trimmedDesc.length}/{DESC_MAX}</span>
                </div>
              </div>
            </div>

            {/* Peticiones: vencimiento */}
            {isPeticion && (
              <div className="space-y-2">
                <Label>Vencimiento</Label>
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
                  <Label htmlFor="venc-custom" className="text-xs text-muted-foreground shrink-0 font-normal">Personalizado:</Label>
                  <Input
                    id="venc-custom"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={365}
                    value={vencimientoDias}
                    onChange={e => setVencimientoDias(parseInt(e.target.value) || 60)}
                    className="w-24 h-8"
                  />
                  <span className="text-xs text-muted-foreground">días</span>
                </div>
              </div>
            )}

            {/* Tarea: asignación + fecha */}
            {!isPeticion && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="tarea-asignado">Asignar a</Label>
                  <Select value={asignadoId} onValueChange={setAsignadoId}>
                    <SelectTrigger id="tarea-asignado">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TEAM_VALUE}>Todo el equipo</SelectItem>
                      {activeBarbers.map(b => (
                        <SelectItem key={b.id} value={b.id}>{getBarberDisplayName(b)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Fecha y planificación</Label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="tarea-fecha" className="text-xs text-muted-foreground font-normal">Fecha límite</Label>
                      <div className="flex gap-2">
                        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              id="tarea-fecha"
                              type="button"
                              variant="outline"
                              className="flex-1 justify-start font-normal"
                            >
                              <CalendarIcon className="h-4 w-4 mr-2" />
                              {selectedDate ? format(selectedDate, 'dd MMM yyyy', { locale: es }) : 'Sin fecha'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={(d) => { setSelectedDate(d); setDatePopoverOpen(false); }}
                              locale={es}
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        {selectedDate && (
                          <Button type="button" variant="ghost" size="sm" onClick={handleClearDate}>
                            Quitar
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="tarea-hora" className="text-xs text-muted-foreground font-normal">Hora</Label>
                      <Input
                        id="tarea-hora"
                        type="time"
                        value={selectedTime}
                        onChange={e => setSelectedTime(e.target.value)}
                        disabled={!selectedDate}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-normal">Repetir</Label>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between font-normal"
                      onClick={() => setShowRepeatPicker(true)}
                      disabled={!selectedDate}
                    >
                      <span className="inline-flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Repetir
                      </span>
                      <span className="text-muted-foreground">{getRepeatDisplayLabel()}</span>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={!isValid || isPending}>
              {primaryLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isPeticion && (
        <>
          <RepeatPicker
            open={showRepeatPicker}
            onOpenChange={setShowRepeatPicker}
            value={repeatPreset}
            onChange={(value) => setRepeatPreset(value)}
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
      )}
    </>
  );
}
