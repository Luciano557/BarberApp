import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, CalendarRange, Banknote, CreditCard, TrendingUp, Receipt, Percent, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePinProtection } from '@/hooks/usePinProtection';
import { PinGateDialog } from './PinGateDialog';
import { toast } from 'sonner';
import { getStartOfDayLocal, getEndOfDayLocal } from '@/lib/dateUtils';

interface BarberRangeSummary {
  barberId: string;
  barberName: string;
  efectivo: number;
  mercadoPago: number;
  totalFacturado: number;
  comision: number;
  servicios: number;
}

export function MultiDayClosingSummary() {
  const [open, setOpen] = useState(false);
  const [desde, setDesde] = useState<Date | undefined>();
  const [hasta, setHasta] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BarberRangeSummary[] | null>(null);
  const [pinGateOpen, setPinGateOpen] = useState(false);
  const { organization } = useOrganization();
  const { requiresPin, validatePin } = usePinProtection();

  const handleOpen = useCallback(() => {
    if (requiresPin) {
      setPinGateOpen(true);
    } else {
      setOpen(true);
    }
  }, [requiresPin]);

  const handlePinValidate = useCallback(async (pin: string) => {
    const result = await validatePin(pin);
    if (result.success) {
      setPinGateOpen(false);
      setOpen(true);
    }
    return result;
  }, [validatePin]);

  const handleConsultar = useCallback(async () => {
    if (!desde || !hasta || !organization) return;

    setLoading(true);
    try {
      const tz = organization?.timezone || null;
      const startStr = getStartOfDayLocal(desde, tz);
      const endStr = getEndOfDayLocal(hasta, tz);

      const { data, error } = await supabase
        .from('ingresos')
        .select('barbero_id, barbero, efectivo, mp, total_facturado, sueldo, cantidad_de_servicios')
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .eq('organization_id', organization.id)
        .neq('estado', 'eliminado');

      if (error) throw error;

      const map = new Map<string, BarberRangeSummary>();
      (data || []).forEach(row => {
        const id = row.barbero_id || 'unknown';
        const existing = map.get(id);
        if (existing) {
          existing.efectivo += row.efectivo || 0;
          existing.mercadoPago += row.mp || 0;
          existing.totalFacturado += row.total_facturado || 0;
          existing.comision += row.sueldo || 0;
          existing.servicios += row.cantidad_de_servicios || 0;
        } else {
          map.set(id, {
            barberId: id,
            barberName: row.barbero || 'Desconocido',
            efectivo: row.efectivo || 0,
            mercadoPago: row.mp || 0,
            totalFacturado: row.total_facturado || 0,
            comision: row.sueldo || 0,
            servicios: row.cantidad_de_servicios || 0,
          });
        }
      });

      setResults(Array.from(map.values()).sort((a, b) => b.totalFacturado - a.totalFacturado));
    } catch (error) {
      console.error('Error fetching range summary:', error);
      toast.error('Error al consultar el rango');
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, organization]);

  const handleClose = () => {
    setOpen(false);
    setResults(null);
    setDesde(undefined);
    setHasta(undefined);
  };

  const totals = results?.reduce(
    (acc, r) => ({
      efectivo: acc.efectivo + r.efectivo,
      mercadoPago: acc.mercadoPago + r.mercadoPago,
      totalFacturado: acc.totalFacturado + r.totalFacturado,
      comision: acc.comision + r.comision,
      servicios: acc.servicios + r.servicios,
    }),
    { efectivo: 0, mercadoPago: 0, totalFacturado: 0, comision: 0, servicios: 0 }
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        <CalendarRange className="h-4 w-4 mr-2" />
        Resumen por rango
      </Button>

      <PinGateDialog
        open={pinGateOpen}
        onValidate={handlePinValidate}
        onClose={() => setPinGateOpen(false)}
        sectionName="resumen por rango"
      />

      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resumen por rango de fechas</DialogTitle>
            <DialogDescription>
              Seleccioná un rango de fechas para ver el resumen de cierres agrupado por barbero.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Desde</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !desde && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {desde ? format(desde, 'dd/MM/yyyy') : 'Fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={desde}
                    onSelect={setDesde}
                    locale={es}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Hasta</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !hasta && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {hasta ? format(hasta, 'dd/MM/yyyy') : 'Fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={hasta}
                    onSelect={setHasta}
                    locale={es}
                    disabled={(date) => date > new Date() || (desde ? date < desde : false)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button onClick={handleConsultar} disabled={!desde || !hasta || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Consultar
            </Button>
          </div>

          {results && results.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">No hay cierres en el rango seleccionado.</p>
          )}

          {results && results.length > 0 && (
            <div className="space-y-4 mt-4">
              {/* Totals card */}
              <Card className="border-2 border-primary/30 bg-primary/5">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm font-semibold text-primary mb-3">Totales generales</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-success" />
                      <div>
                        <p className="text-xs text-muted-foreground">Efectivo</p>
                        <p className="font-semibold text-foreground">${totals!.efectivo.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-secondary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Mercado Pago</p>
                        <p className="font-semibold text-foreground">${totals!.mercadoPago.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Facturado</p>
                        <p className="font-semibold text-foreground">${totals!.totalFacturado.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Comisiones</p>
                        <p className="font-semibold text-foreground">${totals!.comision.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Servicios</p>
                        <p className="font-semibold text-foreground">{totals!.servicios}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Per-barber cards */}
              {results.map(r => (
                <Card key={r.barberId} className="border border-border">
                  <CardContent className="pt-4 pb-4">
                    <p className="text-sm font-semibold text-foreground mb-3">{r.barberName}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Efectivo</p>
                        <p className="font-medium text-success">${r.efectivo.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Mercado Pago</p>
                        <p className="font-medium text-secondary">${r.mercadoPago.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Facturado</p>
                        <p className="font-medium text-foreground">${r.totalFacturado.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Comisión</p>
                        <p className="font-medium text-foreground">${r.comision.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Servicios</p>
                        <p className="font-medium text-foreground">{r.servicios}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
