import { useState, useEffect, useCallback } from 'react';
import { CalendarClock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal, Sucursal } from '@/contexts/SucursalContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Barber } from '@/types/barbershop';
import { AgendaManagement } from './config/AgendaManagement';

function dbToBarber(row: any): Barber {
  return {
    id: row.id,
    uid: row.id,
    firstName: row.nombre,
    lastName: row.apellido,
    phone: row.telefono || '',
    commission: Number(row.comision) || 0,
    compensationType: row.tipo_compensacion || 'comision',
    fixedSalary: row.sueldo_fijo != null ? Number(row.sueldo_fijo) : undefined,
    teamRole: row.rol_equipo || 'barbero',
    dni: row.dni || undefined,
    active: row.activo,
  };
}

export function TurnosAgendaPanel() {
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const { isOwner, isGeneralManager, isManager, user } = useAuth();

  const [allSucursales, setAllSucursales] = useState<Sucursal[]>([]);
  const [allBarbers, setAllBarbers] = useState<(Barber & { sucursalId: string | null })[]>([]);
  const [managerSucursalIds, setManagerSucursalIds] = useState<string[]>([]);

  const isManagerOnly = isManager && !isOwner && !isGeneralManager;

  const fetchAllSucursales = useCallback(async () => {
    if (!organization?.id) return;
    const { data } = await supabase
      .from('sucursales')
      .select('*')
      .eq('organization_id', organization.id)
      .eq('activa', true)
      .order('nombre');
    if (data) {
      setAllSucursales(data.map(s => ({
        id: s.id, organization_id: s.organization_id, nombre: s.nombre,
        direccion: s.direccion, telefono: s.telefono, timezone: s.timezone, activa: s.activa,
      })));
    }
  }, [organization?.id]);

  const fetchAllBarbers = useCallback(async () => {
    if (!organization?.id) return;
    const { data } = await supabase
      .from('barberos')
      .select('*')
      .eq('organization_id', organization.id)
      .eq('activo', true)
      .order('nombre');
    if (data) setAllBarbers(data.map(r => ({ ...dbToBarber(r), sucursalId: r.sucursal_id })));
  }, [organization?.id]);

  const fetchManagerSucursales = useCallback(async () => {
    if (!isManagerOnly || !user?.id) return;
    const { data } = await supabase
      .from('user_sucursales')
      .select('sucursal_id')
      .eq('user_id', user.id);
    if (data) setManagerSucursalIds(data.map(d => d.sucursal_id));
  }, [isManagerOnly, user?.id]);

  useEffect(() => {
    fetchAllSucursales();
    fetchAllBarbers();
    fetchManagerSucursales();
  }, [fetchAllSucursales, fetchAllBarbers, fetchManagerSucursales]);

  const visibleSucursales = isManagerOnly
    ? allSucursales.filter(s => managerSucursalIds.includes(s.id))
    : allSucursales;

  const defaultTabId = (currentSucursal && visibleSucursales.some(s => s.id === currentSucursal.id))
    ? currentSucursal.id
    : visibleSucursales[0]?.id;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarClock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Turnos y Agenda</h1>
            <p className="text-sm text-muted-foreground">Configurá horarios, disponibilidad y bloqueos</p>
          </div>
        </div>
      </div>

      {visibleSucursales.length > 0 && (
        <Tabs defaultValue={defaultTabId} className="w-full">
          {visibleSucursales.length > 1 && (
            <TabsList className="w-full h-10 bg-muted p-1 rounded-lg">
              {visibleSucursales.map(s => (
                <TabsTrigger key={s.id} value={s.id} className="flex-1 text-sm data-[state=active]:bg-card rounded-md">
                  {s.nombre}
                </TabsTrigger>
              ))}
            </TabsList>
          )}
          {visibleSucursales.map(s => (
            <TabsContent key={s.id} value={s.id}>
              <AgendaManagement
                sucursalId={s.id}
                organizationId={organization?.id || ''}
                barbers={allBarbers.filter(b => b.sucursalId === s.id)}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {visibleSucursales.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {isManagerOnly ? 'No tenés sucursales asignadas.' : 'No hay sucursales activas.'}
          </p>
        </div>
      )}
    </div>
  );
}
