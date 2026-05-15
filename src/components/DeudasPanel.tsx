import { useState, useMemo } from 'react';
import { Landmark, Trash2, Plus, CreditCard, CheckCircle2 } from 'lucide-react';
import { useDeudas, type Deuda } from '@/hooks/useDeudas';
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
import { format } from 'date-fns';

function formatARS(n: number): string {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function DeudasPanel() {
  const { deudas, isLoading, addDeuda, registrarPago, deleteDeuda } = useDeudas();
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

  const renderDeudaCard = (d: Deuda) => {
    const pendiente = d.monto_total - d.monto_pagado;
    const progreso = d.monto_total > 0 ? (d.monto_pagado / d.monto_total) * 100 : 0;
    const invNombre = getInversionNombre(d.inversion_id);
    const esPagada = d.estado === 'pagada';

    return (
      <Card key={d.id} className={esPagada ? 'opacity-70' : ''}>
        <CardContent className="py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Landmark className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="font-medium text-foreground">{d.acreedor}</span>
                <Badge variant={esPagada ? 'default' : 'secondary'} className="text-xs">
                  {esPagada ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Pagada</> : 'Activa'}
                </Badge>
                {invNombre && (
                  <Badge variant="outline" className="text-xs">Inversión: {invNombre}</Badge>
                )}
              </div>

              <div className="text-sm text-muted-foreground">
                <p>
                  Total: ${d.monto_total.toLocaleString()}
                  {d.cuotas_totales && ` · ${d.cuotas_pagadas}/${d.cuotas_totales} cuotas`}
                  {d.monto_cuota && ` · $${d.monto_cuota.toLocaleString()}/cuota`}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={progreso} className="h-2 flex-1" />
                  <span className="text-xs whitespace-nowrap">
                    ${d.monto_pagado.toLocaleString()} / ${d.monto_total.toLocaleString()}
                  </span>
                </div>
                {!esPagada && pendiente > 0 && (
                  <p className="text-xs mt-1">Pendiente: ${pendiente.toLocaleString()}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 ml-2">
              {!esPagada && (
                <Button size="sm" variant="outline" onClick={() => setDeudaAPagar(d)}>
                  <CreditCard className="h-3 w-3 mr-1" /> Confirmar Pago
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive h-8 w-8"
                onClick={() => setDeudaAEliminar(d)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

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

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Deudas Pagadas</h3>
        {deudasPagadas.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground text-sm">
              Todavía no hay deudas pagadas.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {deudasPagadas.map(renderDeudaCard)}
          </div>
        )}
      </div>

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

      <AlertDialog open={!!deudaAPagar} onOpenChange={(open) => !open && setDeudaAPagar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pago</AlertDialogTitle>
            <AlertDialogDescription>
              {deudaAPagar && (
                <>Vas a marcar la deuda con <strong>{deudaAPagar.acreedor}</strong> como pagada en su totalidad. Esta acción la moverá a "Deudas Pagadas".</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deudaAPagar) {
                  await registrarPago(deudaAPagar);
                  setDeudaAPagar(null);
                }
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
