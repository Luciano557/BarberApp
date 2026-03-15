import { useState } from 'react';
import { TrendingUp, Trash2, Plus, Package } from 'lucide-react';
import { useInversiones } from '@/hooks/useInversiones';
import { useDeudas } from '@/hooks/useDeudas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

const CATEGORIAS = ['Mobiliario', 'Equipamiento', 'Reforma', 'Tecnología', 'Vehículo', 'Otro'];

export function InversionesPanel() {
  const { inversiones, isLoading, addInversion, deleteInversion, getAmortizacionMensual, getMesesTranscurridos } = useInversiones();
  const { addDeuda } = useDeudas();

  const [nombre, setNombre] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [fechaCompra, setFechaCompra] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [mesesAmortizacion, setMesesAmortizacion] = useState('12');
  const [categoria, setCategoria] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [financiada, setFinanciada] = useState(false);
  const [acreedor, setAcreedor] = useState('');
  const [cuotas, setCuotas] = useState('');
  const [montoCuota, setMontoCuota] = useState('');
  const [fechaProximoPago, setFechaProximoPago] = useState('');
  const [showForm, setShowForm] = useState(false);

  const resetForm = () => {
    setNombre('');
    setMontoTotal('');
    setFechaCompra(format(new Date(), 'yyyy-MM-dd'));
    setMesesAmortizacion('12');
    setCategoria('');
    setDescripcion('');
    setFinanciada(false);
    setAcreedor('');
    setCuotas('');
    setMontoCuota('');
    setFechaProximoPago('');
  };

  const handleSubmit = async () => {
    if (!nombre || !montoTotal || !mesesAmortizacion) return;

    const inv = await addInversion({
      nombre: nombre.trim(),
      monto_total: parseFloat(montoTotal),
      fecha_compra: new Date(fechaCompra),
      meses_amortizacion: parseInt(mesesAmortizacion),
      categoria: categoria || undefined,
      descripcion: descripcion || undefined,
    });

    if (inv && financiada && acreedor) {
      await addDeuda({
        acreedor: acreedor.trim(),
        monto_total: parseFloat(montoTotal),
        cuotas_totales: cuotas ? parseInt(cuotas) : undefined,
        monto_cuota: montoCuota ? parseFloat(montoCuota) : undefined,
        fecha_inicio: new Date(fechaCompra),
        fecha_proximo_pago: fechaProximoPago ? new Date(fechaProximoPago) : undefined,
        inversion_id: inv.id,
      });
    }

    if (inv) {
      resetForm();
      setShowForm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Inversiones</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> Nueva
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nombre *</Label>
                <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Sillón nuevo" />
              </div>
              <div>
                <Label>Monto total *</Label>
                <Input type="number" value={montoTotal} onChange={e => setMontoTotal(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Fecha de compra</Label>
                <Input type="date" value={fechaCompra} onChange={e => setFechaCompra(e.target.value)} />
              </div>
              <div>
                <Label>Meses de amortización *</Label>
                <Input type="number" value={mesesAmortizacion} onChange={e => setMesesAmortizacion(e.target.value)} placeholder="12" />
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Opcional" />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox id="financiada" checked={financiada} onCheckedChange={v => setFinanciada(!!v)} />
              <Label htmlFor="financiada" className="cursor-pointer">¿Financiada? (crea deuda asociada)</Label>
            </div>

            {financiada && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-primary/20">
                <div>
                  <Label>Acreedor *</Label>
                  <Input value={acreedor} onChange={e => setAcreedor(e.target.value)} placeholder="Ej: Banco Nación" />
                </div>
                <div>
                  <Label>Cantidad de cuotas</Label>
                  <Input type="number" value={cuotas} onChange={e => setCuotas(e.target.value)} />
                </div>
                <div>
                  <Label>Monto por cuota</Label>
                  <Input type="number" value={montoCuota} onChange={e => setMontoCuota(e.target.value)} />
                </div>
                <div>
                  <Label>Próximo pago</Label>
                  <Input type="date" value={fechaProximoPago} onChange={e => setFechaProximoPago(e.target.value)} />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSubmit} disabled={!nombre || !montoTotal || !mesesAmortizacion || (financiada && !acreedor)}>
                Guardar
              </Button>
              <Button variant="outline" onClick={() => { resetForm(); setShowForm(false); }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : inversiones.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No hay inversiones registradas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {inversiones.map(inv => {
            const amortMensual = getAmortizacionMensual(inv);
            const mesesTransc = getMesesTranscurridos(inv);
            const progreso = (mesesTransc / inv.meses_amortizacion) * 100;

            return (
              <Card key={inv.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="font-medium text-foreground truncate">{inv.nombre}</span>
                        {inv.categoria && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{inv.categoria}</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Total: ${inv.monto_total.toLocaleString()} · Amortización: ${Math.round(amortMensual).toLocaleString()}/mes</p>
                        <div className="flex items-center gap-2">
                          <Progress value={progreso} className="h-2 flex-1" />
                          <span className="text-xs whitespace-nowrap">{mesesTransc}/{inv.meses_amortizacion} meses</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => deleteInversion(inv.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
