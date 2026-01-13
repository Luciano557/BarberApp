import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { History, Calendar as CalendarIcon, User, Banknote, CreditCard, Filter, X, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Barber } from '@/types/barbershop';
import { toast } from 'sonner';

interface CashClosingRecord {
  id: number;
  created_at: string;
  barbero: string | null;
  mp: number | null;
  efectivo: number | null;
  total_facturado: number | null;
  cantidad_de_servicios: number | null;
  sueldo: number | null;
  dia: string | null;
  estado: string | null;
}

interface CashClosingHistoryProps {
  barbers: Barber[];
}

export function CashClosingHistory({ barbers }: CashClosingHistoryProps) {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<CashClosingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('ingresos')
        .select('id, created_at, barbero, mp, efectivo, total_facturado, cantidad_de_servicios, sueldo, dia, estado')
        .order('created_at', { ascending: false });

      if (selectedBarber !== 'all') {
        query = query.eq('barbero', selectedBarber);
      }

      if (startDate) {
        query = query.gte('created_at', format(startDate, 'yyyy-MM-dd') + 'T00:00:00.000Z');
      }

      if (endDate) {
        query = query.lte('created_at', format(endDate, 'yyyy-MM-dd') + 'T23:59:59.999Z');
      }

      const { data, error } = await query.limit(100);

      if (error) {
        console.error('Error fetching cash closing records:', error);
        toast.error('Error al cargar historial');
        return;
      }

      console.log('Cash closing records loaded:', data?.length || 0, 'records');
      setRecords(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchRecords();
    }
  }, [open, selectedBarber, startDate, endDate]);

  const clearFilters = () => {
    setSelectedBarber('all');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const handleAnular = async (record: CashClosingRecord) => {
    const { error } = await supabase
      .from('ingresos')
      .update({ estado: 'eliminado' })
      .eq('id', record.id);

    if (error) {
      console.error('Error anulando cierre:', error);
      toast.error('Error al anular el cierre de caja');
      return;
    }

    toast.success(`Cierre de ${record.barbero} anulado correctamente`);
    fetchRecords();
  };

  const handleRestaurar = async (record: CashClosingRecord) => {
    const { error } = await supabase
      .from('ingresos')
      .update({ estado: 'activo' })
      .eq('id', record.id);

    if (error) {
      console.error('Error restaurando cierre:', error);
      toast.error('Error al restaurar el cierre de caja');
      return;
    }

    toast.success(`Cierre de ${record.barbero} restaurado correctamente`);
    fetchRecords();
  };

  const hasFilters = selectedBarber !== 'all' || startDate || endDate;

  // Get unique barber names from records for filter dropdown
  const uniqueBarbers = Array.from(new Set(records.map(r => r.barbero).filter(Boolean))) as string[];
  const barberOptions = barbers.length > 0 
    ? barbers.map(b => `${b.firstName} ${b.lastName}`)
    : uniqueBarbers;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-2" />
          Historial
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Historial de Cierres de Caja
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filtros:</span>
          </div>
          
          <Select value={selectedBarber} onValueChange={setSelectedBarber}>
            <SelectTrigger className="w-[180px]">
              <User className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Todos los barberos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los barberos</SelectItem>
              {barberOptions.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="min-w-[130px]">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {startDate ? format(startDate, 'dd/MM/yy') : 'Desde'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                locale={es}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="min-w-[130px]">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {endDate ? format(endDate, 'dd/MM/yy') : 'Hasta'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                locale={es}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
          )}
        </div>

        {/* Records List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Cargando...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Sin registros</p>
              <p className="text-sm mt-1">No se encontraron cierres de caja</p>
            </div>
          ) : (
            records.map((record) => (
              <Card key={record.id} className="border border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {record.barbero?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{record.barbero || 'Sin barbero'}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {record.dia} • {format(new Date(record.created_at), "d 'de' MMMM yyyy", { locale: es })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={record.estado === 'activo' ? 'default' : 'secondary'}>
                        {record.estado || 'activo'}
                      </Badge>
                      {record.estado === 'eliminado' ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary">
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Restaurar cierre de caja?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción restaurará el cierre de {record.barbero} del {format(new Date(record.created_at), "d 'de' MMMM", { locale: es })} y volverá a contabilizarse.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRestaurar(record)}>
                                Restaurar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Anular cierre de caja?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción marcará el cierre de {record.barbero} del {format(new Date(record.created_at), "d 'de' MMMM", { locale: es })} como eliminado. El registro no se borrará pero ya no se contabilizará.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleAnular(record)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Anular
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Banknote className="h-3 w-3" />
                        Efectivo
                      </p>
                      <p className="font-semibold text-success">${(record.efectivo || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        Mercado Pago
                      </p>
                      <p className="font-semibold text-secondary">${(record.mp || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-semibold text-foreground">${(record.total_facturado || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Comisión</p>
                      <p className="font-semibold text-primary">${(record.sueldo || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
