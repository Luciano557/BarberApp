import { useState, useEffect, useCallback } from 'react';
import { Building2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal, Sucursal } from '@/contexts/SucursalContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Barber } from '@/types/barbershop';
import { AgendaManagement } from './config/AgendaManagement';
import { useBarberosSucursalesRealtime } from '@/hooks/useBarberosSucursalesRealtime';

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
    rolesEquipo: row.roles_equipo || [],
    dni: row.dni || undefined,
    active: row.activo,
  };
}

export function TurnosAgendaPanel() {
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const { isOwner, isGeneralManager, isManager, isBarber, user } = useAuth();

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
      .is('deleted_at', null)
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
    // Barbers read teammates via the safe view (no PII/salary/PIN exposure).
    // Owner/GM/Manager keep direct access to barberos for full fields.
    if (isBarber && !isOwner && !isGeneralManager && !isManager) {
      const { data } = await supabase
        .from('barberos_safe')
        .select('id, nombre, apellido, activo, organization_id, sucursal_id, rol_equipo, roles_equipo')
        .eq('organization_id', organization.id)
        .eq('activo', true)
        .order('nombre');
      if (data) setAllBarbers(data.map(r => ({ ...dbToBarber(r), sucursalId: r.sucursal_id })));
      return;
    }
    const { data } = await supabase
      .from('barberos')
      .select('*')
      .eq('organization_id', organization.id)
      .eq('activo', true)
      .order('nombre');
    if (data) setAllBarbers(data.map(r => ({ ...dbToBarber(r), sucursalId: r.sucursal_id })));
  }, [organization?.id, isBarber, isOwner, isGeneralManager, isManager]);

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

  // Realtime: refrescar lista de barberos cuando cambia su disponibilidad en cualquier sucursal de la org.
  useBarberosSucursalesRealtime({
    orgId: organization?.id ?? null,
    sucursalId: null,
    onChange: () => { void fetchAllBarbers(); },
  });

  const visibleSucursales = isManagerOnly
    ? allSucursales.filter(s => managerSucursalIds.includes(s.id))
    : allSucursales;

  const defaultTabId = (currentSucursal && visibleSucursales.some(s => s.id === currentSucursal.id))
    ? currentSucursal.id
    : visibleSucursales[0]?.id;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Turnos" subtitle="Configurá horarios, disponibilidad y bloqueos" />

      {visibleSucursales.length > 0 && (
        <Tabs defaultValue={defaultTabId} className="w-full">
          {visibleSucursales.length > 1 && (
            <TabsList variant="underline" className="flex-wrap">
              {visibleSucursales.map(s => (
                <TabsTrigger key={s.id} value={s.id} variant="underline">
                  <Building2 className="h-4 w-4" />
                  {s.nombre}
                </TabsTrigger>
              ))}
            </TabsList>
          )}
          {visibleSucursales.map(s => (
            <TabsContent key={s.id} value={s.id} className="mt-4 sm:mt-6">
              <AgendaManagement
                sucursalId={s.id}
                organizationId={organization?.id || ''}
                barbers={allBarbers.filter(b => {
                  if (b.sucursalId !== s.id) return false;
                  return (b.rolesEquipo ?? []).includes('barber');
                })}
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
