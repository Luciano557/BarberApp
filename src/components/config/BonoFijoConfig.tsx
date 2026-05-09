import { useState, useEffect, useCallback } from 'react';
import { DollarSign, CalendarIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { RepeatPicker, getRepeatLabel } from '@/components/tareas/RepeatPicker';
import { CustomRepeatSheet, getCustomRepeatLabel } from '@/components/tareas/CustomRepeatSheet';

interface BonoFijoConfigProps {
  barberId: string;
  organizationId: string;
  sucursalId: string;
  forceShow?: boolean;
}

interface BonoConfig {
  id: string;
  monto: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  repeat_preset: string;
  repeat_frequency: string | null;
  repeat_interval: number | null;
  repeat_byweekday: number[] | null;
  proxima_fecha: string;
  activa: boolean;
}

export function BonoFijoConfig({ barberId, organizationId, sucursalId, forceShow }: BonoFijoConfigProps) {
  const [config, setConfig] = useState<BonoConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [monto, setMonto] = useState('');
  const [fechaInicio, setFechaInicio] = useState<Date | undefined>(new Date());
  const [fechaFin, setFechaFin] = useState<Date | undefined>(undefined);
  const [repeatPreset, setRepeatPreset] = useState('monthly');
  const [repeatFrequency, setRepeatFrequency] = useState('');
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatByweekday, setRepeatByweekday] = useState<number[]>([]);
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [showCustomRepeat, setShowCustomRepeat] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('bono_fijo_config')
        .select('*')
        .eq('barbero_id', barberId)
        .eq('organization_id', organizationId)
        .eq('activa', true)
        .maybeSingle();

      setConfig(data as BonoConfig | null);
    } catch (e) {
      console.error('Error loading bono fijo config:', e);
    } finally {
      setIsLoading(false);
    }
  }, [barberId, organizationId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  if (isLoading) return null;
  if (!config && !forceShow && !isEditing) return null;

  const resetForm = (cfg?: BonoConfig) => {
    if (cfg) {
      setMonto(String(cfg.monto));
      setFechaInicio(new Date(cfg.fecha_inicio + 'T12:00:00'));
      setFechaFin(cfg.fecha_fin ? new Date(cfg.fecha_fin + 'T12:00:00') : undefined);
      setRepeatPreset(cfg.repeat_preset);
      setRepeatFrequency(cfg.repeat_frequency || '');
      setRepeatInterval(cfg.repeat_interval || 1);
      setRepeatByweekday(cfg.repeat_byweekday || []);
    } else {
      setMonto('');
      setFechaInicio(new Date());
      setFechaFin(undefined);
      setRepeatPreset('monthly');
      setRepeatFrequency('');
      setRepeatInterval(1);
      setRepeatByweekday([]);
    }
  };

  const handleCreate = async () => {
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error('Ingresá un monto válido');
      return;
    }
    if (!fechaInicio) {
      toast.error('Seleccioná una fecha de inicio');
      return;
    }

    setIsSaving(true);
    try {
      const fechaInicioStr = format(fechaInicio, 'yyyy-MM-dd');
      const { error } = await supabase
        .from('bono_fijo_config')
        .insert({
          organization_id: organizationId,
          sucursal_id: sucursalId,
          barbero_id: barberId,
          monto: montoNum,
          fecha_inicio: fechaInicioStr,
          fecha_fin: fechaFin ? format(fechaFin, 'yyyy-MM-dd') : null,
          repeat_preset: repeatPreset,
          repeat_frequency: repeatPreset === 'custom' ? repeatFrequency : null,
          repeat_interval: repeatPreset === 'custom' ? repeatInterval : 1,
          repeat_byweekday: repeatPreset === 'custom' && repeatByweekday.length > 0 ? repeatByweekday : null,
          proxima_fecha: fechaInicioStr,
          activa: true,
        });

      if (error) throw error;
      toast.success('Bono fijo configurado');
      setIsEditing(false);
      fetchConfig();
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('uq_bono_fijo_activo_por_barbero')) {
        toast.error('Ya existe un bono fijo activo para este empleado');
      } else {
        toast.error(e.message || 'Error al crear bono fijo');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    resetForm(config || undefined);
    setIsEditing(true);
  };

  const handleUpdate = async () => {
    if (!config) return;
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error('Ingresá un monto válido');
      return;
    }
    if (!fechaInicio) {
      toast.error('Seleccioná una fecha de inicio');
      return;
    }

    setIsSaving(true);
    try {
      // Close current config
      const ayer = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
      await supabase
        .from('bono_fijo_config')
        .update({ activa: false, fecha_fin: ayer })
        .eq('id', config.id);

      // Create new config
      const fechaInicioStr = format(fechaInicio, 'yyyy-MM-dd');
      const { error } = await supabase
        .from('bono_fijo_config')
        .insert({
          organization_id: organizationId,
          sucursal_id: sucursalId,
          barbero_id: barberId,
          monto: montoNum,
          fecha_inicio: fechaInicioStr,
          fecha_fin: fechaFin ? format(fechaFin, 'yyyy-MM-dd') : null,
          repeat_preset: repeatPreset,
          repeat_frequency: repeatPreset === 'custom' ? repeatFrequency : null,
          repeat_interval: repeatPreset === 'custom' ? repeatInterval : 1,
          repeat_byweekday: repeatPreset === 'custom' && repeatByweekday.length > 0 ? repeatByweekday : null,
          proxima_fecha: fechaInicioStr,
          activa: true,
        });

      if (error) throw error;
      toast.success('Bono fijo actualizado');
      setIsEditing(false);
      fetchConfig();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error al actualizar bono fijo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!config) return;
    try {
      const hoy = format(new Date(), 'yyyy-MM-dd');
      await supabase
        .from('bono_fijo_config')
        .update({ activa: false, fecha_fin: hoy })
        .eq('id', config.id);

      toast.success('Bono fijo desactivado');
      setConfig(null);
    } catch (e) {
      toast.error('Error al desactivar');
    }
  };

  const getRecurrenciaLabel = () => {
    if (!config) return '';
    if (config.repeat_preset === 'custom') {
      return getCustomRepeatLabel(config.repeat_frequency, config.repeat_interval, config.repeat_byweekday);
    }
    return getRepeatLabel(config.repeat_preset);
  };

  const getFormRecurrenciaLabel = () => {
    if (repeatPreset === 'custom') {
      return getCustomRepeatLabel(repeatFrequency, repeatInterval, repeatByweekday);
    }
    return getRepeatLabel(repeatPreset);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(amount);

  // No config, show create button or form
  if (!config && !isEditing) {
    return (
      <div className="p-3 rounded-md border border-dashed border-border bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span>Bono fijo</span>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { resetForm(); setIsEditing(true); }}>
            Configurar
          </Button>
        </div>
      </div>
    );
  }

  // Editing form (create or update)
  if (isEditing) {
    return (
      <div className="p-3 rounded-md border border-border bg-muted/20 space-y-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Bono fijo</span>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Monto</Label>
            <CurrencyInput
              className="h-8 text-sm"
              placeholder="0"
              value={monto}
              onChange={setMonto}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Fecha de inicio</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal h-8 text-xs", !fechaInicio && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {fechaInicio ? format(fechaInicio, "dd/MM/yyyy", { locale: es }) : "Seleccionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={fechaInicio} onSelect={setFechaInicio} locale={es} className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Fecha de fin (opcional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal h-8 text-xs", !fechaFin && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {fechaFin ? format(fechaFin, "dd/MM/yyyy", { locale: es }) : "Sin fecha de fin"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={fechaFin} onSelect={setFechaFin} locale={es} className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
            {fechaFin && (
              <Button variant="ghost" size="sm" className="h-6 text-xs px-1 text-muted-foreground" onClick={() => setFechaFin(undefined)}>
                Quitar fecha de fin
              </Button>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Recurrencia</Label>
            <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal h-8 text-xs"
              onClick={() => setShowRepeatPicker(true)}>
              {getFormRecurrenciaLabel()}
            </Button>
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-7 text-xs flex-1" disabled={isSaving} onClick={config ? handleUpdate : handleCreate}>
              {isSaving ? 'Guardando...' : config ? 'Actualizar' : 'Guardar'}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>

        <RepeatPicker
          open={showRepeatPicker}
          onOpenChange={setShowRepeatPicker}
          value={repeatPreset}
          onChange={(v) => { setRepeatPreset(v); setRepeatFrequency(''); setRepeatByweekday([]); }}
          onCustom={() => setShowCustomRepeat(true)}
        />
        <CustomRepeatSheet
          open={showCustomRepeat}
          onOpenChange={setShowCustomRepeat}
          frequency={repeatFrequency || 'weekly'}
          interval={repeatInterval}
          byweekday={repeatByweekday}
          onConfirm={(freq, intv, days) => {
            setRepeatPreset('custom');
            setRepeatFrequency(freq);
            setRepeatInterval(intv);
            setRepeatByweekday(days);
          }}
        />
      </div>
    );
  }

  // Display active config
  return (
    <div className="p-3 rounded-md border border-border bg-muted/20 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Bono fijo</span>
        </div>
        <Switch checked={config!.activa} onCheckedChange={(checked) => { if (!checked) handleDeactivate(); }} />
      </div>

      <div className="text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Monto</span>
          <span className="font-medium">{formatCurrency(config!.monto)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Recurrencia</span>
          <span>{getRecurrenciaLabel()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Desde</span>
          <span>{format(new Date(config!.fecha_inicio + 'T12:00:00'), "dd/MM/yyyy", { locale: es })}</span>
        </div>
        {config!.fecha_fin && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hasta</span>
            <span>{format(new Date(config!.fecha_fin + 'T12:00:00'), "dd/MM/yyyy", { locale: es })}</span>
          </div>
        )}
      </div>

      <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={handleEdit}>
        Editar bono
      </Button>
    </div>
  );
}
