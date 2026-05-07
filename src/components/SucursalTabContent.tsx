import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Edit2, Save, X, Building2, Power, AlertTriangle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Sucursal } from '@/contexts/SucursalContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Barber, Service, Extra, Discount, Line } from '@/types/barbershop';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EquipoUnificado } from './config/EquipoUnificado';
import { CobrarConfig } from './config/CobrarConfig';
import { PaymentMethodsConfig } from './config/PaymentMethodsConfig';

interface SucursalTabContentProps {
  sucursal: Sucursal;
  barbers: Barber[];
  allBarbers: Barber[];
  allSucursales?: Sucursal[];
  services: Service[];
  extras: Extra[];
  discounts: Discount[];
  lines: Line[];
  onAddBarber: (barber: Omit<Barber, 'id' | 'uid'>) => void;
  onUpdateBarber: (id: string, updates: Partial<Barber>) => void;
  onRefreshBarbers?: () => Promise<void> | void;
  onAddService: (service: Omit<Service, 'id' | 'uid'>) => void;
  onUpdateService: (id: string, updates: Partial<Service>) => void;
  onAddExtra: (extra: Omit<Extra, 'id' | 'uid'>) => void;
  onUpdateExtra: (id: string, updates: Partial<Extra>) => void;
  onAddDiscount: (discount: Omit<Discount, 'id'>) => void;
  onUpdateDiscount: (id: string, updates: Partial<Discount>) => void;
  onDeleteDiscount: (id: string) => void;
  onToggleDiscountActive?: (id: string, activo: boolean) => void;
  onAddLine: (line: Omit<Line, 'id'>) => Promise<Line | null>;
  onUpdateLine: (id: string, updates: Partial<Line>) => void;
  onSucursalUpdated: () => void;
  onGoToGeneralConfig?: () => void;
}

export function SucursalTabContent({
  sucursal, barbers, allBarbers, allSucursales = [],
  services, extras, discounts, lines,
  onAddBarber, onUpdateBarber, onRefreshBarbers,
  onAddService, onUpdateService,
  onAddExtra, onUpdateExtra,
  onAddDiscount, onUpdateDiscount, onDeleteDiscount, onToggleDiscountActive,
  onAddLine, onUpdateLine,
  onSucursalUpdated,
  onGoToGeneralConfig,
}: SucursalTabContentProps) {
  const { organization } = useOrganization();

  // --- Info editing ---
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    nombre: sucursal.nombre,
    direccion: sucursal.direccion || '',
    telefono: sucursal.telefono || '',
  });
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);

  useEffect(() => {
    setInfoForm({
      nombre: sucursal.nombre,
      direccion: sucursal.direccion || '',
      telefono: sucursal.telefono || '',
    });
    setIsEditingInfo(false);
  }, [sucursal.id]);

  const handleSaveInfo = async () => {
    setIsSavingInfo(true);
    const { error } = await supabase
      .from('sucursales')
      .update({
        nombre: infoForm.nombre.trim(),
        direccion: infoForm.direccion || null,
        telefono: infoForm.telefono || null,
      })
      .eq('id', sucursal.id);
    if (error) {
      toast.error('Error al guardar');
    } else {
      toast.success('Sucursal actualizada');
      setIsEditingInfo(false);
      onSucursalUpdated();
    }
    setIsSavingInfo(false);
  };

  const handleToggleActive = async () => {
    setIsTogglingActive(true);
    const newState = !sucursal.activa;
    const { error } = await supabase
      .from('sucursales')
      .update({ activa: newState })
      .eq('id', sucursal.id);
    if (error) {
      toast.error('Error al cambiar el estado');
    } else {
      toast.success(newState ? 'Sucursal activada' : 'Sucursal desactivada');
      onSucursalUpdated();
    }
    setIsTogglingActive(false);
  };

  const isInactive = !sucursal.activa;

  return (
    <div className="space-y-6 mt-6">
      {/* Información de la sucursal */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-base">Información de la sucursal</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {!isEditingInfo && (
                <Button variant="outline" size="sm" onClick={() => setIsEditingInfo(true)}>
                  <Edit2 className="h-4 w-4 mr-1" /> Editar
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={isInactive ? '' : 'text-destructive border-destructive/30 hover:bg-destructive/10'}
                    disabled={isTogglingActive}
                  >
                    <Power className="h-4 w-4 mr-1" />
                    {isInactive ? 'Activar' : 'Desactivar'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {isInactive ? 'Activar sucursal' : 'Desactivar sucursal'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {isInactive
                        ? `¿Querés volver a activar "${sucursal.nombre}"? Se habilitarán nuevamente todas sus secciones.`
                        : `¿Estás seguro de que querés desactivar "${sucursal.nombre}"? Las secciones de equipo, servicios y agenda quedarán inhabilitadas hasta que la reactives.`
                      }
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleToggleActive}>
                      {isInactive ? 'Activar' : 'Desactivar'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isEditingInfo ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={infoForm.nombre} onChange={(e) => setInfoForm(p => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input value={infoForm.direccion} onChange={(e) => setInfoForm(p => ({ ...p, direccion: e.target.value }))} placeholder="Av. Corrientes 1234" />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={infoForm.telefono} onChange={(e) => setInfoForm(p => ({ ...p, telefono: e.target.value }))} placeholder="+54 11 1234-5678" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => { setIsEditingInfo(false); setInfoForm({ nombre: sucursal.nombre, direccion: sucursal.direccion || '', telefono: sucursal.telefono || '' }); }} disabled={isSavingInfo}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button size="sm" onClick={handleSaveInfo} disabled={isSavingInfo || !infoForm.nombre.trim()}>
                  <Save className="h-4 w-4 mr-1" /> {isSavingInfo ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{sucursal.nombre}</span>
                <Badge variant={sucursal.activa ? 'default' : 'secondary'} className="ml-2">
                  {sucursal.activa ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{sucursal.direccion || 'Sin dirección'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{sucursal.telefono || 'Sin teléfono'}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Banner de sucursal inactiva */}
      {isInactive && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">
            Esta sucursal está desactivada. Activala nuevamente para gestionar estas secciones.
          </p>
        </div>
      )}

      {/* Secciones inhabilitadas si la sucursal está inactiva */}
      <div className={isInactive ? 'opacity-50 pointer-events-none select-none' : ''}>
        {/* Equipo unificado */}
        <EquipoUnificado
          sucursalId={sucursal.id}
          organizationId={organization?.id || ''}
          barbers={barbers}
          allBarbers={allBarbers}
          sucursales={allSucursales}
          onAddBarber={onAddBarber}
          onUpdateBarber={onUpdateBarber}
        />

        {/* Catálogo de Servicios */}
        <div className="space-y-4 mt-6">
          <h3 className="text-base font-medium text-foreground">Catálogo de Servicios</h3>
          <CobrarConfig
            sucursalId={sucursal.id}
            services={services} extras={extras} discounts={discounts} lines={lines}
            onAddService={onAddService} onUpdateService={onUpdateService}
            onAddExtra={onAddExtra} onUpdateExtra={onUpdateExtra}
            onAddDiscount={onAddDiscount} onUpdateDiscount={onUpdateDiscount}
            onDeleteDiscount={onDeleteDiscount}
            onToggleDiscountActive={onToggleDiscountActive}
            onAddLine={onAddLine} onUpdateLine={onUpdateLine}
          />
        </div>

        {/* Métodos de pago y recargos (override por sucursal) */}
        <div className="mt-6">
          <PaymentMethodsConfig sucursalId={sucursal.id} onGoToGeneral={onGoToGeneralConfig} />
        </div>

      </div>
    </div>
  );
}
