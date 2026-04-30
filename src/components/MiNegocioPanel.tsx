import { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal, Sucursal } from '@/contexts/SucursalContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { Barber } from '@/types/barbershop';
import { toast } from 'sonner';
import { SucursalTabContent } from './SucursalTabContent';

interface BarberWithSucursal extends Barber {
  sucursalId: string | null;
}

function dbToBarberWithSucursal(row: any): BarberWithSucursal {
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
    sucursalId: row.sucursal_id || null,
  };
}

interface MiNegocioPanelProps {
  onGoToGeneralConfig?: () => void;
}

export function MiNegocioPanel({ onGoToGeneralConfig }: MiNegocioPanelProps = {}) {
  const { organization } = useOrganization();
  const { currentSucursal, refreshSucursales } = useSucursal();
  const { isOwner, isGeneralManager, isManager, user } = useAuth();
  const {
    allServices, allExtras, discounts, allLines,
    addService, updateService, addExtra, updateExtra,
    addDiscount, updateDiscount, deleteDiscount, setDiscountActive, addLine, updateLine,
  } = useSupabaseData();

  const [allSucursales, setAllSucursales] = useState<Sucursal[]>([]);
  const [allBarbers, setAllBarbers] = useState<BarberWithSucursal[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', direccion: '', telefono: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [managerSucursalIds, setManagerSucursalIds] = useState<string[]>([]);

  const isManagerOnly = isManager && !isOwner && !isGeneralManager;
  const canCreateSucursal = isOwner || isGeneralManager;

  const fetchAllSucursales = useCallback(async () => {
    if (!organization?.id) return;
    const { data } = await supabase
      .from('sucursales')
      .select('*')
      .eq('organization_id', organization.id)
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
      .order('nombre');
    if (data) setAllBarbers(data.map(dbToBarberWithSucursal));
  }, [organization?.id]);

  // Fetch manager's assigned sucursales
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

  // Filter sucursales for managers
  const visibleSucursales = isManagerOnly
    ? allSucursales.filter(s => managerSucursalIds.includes(s.id))
    : allSucursales;

  // Default tab: use current sucursal from panel selector if it exists in visible list
  const defaultTabId = (currentSucursal && visibleSucursales.some(s => s.id === currentSucursal.id))
    ? currentSucursal.id
    : visibleSucursales[0]?.id;

  // --- Barber CRUD ---
  const addBarberToSucursal = useCallback(async (sucursalId: string, barber: Omit<Barber, 'id' | 'uid'>) => {
    if (!organization?.id) return;
    const { error } = await supabase.from('barberos').insert({
      nombre: barber.firstName.replace(/\s+/g, ' ').trim(),
      apellido: barber.lastName.replace(/\s+/g, ' ').trim(),
      telefono: barber.phone || null,
      dni: barber.dni || null,
      comision: barber.commission,
      activo: barber.active,
      organization_id: organization.id,
      sucursal_id: sucursalId,
      tipo_compensacion: barber.compensationType || 'comision',
      sueldo_fijo: barber.fixedSalary || null,
      rol_equipo: barber.teamRole || 'barbero',
    });
    if (error) { toast.error('Error al agregar barbero'); return; }
    toast.success('Barbero agregado');
    await fetchAllBarbers();
  }, [organization?.id, fetchAllBarbers]);

  const updateBarberFn = useCallback(async (id: string, updates: Partial<Barber>) => {
    const dbUpdates: any = {};
    if (updates.firstName !== undefined) dbUpdates.nombre = updates.firstName.replace(/\s+/g, ' ').trim();
    if (updates.lastName !== undefined) dbUpdates.apellido = updates.lastName.replace(/\s+/g, ' ').trim();
    if (updates.phone !== undefined) dbUpdates.telefono = updates.phone || null;
    if (updates.dni !== undefined) dbUpdates.dni = updates.dni || null;
    if (updates.commission !== undefined) dbUpdates.comision = updates.commission;
    if (updates.active !== undefined) dbUpdates.activo = updates.active;
    if (updates.compensationType !== undefined) dbUpdates.tipo_compensacion = updates.compensationType;
    if (updates.fixedSalary !== undefined) dbUpdates.sueldo_fijo = updates.fixedSalary || null;
    if (updates.teamRole !== undefined) dbUpdates.rol_equipo = updates.teamRole;

    const { error } = await supabase.from('barberos').update(dbUpdates).eq('id', id);
    if (error) { toast.error('Error al actualizar barbero'); return; }
    await fetchAllBarbers();
  }, [fetchAllBarbers]);

  // --- Sucursal CRUD ---
  const handleOpenCreate = () => {
    setFormData({ nombre: '', direccion: '', telefono: '' });
    setShowDialog(true);
  };

  const handleSaveSucursal = async () => {
    if (!organization?.id || !formData.nombre.trim()) return;
    setIsSaving(true);
    const { error } = await supabase.from('sucursales').insert({
      organization_id: organization.id,
      nombre: formData.nombre.trim(),
      direccion: formData.direccion || null,
      telefono: formData.telefono || null,
      timezone: organization.timezone,
    });
    if (error) {
      toast.error(error.message || 'Error al crear');
    } else {
      toast.success('Sucursal creada');
      setShowDialog(false);
      await fetchAllSucursales();
      await refreshSucursales();
    }
    setIsSaving(false);
  };

  // --- Helpers to scope catalog data by sucursal ---
  const getServicesForSucursal = (sucursalId: string) =>
    allServices.filter(s => s.sucursalId === sucursalId);

  const getExtrasForSucursal = (sucursalId: string) =>
    allExtras.filter(e => e.sucursalId === sucursalId);

  // Wrap add functions to inject sucursalId
  const addServiceForSucursal = useCallback((sucursalId: string) => {
    return (service: Parameters<typeof addService>[0]) => {
      return addService({ ...service, sucursalId });
    };
  }, [addService]);

  const addExtraForSucursal = useCallback((sucursalId: string) => {
    return (extra: Parameters<typeof addExtra>[0]) => {
      return addExtra({ ...extra, sucursalId });
    };
  }, [addExtra]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Gestionar Mi Negocio</h1>
        <div className="flex items-center justify-between mt-4">
          <div>
            <h2 className="text-lg font-medium text-foreground">Sucursales</h2>
            <p className="text-sm text-muted-foreground">Gestiona las sucursales de tu negocio</p>
          </div>
          {canCreateSucursal && (
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-1" /> Nueva sucursal
            </Button>
          )}
        </div>
      </div>

      {/* Tabs por sucursal */}
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
              <SucursalTabContent
                sucursal={s}
                barbers={allBarbers.filter(b => b.sucursalId === s.id)}
                allBarbers={allBarbers}
                allSucursales={allSucursales}
                services={getServicesForSucursal(s.id)}
                extras={getExtrasForSucursal(s.id)}
                discounts={getDiscountsForSucursal(s.id)}
                lines={allLines}
                onAddBarber={(barber) => addBarberToSucursal(s.id, barber)}
                onUpdateBarber={updateBarberFn}
                onAddService={addServiceForSucursal(s.id)}
                onUpdateService={updateService}
                onAddExtra={addExtraForSucursal(s.id)}
                onUpdateExtra={updateExtra}
                onAddDiscount={addDiscountForSucursal(s.id)}
                onUpdateDiscount={updateDiscount}
                onDeleteDiscount={deleteDiscount}
                onToggleDiscountActive={setDiscountActive}
                onAddLine={addLine}
                onUpdateLine={updateLine}
                onSucursalUpdated={() => { fetchAllSucursales(); refreshSucursales(); }}
                onGoToGeneralConfig={onGoToGeneralConfig}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {visibleSucursales.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {isManagerOnly ? 'No tenés sucursales asignadas.' : 'No hay sucursales. Creá una para empezar.'}
          </p>
        </div>
      )}

      {/* Crear sucursal */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva sucursal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={formData.nombre} onChange={(e) => setFormData(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Sucursal Centro" />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input value={formData.direccion} onChange={(e) => setFormData(p => ({ ...p, direccion: e.target.value }))} placeholder="Av. Corrientes 1234" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={formData.telefono} onChange={(e) => setFormData(p => ({ ...p, telefono: e.target.value }))} placeholder="+54 11 1234-5678" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveSucursal} disabled={isSaving || !formData.nombre.trim()}>
              {isSaving ? 'Guardando...' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
