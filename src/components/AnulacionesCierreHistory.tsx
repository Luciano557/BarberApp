import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, User, Clock, FileX, MessageSquare, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DrawerForm } from '@/components/ui/drawer-form';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Barber } from '@/types/barbershop';

interface AnulacionRecord {
  id: string;
  ingreso_id: number;
  barbero_nombre: string;
  fecha_cierre: string;
  anulado_por_nombre: string;
  anulado_por_email: string;
  anulado_at: string;
  motivo: string | null;
}

interface AnulacionesCierreHistoryProps {
  barbers: Barber[];
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function AnulacionesCierreHistory({ barbers, externalOpen, onExternalOpenChange }: AnulacionesCierreHistoryProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onExternalOpenChange || setInternalOpen;
  const [records, setRecords] = useState<AnulacionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const { organization } = useOrganization();

  const fetchRecords = async () => {
    if (!organization?.id) return;

    setIsLoading(true);
    let query = supabase
      .from('anulaciones_cierre')
      .select('*')
      .eq('organization_id', organization.id)
      .order('anulado_at', { ascending: false });

    if (selectedBarber && selectedBarber !== 'all') {
      query = query.eq('barbero_nombre', selectedBarber);
    }

    if (startDate) {
      query = query.gte('fecha_cierre', format(startDate, 'yyyy-MM-dd'));
    }

    if (endDate) {
      query = query.lte('fecha_cierre', format(endDate, 'yyyy-MM-dd'));
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching anulaciones:', error);
    } else {
      setRecords(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchRecords();
    }
  }, [open, selectedBarber, startDate, endDate, organization?.id]);

  const clearFilters = () => {
    setSelectedBarber('all');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const hasActiveFilters = selectedBarber !== 'all' || startDate || endDate;

  const barberOptions = Array.from(new Set(barbers.map(b => `${b.firstName} ${b.lastName}`)));

  return (
    <>
      {externalOpen === undefined && (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
          <FileX className="h-4 w-4" />
          Anulaciones
        </Button>
      )}

      <DrawerForm
        open={open}
        onOpenChange={setOpen}
        title="Historial de anulaciones de cierre"
        size="md"
        footer={
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        }
      >
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pb-4 border-b">
          <Select value={selectedBarber} onValueChange={setSelectedBarber}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos los barberos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los barberos</SelectItem>
              {barberOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {startDate ? format(startDate, 'dd/MM/yyyy') : 'Desde'}
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
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {endDate ? format(endDate, 'dd/MM/yyyy') : 'Hasta'}
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

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar
            </Button>
          )}
        </div>

        {/* Records List */}
        <div className="space-y-3 pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
              <FileX className="h-8 w-8 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium">Todavía no hay anulaciones registradas.</p>
                <p className="text-xs text-muted-foreground mt-1">Las anulaciones de cierres de caja aparecerán aquí.</p>
              </div>
            </div>
          ) : (
            records.map((record) => (
              <Card key={record.id} className="border border-destructive/20 bg-destructive/5">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-destructive">
                            {record.barbero_nombre.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-semibold text-foreground">{record.barbero_nombre}</span>
                        {record.motivo?.startsWith('Se registraron ventas después del cierre') && (
                          <Badge variant="category" color="default">Regularización</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        Cierre del {format(new Date(record.fecha_cierre), "d 'de' MMMM yyyy", { locale: es })}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground flex items-center gap-1 justify-end">
                        <User className="h-3.5 w-3.5" />
                        {record.anulado_por_nombre}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1 justify-end">
                        <Clock className="h-3.5 w-3.5" />
                        {format(new Date(record.anulado_at), "dd/MM/yyyy HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>
                  {record.motivo && (
                    <div className="mt-3 pt-3 border-t border-destructive/20">
                      <p className="text-sm text-foreground flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                        <span>
                          <span className="font-medium text-destructive">Motivo:</span>{' '}
                          {record.motivo}
                        </span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DrawerForm>
    </>
  );
}
