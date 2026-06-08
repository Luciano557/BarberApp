import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Edit2, Save, X, Building2, Power, AlertTriangle, KeyRound } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { CuentaSucursalBlock } from '@/components/config/CuentaSucursalBlock';
import { useSucursal } from '@/contexts/SucursalContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Sucursal } from '@/contexts/SucursalContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Barber, Service, Extra, Discount, Line } from '@/types/barbershop';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EquipoSucursalPanel } from './config/EquipoSucursalPanel';
import { CobrarConfig } from './config/CobrarConfig';
import { DiscountsConfig } from './config/DiscountsConfig';
import { PaymentMethodsConfig } from './config/PaymentMethodsConfig';
import { ProductosConfig } from '@/components/productos/ProductosConfig';

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
  highlightBarberoId?: string;
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
  highlightBarberoId,
}: SucursalTabContentProps) {
  const { organization } = useOrganization();
  const { isOwner, isGeneralManager, isManager } = useAuth();
  const { sucursales: sucursalesAsignadas } = useSucursal();
  const canManageServiceStructure = isOwner || isGeneralManager;
  const canManageCuentaSucursal =
    isOwner ||
    isGeneralManager ||
    (isManager && sucursalesAsignadas.some((s) => s.id === sucursal.id));
  const [cuentaOpen, setCuentaOpen] = useState(false);

  // Captura el flag de highlight al renderizar (antes de que el efecto del hijo lo borre).
  // Los efectos de los hijos se ejecutan antes que los del padre en React, por lo que
  // leer aquí —en lazy init— garantiza que tenemos el valor antes de que desaparezca.
  const [shouldScrollToEquipo] = useState(() => {
    if (typeof window === 'undefined' || !organization?.id) return false;
    try {
      return !!localStorage.getItem(`vittro:miNegocio:highlightBarbero:${organization.id}`);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!shouldScrollToEquipo) return;
    const timeout = setTimeout(() => {
      const el = document.querySelector('[data-onboarding-id="equipo-section"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Info editing ---
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    nombre: sucursal.nombre,
    direccion: sucursal.direccion || '',
    telefono: sucursal.telefono || '',
  });
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [fechaDesactivacion, setFechaDesactivacion] = useState<string | null>(null);
  const [futureTurnosCount, setFutureTurnosCount] = useState<number | null>(null);
  const [showToggleDialog, setShowToggleDialog] = useState(false);

  useEffect(() => {
    setInfoForm({
      nombre: sucursal.nombre,
      direccion: sucursal.direccion || '',
      telefono: sucursal.telefono || '',
    });
    setIsEditingInfo(false);
  }, [sucursal.id]);

  // Cargar fecha_desactivacion para esta sucursal
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('sucursales')
        .select('fecha_desactivacion')
        .eq('id', sucursal.id)
        .maybeSingle();
      if (!cancelled) setFechaDesactivacion((data as any)?.fecha_desactivacion ?? null);
    })();
    return () => { cancelled = true; };
  }, [sucursal.id, sucursal.activa]);

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

  const formatFechaDDMMYYYY = (iso: string | null | undefined): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  };

  const openToggleDialog = async () => {
    setFutureTurnosCount(null);
    setShowToggleDialog(true);
    if (sucursal.activa) {
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await supabase
        .from('turnos')
        .select('id', { count: 'exact', head: true })
        .eq('sucursal_id', sucursal.id)
        .gte('fecha', today)
        .in('estado', ['pendiente', 'confirmado', 'en_curso']);
      setFutureTurnosCount(count ?? 0);
    }
  };

  const handleToggleActive = async () => {
    if (!organization?.id) return;
    setIsTogglingActive(true);
    try {
      const { data, error } = await supabase.functions.invoke('toggle-sucursal', {
        body: { sucursalId: sucursal.id, organizationId: organization.id },
      });
      if (error) throw new Error(error.message || 'Error al cambiar el estado');
      const action = (data as any)?.action as 'deactivated' | 'reactivated' | undefined;
      const restored = !!(data as any)?.restored;
      const reason = (data as any)?.reason as string | undefined;
      toast.success(action === 'deactivated' ? 'Sucursal desactivada' : 'Sucursal reactivada');
      if (action === 'reactivated' && !restored && reason === 'manual_changes_detected') {
        toast.message('Hubo cambios en el equipo mientras la sucursal estuvo inactiva. Revisá la disponibilidad de los barberos manualmente.');
      }
      setShowToggleDialog(false);
      onSucursalUpdated();
    } catch (e: any) {
      toast.error(e?.message || 'Error al cambiar el estado');
    } finally {
      setIsTogglingActive(false);
    }
  };

  const isInactive = !sucursal.activa;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mt-4 space-y-6 sm:mt-6">
      {/* Información de la sucursal */}
      <Card data-onboarding-id="info-sucursal-card">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="min-w-0 text-base leading-tight">Información de la sucursal</CardTitle>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              {canManageCuentaSucursal && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCuentaOpen(true)}
                  data-onboarding-id="cuenta-sucursal-button"
                  className="w-full justify-center sm:w-auto"
                >
                  <KeyRound className="h-4 w-4 mr-1" /> Cuenta de sucursal
                </Button>
              )}
              {!isEditingInfo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingInfo(true)}
                  className="w-full justify-center sm:w-auto"
                >
                  <Edit2 className="h-4 w-4 mr-1" /> Editar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className={`w-full justify-center sm:w-auto ${isInactive ? '' : 'text-destructive border-destructive/30 hover:bg-destructive/10'}`}
                disabled={isTogglingActive}
                onClick={openToggleDialog}
              >
                <Power className="h-4 w-4 mr-1" />
                {isInactive ? 'Reactivar' : 'Desactivar'}
              </Button>
              <AlertDialog
                open={showToggleDialog}
                onOpenChange={(o) => { if (!o && !isTogglingActive) setShowToggleDialog(false); }}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {isInactive
                        ? `Reactivar ${sucursal.nombre}`
                        : `Desactivar ${sucursal.nombre}`}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {isInactive
                        ? 'La sucursal volverá a estar operativa.'
                        : 'Los barberos de esta sucursal quedarán bloqueados y no podrán operar hasta que los asignes a otra sucursal o reactives esta.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  {!isInactive && futureTurnosCount !== null && futureTurnosCount > 0 && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Esta sucursal tiene {futureTurnosCount} turno{futureTurnosCount === 1 ? '' : 's'} futuro{futureTurnosCount === 1 ? '' : 's'} que quedará{futureTurnosCount === 1 ? '' : 'n'} sin atender.
                      </p>
                    </div>
                  )}

                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isTogglingActive}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => { e.preventDefault(); handleToggleActive(); }}
                      disabled={isTogglingActive}
                      className={!isInactive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                    >
                      {isTogglingActive
                        ? 'Procesando...'
                        : (isInactive ? 'Reactivar' : 'Desactivar')}
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
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" size="sm" className="w-full sm:w-auto" onClick={() => { setIsEditingInfo(false); setInfoForm({ nombre: sucursal.nombre, direccion: sucursal.direccion || '', telefono: sucursal.telefono || '' }); }} disabled={isSavingInfo}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button size="sm" className="w-full sm:w-auto" onClick={handleSaveInfo} disabled={isSavingInfo || !infoForm.nombre.trim()}>
                  <Save className="h-4 w-4 mr-1" /> {isSavingInfo ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 break-words font-medium">{sucursal.nombre}</span>
                <Badge variant={sucursal.activa ? 'default' : 'secondary'} className="sm:ml-2">
                  {sucursal.activa ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 break-words text-sm text-muted-foreground">{sucursal.direccion || 'Sin dirección'}</span>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 break-words text-sm text-muted-foreground">{sucursal.telefono || 'Sin teléfono'}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Banner de sucursal inactiva */}
      {isInactive && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm text-destructive">
              Esta sucursal está desactivada. Reactivala para gestionar estas secciones.
            </p>
            {fechaDesactivacion && (
              <p className="text-xs text-destructive/80">
                Desactivada el {formatFechaDDMMYYYY(fechaDesactivacion)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Anchor nav — solo desktop */}
      <nav className="hidden md:flex items-center gap-1 sticky top-0 z-10 bg-background border-b border-border/50 py-2 overflow-x-auto">
        <button onClick={() => scrollTo('seccion-equipo')} className="shrink-0 rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          Equipo
        </button>
        <button onClick={() => scrollTo('seccion-servicios')} className="shrink-0 rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          Servicios
        </button>
        <button onClick={() => scrollTo('seccion-productos')} className="shrink-0 rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          Productos
        </button>
        <button onClick={() => scrollTo('seccion-descuentos')} className="shrink-0 rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          Descuentos
        </button>
        <button onClick={() => scrollTo('seccion-metodos-pago')} className="shrink-0 rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          Métodos de pago
        </button>
      </nav>

      {/* Secciones inhabilitadas si la sucursal está inactiva */}
      <div className={isInactive ? 'opacity-50 pointer-events-none select-none' : ''}>
        {/* Equipo unificado */}
        <div id="seccion-equipo" data-onboarding-id="equipo-section">
          <EquipoSucursalPanel
            sucursalId={sucursal.id}
            sucursalNombre={sucursal.nombre}
            organizationId={organization?.id || ''}
            highlightBarberoId={highlightBarberoId}
          />
        </div>

        {/* Servicios */}
        <section id="seccion-servicios" className="border-t pt-6 mt-6" data-onboarding-id="catalogo-section">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">Servicios</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Configurá precios y activá los servicios disponibles en esta sucursal.</p>
          </div>
          <CobrarConfig
            services={services} extras={extras} lines={lines}
            onAddService={onAddService} onUpdateService={onUpdateService}
            onAddExtra={onAddExtra} onUpdateExtra={onUpdateExtra}
            onAddLine={onAddLine} onUpdateLine={onUpdateLine}
            canCreateServices={canManageServiceStructure}
            canEditServiceStructure={canManageServiceStructure}
          />
        </section>

        {/* Productos */}
        <section id="seccion-productos" className="border-t pt-6 mt-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">Productos</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Precios, stock y comisiones para esta sucursal.</p>
          </div>
          <ProductosConfig sucursalId={sucursal.id} />
        </section>

        {/* Descuentos */}
        <section id="seccion-descuentos" className="border-t pt-6 mt-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">Descuentos</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Activá los descuentos disponibles en esta sucursal.</p>
          </div>
          <DiscountsConfig
            discounts={discounts}
            onAdd={onAddDiscount}
            onUpdate={onUpdateDiscount}
            onDelete={onDeleteDiscount}
            onToggleActive={onToggleDiscountActive}
          />
        </section>

        {/* Métodos de pago y recargos (override por sucursal) */}
        <div id="seccion-metodos-pago" className="mt-6" data-onboarding-id="metodos-pago-section">
          <PaymentMethodsConfig sucursalId={sucursal.id} onGoToGeneral={onGoToGeneralConfig} />
        </div>

      </div>

      <Sheet open={cuentaOpen} onOpenChange={setCuentaOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Cuenta de sucursal — {sucursal.nombre}</SheetTitle>
            <SheetDescription>
              Acceso operativo y reglas de PIN específicas para esta sucursal.
            </SheetDescription>
          </SheetHeader>
          <CuentaSucursalBlock sucursal={sucursal} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
