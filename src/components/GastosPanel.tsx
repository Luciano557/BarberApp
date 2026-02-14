import { useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Receipt, Trash2, ChevronLeft, ChevronRight, Plus, Webhook, Copy, Check } from 'lucide-react';
import { useGastos } from '@/hooks/useGastos';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { toast } from 'sonner';

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

  const { organization } = useOrganization();

  const [categoria, setCategoria] = useState('');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const webhookUrl = `https://azqpyfoobpovqosbayvz.supabase.co/functions/v1/gastos-webhook`;

  const jsonExample = organization ? JSON.stringify({
    organization_id: organization.id,
    categoria: "Insumos",
    monto: 15000,
    descripcion: "Compra de productos",
    fecha: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss")
  }, null, 2) : '';

  const jsonArrayExample = organization ? JSON.stringify([
    {
      organization_id: organization.id,
      categoria: "Alquiler",
      monto: 200000,
      descripcion: "Alquiler mensual",
      fecha: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss")
    },
    {
      organization_id: organization.id,
      categoria: "Servicios",
      monto: 45000,
      descripcion: "Luz + Internet",
      fecha: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss")
    }
  ], null, 2) : '';

  const curlExample = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '${organization ? JSON.stringify({ organization_id: organization.id, categoria: "Insumos", monto: 15000, descripcion: "Compra de productos" }) : ''}'`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success('Copiado al portapapeles');
    setTimeout(() => setCopied(null), 2000);
  };

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

      {/* Webhook Section - Collapsible */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between border-dashed">
            <div className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-primary" />
              <span>Opciones avanzadas</span>
            </div>
            <ChevronRight className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Webhook — Carga automática</CardTitle>
          <CardDescription>
            Envía gastos automáticamente desde sistemas externos (n8n, Make, Zapier, etc.) mediante una petición POST.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">URL del Webhook</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded-md text-sm font-mono break-all">
                {webhookUrl}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="flex-shrink-0"
                onClick={() => copyToClipboard(webhookUrl, 'url')}
              >
                {copied === 'url' ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Single JSON */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">JSON — Un gasto</Label>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyToClipboard(jsonExample, 'single')}>
                {copied === 'single' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                Copiar
              </Button>
            </div>
            <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto whitespace-pre">
              {jsonExample}
            </pre>
          </div>

          {/* Array JSON */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">JSON — Múltiples gastos</Label>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyToClipboard(jsonArrayExample, 'array')}>
                {copied === 'array' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                Copiar
              </Button>
            </div>
            <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto whitespace-pre">
              {jsonArrayExample}
            </pre>
          </div>

          {/* cURL */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ejemplo cURL</Label>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyToClipboard(curlExample, 'curl')}>
                {copied === 'curl' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                Copiar
              </Button>
            </div>
            <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto whitespace-pre">
              {curlExample}
            </pre>
          </div>

          {/* Campos */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campos</Label>
            <div className="bg-muted rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-3 py-2 font-semibold">Campo</th>
                    <th className="text-left px-3 py-2 font-semibold">Tipo</th>
                    <th className="text-left px-3 py-2 font-semibold">Requerido</th>
                    <th className="text-left px-3 py-2 font-semibold">Descripción</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr className="border-b border-border/50">
                    <td className="px-3 py-1.5">organization_id</td>
                    <td className="px-3 py-1.5">string (UUID)</td>
                    <td className="px-3 py-1.5 text-destructive font-semibold">Sí</td>
                    <td className="px-3 py-1.5 font-sans">ID de tu organización</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="px-3 py-1.5">monto</td>
                    <td className="px-3 py-1.5">number</td>
                    <td className="px-3 py-1.5 text-destructive font-semibold">Sí</td>
                    <td className="px-3 py-1.5 font-sans">Monto del gasto</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="px-3 py-1.5">categoria</td>
                    <td className="px-3 py-1.5">string</td>
                    <td className="px-3 py-1.5 text-muted-foreground">No</td>
                    <td className="px-3 py-1.5 font-sans">Default: "Otros"</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="px-3 py-1.5">descripcion</td>
                    <td className="px-3 py-1.5">string</td>
                    <td className="px-3 py-1.5 text-muted-foreground">No</td>
                    <td className="px-3 py-1.5 font-sans">Detalle del gasto</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5">fecha</td>
                    <td className="px-3 py-1.5">string (ISO)</td>
                    <td className="px-3 py-1.5 text-muted-foreground">No</td>
                    <td className="px-3 py-1.5 font-sans">Default: fecha actual</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
