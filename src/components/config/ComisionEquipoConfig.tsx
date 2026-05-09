import { useState, useEffect, useCallback } from 'react';
import { Users, Percent, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Barber, getBarberDisplayName } from '@/types/barbershop';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ComisionEquipoConfigProps {
  barberId: string;
  organizationId: string;
  sucursalId: string;
  allBarbers: Barber[];
  forceShow?: boolean;
}

interface Config {
  id: string;
  activa: boolean;
  scope_type: string;
  sucursal_id: string | null;
}

interface Regla {
  id: string;
  barbero_origen_id: string;
  porcentaje: number;
  vigencia_desde: string;
  vigencia_hasta: string | null;
  activa: boolean;
}

function mapDbBarber(row: any): Barber {
  return {
    id: row.id,
    uid: row.id,
    firstName: row.nombre,
    lastName: row.apellido,
    phone: row.telefono || '',
    commission: Number(row.comision) || 0,
    compensationType: row.tipo_compensacion as any,
    fixedSalary: row.sueldo_fijo ? Number(row.sueldo_fijo) : undefined,
    teamRole: row.rol_equipo as any,
    payDay: row.fecha_cobro_dia,
    address: undefined,
    dni: row.dni || undefined,
    active: row.activo,
  };
}

export function ComisionEquipoConfig({ barberId, organizationId, sucursalId, allBarbers, forceShow }: ComisionEquipoConfigProps) {
  const [config, setConfig] = useState<Config | null>(null);
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [filteredBarbers, setFilteredBarbers] = useState<Barber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBarbero, setSelectedBarbero] = useState('');
  const [newPorcentaje, setNewPorcentaje] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const openRuleBarberIds = reglas.filter(r => r.activa && !r.vigencia_hasta).map(r => r.barbero_origen_id);
  const availableBarbers = filteredBarbers.filter(b => b.active && b.id !== barberId && !openRuleBarberIds.includes(b.id));

  const fetchFilteredBarbers = useCallback(async (scopeType: string, configSucursalId: string | null) => {
    let query = supabase
      .from('barberos')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('activo', true)
      .neq('id', barberId);

    if (scopeType === 'branch_only') {
      const sId = configSucursalId || sucursalId;
      query = query.eq('sucursal_id', sId);
    }

    const { data } = await query;
    setFilteredBarbers((data || []).map(mapDbBarber));
  }, [organizationId, barberId, sucursalId]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: configData } = await supabase
        .from('comision_equipo_config')
        .select('id, activa, scope_type, sucursal_id')
        .eq('encargado_id', barberId)
        .eq('organization_id', organizationId)
        .limit(1)
        .maybeSingle();

      setConfig(configData);

      if (configData) {
        const { data: reglasData } = await supabase
          .from('comision_equipo_reglas')
          .select('id, barbero_origen_id, porcentaje, vigencia_desde, vigencia_hasta, activa')
          .eq('config_id', configData.id)
          .eq('activa', true)
          .is('vigencia_hasta', null)
          .order('created_at', { ascending: false });

        setReglas(reglasData || []);
        await fetchFilteredBarbers(configData.scope_type, configData.sucursal_id);
      } else {
        setReglas([]);
        setFilteredBarbers([]);
      }
    } catch (e) {
      console.error('Error loading comision equipo config:', e);
    } finally {
      setIsLoading(false);
    }
  }, [barberId, organizationId, fetchFilteredBarbers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (isLoading) return null;
  if (!config && !forceShow) return null;

  const handleCreateConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('comision_equipo_config')
        .insert({
          encargado_id: barberId,
          organization_id: organizationId,
          scope_type: 'branch_only',
          sucursal_id: sucursalId,
          activa: true,
        })
        .select('id, activa, scope_type, sucursal_id')
        .single();

      if (error) throw error;
      setConfig(data);
      await fetchFilteredBarbers(data.scope_type, data.sucursal_id);
      toast.success('Comisión extra por equipo activada');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error al crear configuración');
    }
  };

  const handleToggleConfig = async (activa: boolean) => {
    if (!config) return;
    try {
      const { error } = await supabase
        .from('comision_equipo_config')
        .update({ activa })
        .eq('id', config.id);

      if (error) throw error;
      setConfig(prev => prev ? { ...prev, activa } : null);
      toast.success(activa ? 'Comisión activada' : 'Comisión desactivada');
    } catch (e) {
      toast.error('Error al actualizar');
    }
  };

  const handleAddRegla = async () => {
    if (!config || !selectedBarbero || !newPorcentaje) return;
    const porcentaje = parseFloat(newPorcentaje);
    if (isNaN(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
      toast.error('Porcentaje debe ser entre 0.01 y 100');
      return;
    }

    try {
      const { error } = await supabase
        .from('comision_equipo_reglas')
        .insert({
          config_id: config.id,
          barbero_origen_id: selectedBarbero,
          porcentaje,
          organization_id: organizationId,
          sucursal_id: sucursalId,
          vigencia_desde: format(new Date(), 'yyyy-MM-dd'),
        });

      if (error) throw error;
      setSelectedBarbero('');
      setNewPorcentaje('');
      toast.success('Regla agregada');
      fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error al agregar regla');
    }
  };

  const handleBulkAdd = async () => {
    if (!config || !newPorcentaje || availableBarbers.length === 0) return;
    const porcentaje = parseFloat(newPorcentaje);
    if (isNaN(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
      toast.error('Ingresá un porcentaje válido antes de agregar todos');
      return;
    }

    setBulkLoading(true);
    try {
      const hoy = format(new Date(), 'yyyy-MM-dd');
      const rows = availableBarbers.map(b => ({
        config_id: config.id,
        barbero_origen_id: b.id,
        porcentaje,
        organization_id: organizationId,
        sucursal_id: sucursalId,
        vigencia_desde: hoy,
      }));

      const { error } = await supabase
        .from('comision_equipo_reglas')
        .insert(rows);

      if (error) throw error;
      setNewPorcentaje('');
      toast.success(`${rows.length} barberos agregados`);
      fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error al agregar barberos');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleUpdatePorcentaje = async (regla: Regla, newValue: string) => {
    const porcentaje = parseFloat(newValue);
    if (isNaN(porcentaje) || porcentaje <= 0 || porcentaje > 100) return;
    if (porcentaje === regla.porcentaje) return;
    if (!config) return;

    const hoy = format(new Date(), 'yyyy-MM-dd');
    const ayer = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');

    try {
      await supabase
        .from('comision_equipo_reglas')
        .update({ vigencia_hasta: ayer })
        .eq('id', regla.id);

      const { error } = await supabase
        .from('comision_equipo_reglas')
        .insert({
          config_id: config.id,
          barbero_origen_id: regla.barbero_origen_id,
          porcentaje,
          organization_id: organizationId,
          sucursal_id: sucursalId,
          vigencia_desde: hoy,
        });

      if (error) throw error;
      toast.success('Porcentaje actualizado');
      fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error al actualizar porcentaje');
    }
  };

  const handleRemoveRegla = async (regla: Regla) => {
    const hoy = format(new Date(), 'yyyy-MM-dd');
    try {
      await supabase
        .from('comision_equipo_reglas')
        .update({ vigencia_hasta: hoy, activa: false })
        .eq('id', regla.id);

      toast.success('Barbero removido de la comisión');
      fetchData();
    } catch (e) {
      toast.error('Error al remover');
    }
  };

  if (!config) {
    return (
      <div className="p-3 rounded-md border border-dashed border-border bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>Comisión extra por equipo</span>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCreateConfig}>
            Activar
          </Button>
        </div>
      </div>
    );
  }

  const isBranchOnly = config.scope_type === 'branch_only';

  return (
    <div className="p-3 rounded-md border border-border bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Comisión extra por equipo</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={config.activa} onCheckedChange={handleToggleConfig} />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => setShowDelete(true)}
            aria-label="Eliminar extra"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {config.activa && (
        <>
          {reglas.length > 0 && (
            <div className="space-y-2">
              {reglas.map(regla => {
                const barberOrigen = allBarbers.find(b => b.id === regla.barbero_origen_id)
                  || filteredBarbers.find(b => b.id === regla.barbero_origen_id);
                return (
                  <div key={regla.id} className="flex items-center justify-between gap-2 p-2 rounded bg-background border border-border">
                    <span className="text-sm truncate">
                      {barberOrigen ? getBarberDisplayName(barberOrigen) : 'Barbero eliminado'}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          className="w-16 h-7 text-xs text-right"
                          defaultValue={regla.porcentaje}
                          min={0.01}
                          max={100}
                          step={0.5}
                          onBlur={(e) => handleUpdatePorcentaje(regla, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdatePorcentaje(regla, (e.target as HTMLInputElement).value);
                            }
                          }}
                        />
                        <Percent className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveRegla(regla)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {availableBarbers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Select value={selectedBarbero} onValueChange={setSelectedBarbero}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Seleccionar barbero" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBarbers.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {getBarberDisplayName(b)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    className="w-16 h-8 text-xs text-right"
                    placeholder="%"
                    value={newPorcentaje}
                    onChange={(e) => setNewPorcentaje(e.target.value)}
                    min={0.01}
                    max={100}
                    step={0.5}
                  />
                  <Percent className="h-3 w-3 text-muted-foreground" />
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs"
                  disabled={!selectedBarbero || !newPorcentaje}
                  onClick={handleAddRegla}>
                  Agregar
                </Button>
              </div>

              {isBranchOnly && availableBarbers.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs w-full"
                  disabled={!newPorcentaje || bulkLoading}
                  onClick={handleBulkAdd}
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                  Agregar todos los barberos de esta sucursal ({availableBarbers.length})
                </Button>
              )}
            </div>
          )}

          {reglas.length === 0 && availableBarbers.length === 0 && (
            <p className="text-xs text-muted-foreground">No hay barberos disponibles para asignar.</p>
          )}
        </>
      )}

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar comisión extra por equipo</AlertDialogTitle>
            <AlertDialogDescription>
              Se desactiva el extra a partir de hoy. No se modifican cierres ni pagos históricos. Podés volver a configurarlo más adelante.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowDelete(false);
                await handleToggleConfig(false);
                setConfig(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
