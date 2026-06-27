import { useEffect, useState, useMemo } from 'react';
import { Landmark, Trash2, Plus, CreditCard, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { useDeudas, type Deuda, type PagoDeuda } from '@/hooks/useDeudas';
import { useInversiones } from '@/hooks/useInversiones';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';

function formatARS(n: number): string {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function DeudasPanel() {
  const { deudas, isLoading, addDeuda, registrarPago, deleteDeuda, fetchPagosDeuda } = useDeudas();
  const { inversiones } = useInversiones();

  const [acreedor, setAcreedor] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [cuotasTotales, setCuotasTotales] = useState('');
  const [fechaInicio, setFechaInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fechaProximoPago, setFechaProximoPago] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deudaAEliminar, setDeudaAEliminar] = useState<Deuda | null>(null);
  const [deudaAPagar, setDeudaAPagar] = useState<Deuda | null>(null);
  const [mostrarPagadas, setMostrarPagadas] = useState(false);

  // Monto por cuota calculado
  const montoCuotaCalculado = useMemo(() => {
    const total = parseFloat(montoTotal);
    const cuotas = parseInt(cuotasTotales);
    if (!isFinite(total) || !isFinite(cuotas) || cuotas <= 0 || total <= 0) return 0;
    return total / cuotas;
  }, [montoTotal, cuotasTotales]);

  const resetForm = () => {
    setAcreedor('');
    setMontoTotal('');
    setCuotasTotales('');
    setFechaInicio(format(new Date(), 'yyyy-MM-dd'));
    setFechaProximoPago('');
    setDescripcion('');
  };

  const handleSubmit = async () => {
    if (!acreedor || !montoTotal) return;
    const ok = await addDeuda({
      acreedor: acreedor.trim(),
      monto_total: parseFloat(montoTotal),
      cuotas_totales: cuotasTotales ? parseInt(cuotasTotales) : undefined,
      monto_cuota: montoCuotaCalculado > 0 ? montoCuotaCalculado : undefined,
      fecha_inicio: new Date(fechaInicio),
      fecha_proximo_pago: fechaProximoPago ? new Date(fechaProximoPago) : undefined,
      descripcion: descripcion || undefined,
    });
    if (ok) {
      resetForm();
      setShowForm(false);
    }
  };

  const getInversionNombre = (invId: string | null) => {
    if (!invId) return null;
    return inversiones.find(i => i.id === invId)?.nombre || null;
  };

  const deudasActivas = deudas.filter(d => d.estado !== 'pagada');
  const deudasPagadas = deudas.filter(d => d.estado === 'pagada');

  const renderDeudaCard = (d: Deuda) => (
    <DeudaCard
      key={d.id}
      deuda={d}
      inversionNombre={getInversionNombre(d.inversion_id)}
      fetchPagosDeuda={fetchPagosDeuda}
      onRegistrarPago={() => setDeudaAPagar(d)}
      onEliminar={() => setDeudaAEliminar(d)}
    />
  );


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Deudas Activas</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> Nueva
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Acreedor *</Label>
                <Input value={acreedor} onChange={e => setAcreedor(e.target.value)} placeholder="Ej: Banco Nación" maxLength={80} />
              </div>
              <div>
                <Label>Monto total *</Label>
                <CurrencyInput value={montoTotal} onChange={setMontoTotal} placeholder="0" />
              </div>
              <div>
                <Label>Cantidad de cuotas</Label>
                <Input type="number" inputMode="numeric" value={cuotasTotales} onChange={e => setCuotasTotales(e.target.value)} />
              </div>
              <div>
                <Label>Monto por cuota</Label>
                <div className="h-10 px-3 flex items-center rounded-md border border-input bg-muted text-sm text-muted-foreground">
                  {montoCuotaCalculado > 0 ? `$${formatARS(montoCuotaCalculado)}` : 'Se calcula automáticamente'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Calculado en base al monto total y la cantidad de cuotas.</p>
              </div>
              <div>
                <Label>Fecha inicio</Label>
                <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
              </div>
              <div>
                <Label>Próximo pago</Label>
                <Input type="date" value={fechaProximoPago} onChange={e => setFechaProximoPago(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Opcional" maxLength={240} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSubmit} disabled={!acreedor || !montoTotal}>Guardar</Button>
              <Button variant="outline" onClick={() => { resetForm(); setShowForm(false); }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : deudasActivas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Landmark className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No hay deudas activas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {deudasActivas.map(renderDeudaCard)}
        </div>
      )}

      {deudasPagadas.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setMostrarPagadas((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {mostrarPagadas ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Deudas pagadas ({deudasPagadas.length})
          </button>
          {mostrarPagadas && (
            <div className="space-y-3">
              {deudasPagadas.map(renderDeudaCard)}
            </div>
          )}
        </div>
      )}


      <AlertDialog open={!!deudaAEliminar} onOpenChange={(open) => !open && setDeudaAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar deuda</AlertDialogTitle>
            <AlertDialogDescription>
              {deudaAEliminar && (
                <>Vas a eliminar la deuda con <strong>{deudaAEliminar.acreedor}</strong>. Esta acción no se puede deshacer.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deudaAEliminar) {
                  await deleteDeuda(deudaAEliminar.id);
                  setDeudaAEliminar(null);
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RegistrarPagoDialog
        deuda={deudaAPagar}
        onClose={() => setDeudaAPagar(null)}
        registrarPago={registrarPago}
      />

    </div>
  );
}

function RegistrarPagoDialog({
  deuda,
  onClose,
  registrarPago,
}: {
  deuda: Deuda | null;
  onClose: () => void;
  registrarPago: (
    deuda: Deuda,
    monto: number,
    fecha: string,
    observacion?: string,
  ) => Promise<boolean>;
}) {
  const saldoPendiente = deuda
    ? Math.max(0, Number(deuda.monto_total) - Number(deuda.monto_pagado))
    : 0;
  const sugerido = deuda
    ? Math.min(
        saldoPendiente,
        deuda.monto_cuota && deuda.monto_cuota > 0
          ? Number(deuda.monto_cuota)
          : saldoPendiente,
      )
    : 0;

  const [monto, setMonto] = useState<string>('');
  const [fecha, setFecha] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [observacion, setObservacion] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Reset on open
  useMemo(() => {
    if (deuda) {
      setMonto(sugerido > 0 ? sugerido.toFixed(2) : '');
      setFecha(format(new Date(), 'yyyy-MM-dd'));
      setObservacion('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deuda?.id]);

  const montoNum = parseFloat(monto);
  const montoInvalido =
    !isFinite(montoNum) ||
    montoNum <= 0 ||
    montoNum > saldoPendiente + 0.009;

  const handleSubmit = async () => {
    if (!deuda || montoInvalido) return;
    setSubmitting(true);
    const ok = await registrarPago(deuda, montoNum, fecha, observacion);
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={!!deuda} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          {deuda && (
            <DialogDescription>
              {deuda.acreedor} · Saldo pendiente ${formatARS(saldoPendiente)}
              {deuda.cuotas_totales && deuda.cuotas_totales > 0 ? (
                <> · Cuota {deuda.cuotas_pagadas + 1} de {deuda.cuotas_totales}</>
              ) : null}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pago-monto">Monto a pagar</Label>
            <CurrencyInput
              id="pago-monto"
              value={monto}
              onChange={setMonto}
              placeholder="0,00"
            />
            {montoInvalido && monto !== '' && (
              <p className="text-xs text-destructive">
                {montoNum <= 0
                  ? 'El monto debe ser mayor a 0'
                  : 'No puede superar el saldo pendiente'}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pago-fecha">Fecha de pago</Label>
            <Input
              id="pago-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pago-obs">Observación (opcional)</Label>
            <Textarea
              id="pago-obs"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              maxLength={240}
              rows={2}
              placeholder="Nota interna sobre este pago"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || montoInvalido || !fecha}
          >
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
