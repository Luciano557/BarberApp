import { useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Receipt, Trash2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useGastos } from '@/hooks/useGastos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';

const CATEGORIAS = [
  'Alquiler',
  'Servicios',
  'Insumos',
  'Impuestos',
  'Sueldos fijos',
  'Marketing',
  'Mantenimiento',
  'Otros',
];

export function GastosPanel() {
  const { gastos, isLoading, selectedMonth, setSelectedMonth, addGasto, deleteGasto, totalPeriodo } = useGastos();

  const [categoria, setCategoria] = useState('');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoria || !monto) return;

    setSubmitting(true);
    const success = await addGasto({
      categoria,
      monto: parseFloat(monto),
      descripcion,
      fecha: new Date(fecha + 'T12:00:00'),
    });

    if (success) {
      setCategoria('');
      setMonto('');
      setDescripcion('');
      setFecha(format(new Date(), 'yyyy-MM-dd'));
    }
    setSubmitting(false);
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
              <Label>Categoría *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Monto *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha</Label>
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

            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting || !categoria || !monto}>
                <Plus className="h-4 w-4 mr-2" />
                {submitting ? 'Registrando...' : 'Registrar gasto'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
                        onClick={() => deleteGasto(g.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold">Total del período</TableCell>
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
    </div>
  );
}
