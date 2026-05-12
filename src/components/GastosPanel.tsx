import { useState, useEffect } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Receipt, Trash2, ChevronLeft, ChevronRight, Plus, Repeat } from 'lucide-react';
import { useGastos, TipoCosto } from '@/hooks/useGastos';
import { useGastosRecurrentes } from '@/hooks/useGastosRecurrentes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { RepeatPicker, getRepeatLabel } from '@/components/tareas/RepeatPicker';
import { CustomRepeatSheet, getCustomRepeatLabel } from '@/components/tareas/CustomRepeatSheet';
import { GastosRecurrentesList } from '@/components/GastosRecurrentesList';
import { useRequirePinForAction } from '@/components/ActionPinGate';
import { useSucursal } from '@/contexts/SucursalContext';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const CATEGORIAS_POR_TIPO: Record<TipoCosto, string[]> = {
  fijo: [
    'Alquiler del local',
    'Servicios del local (mínimo fijo)',
    'Internet',
    'Sueldos fijos del personal',
    'Suscripciones y software',
    'Seguro del local',
    'Honorarios profesionales',
    'Amortización de equipamiento',
    'Otros (fijo)',
  ],
  variable: [
    'Insumos de trabajo',
    'Publicidad y promociones',
    'Reposición de productos para venta',
    'Insumos administrativos',
    'Gastos operativos variables',
    'Otros (variable)',
  ],
  semivariable: [
    'Servicios públicos del local',
    'Sueldos y comisiones del personal',
    'Mantenimiento del local',
    'Limpieza del local',
    'Elementos de higiene y limpieza',
    'Marketing y publicidad recurrente',
    'Costos administrativos variables',
    'Gastos operativos generales',
    'Otros (semivariable)',
  ],
};

const TIPO_LABELS: Record<TipoCosto, string> = {
  fijo: '🧱 Fijo',
  variable: '📈 Variable',
  semivariable: '⚖️ Semivariable',
};

const TIPO_BADGE_VARIANT: Record<TipoCosto, 'default' | 'secondary' | 'outline'> = {
  fijo: 'default',
  variable: 'secondary',
  semivariable: 'outline',
};

export function GastosPanel() {
  const { gastos, isLoading, selectedMonth, setSelectedMonth, addGasto, anularGasto, totalPeriodo, setSyncRecurrentes } = useGastos();
  const requirePinForAction = useRequirePinForAction();
  const { currentSucursal } = useSucursal();
  
  const [anularState, setAnularState] = useState<{ id: number; motivo: string } | null>(null);
  const [anulando, setAnulando] = useState(false);
  const { recurrentes, syncGastosRecurrentes, addRecurrente, toggleRecurrente, deleteRecurrente } = useGastosRecurrentes();

  // Wire up the recurrentes sync into useGastos
  useEffect(() => {
    setSyncRecurrentes(syncGastosRecurrentes);
  }, [setSyncRecurrentes, syncGastosRecurrentes]);

  const [tipoCosto, setTipoCosto] = useState<TipoCosto>('fijo');
  const [categoria, setCategoria] = useState('');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [submitting, setSubmitting] = useState(false);

  // Recurrence state
  const [esRecurrente, setEsRecurrente] = useState(false);
  const [repeatPreset, setRepeatPreset] = useState('monthly');
  const [repeatFrequency, setRepeatFrequency] = useState('weekly');
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatByweekday, setRepeatByweekday] = useState<number[]>([]);
  const [repeatPickerOpen, setRepeatPickerOpen] = useState(false);
  const [customRepeatOpen, setCustomRepeatOpen] = useState(false);

  const handleTipoCostoChange = (value: TipoCosto) => {
    setTipoCosto(value);
    setCategoria('');
    if (value !== 'fijo') {
      setEsRecurrente(false);
    }
  };

  const getRepeatDisplayLabel = () => {
    if (repeatPreset === 'custom') {
      return getCustomRepeatLabel(repeatFrequency, repeatInterval, repeatByweekday);
    }
    return getRepeatLabel(repeatPreset);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoria || !monto) return;

    setSubmitting(true);

    if (esRecurrente && tipoCosto === 'fijo') {
      // Create recurring template
      const success = await addRecurrente({
        categoria,
        tipo_costo: tipoCosto,
        monto: parseFloat(monto),
        descripcion: descripcion || undefined,
        repeat_preset: repeatPreset,
        repeat_frequency: repeatPreset === 'custom' ? repeatFrequency : undefined,
        repeat_interval: repeatPreset === 'custom' ? repeatInterval : undefined,
        repeat_byweekday: repeatPreset === 'custom' ? repeatByweekday : undefined,
        fecha_inicio: fecha,
      });

      if (success) {
        resetForm();
      }
    } else {
      // Normal single gasto
      const gate = await requirePinForAction('registrar_gasto', currentSucursal?.id ?? null);
      if (!gate.ok) { setSubmitting(false); return; }
      const success = await addGasto({
        categoria,
        monto: parseFloat(monto),
        descripcion,
        fecha: new Date(fecha + 'T12:00:00'),
        tipoCosto,
      });

      if (success) {
        resetForm();
      }
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setCategoria('');
    setMonto('');
    setDescripcion('');
    setFecha(format(new Date(), 'yyyy-MM-dd'));
    setEsRecurrente(false);
    setRepeatPreset('monthly');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Receipt className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold text-foreground">Gastos</h2>
      </div>

      {/* Formulario */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Registrar gasto</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de costo *</Label>
              <Select value={tipoCosto} onValueChange={handleTipoCostoChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fijo">🧱 Fijo</SelectItem>
                  <SelectItem value="variable">📈 Variable</SelectItem>
                  <SelectItem value="semivariable">⚖️ Semivariable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoría *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_POR_TIPO[tipoCosto].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Monto *</Label>
              <CurrencyInput
                placeholder="0"
                value={monto}
                onChange={setMonto}
              />
            </div>

            <div className="space-y-2">
              <Label>{esRecurrente ? 'Fecha de inicio' : 'Fecha'}</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                placeholder="Detalle del gasto..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
              />
            </div>

            {/* Recurrence toggle - only for fijo */}
            {tipoCosto === 'fijo' && (
              <div className="sm:col-span-2 space-y-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={esRecurrente}
                    onCheckedChange={setEsRecurrente}
                  />
                  <Label className="flex items-center gap-2 cursor-pointer" onClick={() => setEsRecurrente(!esRecurrente)}>
                    <Repeat className="h-4 w-4" />
                    Gasto recurrente
                  </Label>
                </div>

                {esRecurrente && (
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground">Repetir:</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRepeatPickerOpen(true)}
                    >
                      {getRepeatDisplayLabel()}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting || !categoria || !monto}>
                <Plus className="h-4 w-4 mr-2" />
                {submitting ? 'Registrando...' : esRecurrente ? 'Crear gasto recurrente' : 'Registrar gasto'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Gastos recurrentes list */}
      <GastosRecurrentesList
        recurrentes={recurrentes}
        onToggle={toggleRecurrente}
        onDelete={deleteRecurrente}
      />

      {/* Historial */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Historial</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center capitalize">
                {format(selectedMonth, 'MMMM yyyy', { locale: es })}
              </span>
              <Button variant="outline" size="icon" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Cargando...</p>
          ) : gastos.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No hay gastos en este período</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gastos.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="whitespace-nowrap">
                      {g.Fecha ? format(new Date(g.Fecha), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      {g.tipo_costo ? (
                        <Badge variant={TIPO_BADGE_VARIANT[g.tipo_costo]}>
                          {TIPO_LABELS[g.tipo_costo]}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{g.Categoria || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{g.Descripcion || '-'}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${(g.Monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setAnularState({ id: g.id, motivo: '' })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-semibold">Total del período</TableCell>
                  <TableCell className="text-right font-bold">
                    ${totalPeriodo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Repeat picker sheets */}
      <RepeatPicker
        open={repeatPickerOpen}
        onOpenChange={setRepeatPickerOpen}
        value={repeatPreset}
        onChange={(val) => setRepeatPreset(val)}
        onCustom={() => setCustomRepeatOpen(true)}
      />

      <CustomRepeatSheet
        open={customRepeatOpen}
        onOpenChange={setCustomRepeatOpen}
        frequency={repeatFrequency}
        interval={repeatInterval}
        byweekday={repeatByweekday}
        onConfirm={(freq, interval, days) => {
          setRepeatPreset('custom');
          setRepeatFrequency(freq);
          setRepeatInterval(interval);
          setRepeatByweekday(days);
        }}
      />

      <Dialog open={anularState !== null} onOpenChange={(o) => { if (!o) setAnularState(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anular gasto</DialogTitle>
            <DialogDescription>
              El gasto se marcará como anulado y dejará de impactar en finanzas. Esta acción queda registrada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-anulacion">Motivo de anulación</Label>
            <Textarea
              id="motivo-anulacion"
              maxLength={240}
              value={anularState?.motivo ?? ''}
              onChange={(e) => setAnularState((s) => s ? { ...s, motivo: e.target.value } : s)}
              placeholder="Indicá brevemente por qué se anula"
            />
            <p className="text-xs text-muted-foreground text-right">
              {(anularState?.motivo.length ?? 0)}/240
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnularState(null)} disabled={anulando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={anulando || !anularState?.motivo.trim()}
              onClick={async () => {
                if (!anularState) return;
                setAnulando(true);
                try {
                  const gate = await requirePinForAction('anular_gasto', currentSucursal?.id ?? null);
                  if (!gate.ok) return;
                  const ok = await anularGasto(anularState.id, anularState.motivo, {
                    validatedByUserId: gate.validatedByUserId ?? null,
                  });
                  if (ok) setAnularState(null);
                } finally {
                  setAnulando(false);
                }
              }}
            >
              {anulando ? 'Anulando…' : 'Anular gasto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
