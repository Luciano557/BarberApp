import { useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Settings2 } from 'lucide-react';
import { Service, Extra, Discount, Line, Barber } from '@/types/barbershop';
import { ServicesConfig } from './config/ServicesConfig';
import { ExtrasConfig } from './config/ExtrasConfig';
import { DiscountsConfig } from './config/DiscountsConfig';
import { LinesConfig } from './config/LinesConfig';
import { ProductosGlobalConfig } from './productos/ProductosGlobalConfig';
import { PaymentMethodsConfig } from './config/PaymentMethodsConfig';
import { CuentasSucursalConfig } from './config/CuentasSucursalConfig';
import { EquipoGeneralConfig } from './config/EquipoGeneralConfig';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface MiNegocioGeneralTabContentProps {
  /** true cuando la tab "General" está activa. Los handlers que reciba deben ser globales. */
  isReady: boolean;
  services: Service[];
  extras: Extra[];
  discounts: Discount[];
  lines: Line[];
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
  onDeleteService: (id: string) => void;
  onDeleteExtra: (id: string) => void;
  onDeleteLine: (id: string) => void;
  // Equipo General
  organizationId: string;
  allBarbers: Barber[];
  allSucursales: { id: string; nombre: string; activa: boolean }[];
  onAddBarberToSucursal: (barber: Omit<Barber, 'id' | 'uid'>, sucursalId: string) => void;
  onUpdateBarber: (id: string, updates: Partial<Barber>) => void | Promise<void>;
  onRefreshBarbers?: () => Promise<void> | void;
  onNavigateToMiNegocio?: (sucursalId: string, barberoId: string) => void;
}

/**
 * Contenido de la tab "General" de Mi Negocio.
 * Edita configuración global del negocio: catálogo (servicios/extras/productos/descuentos)
 * y métodos de pago generales. NO incluye equipo ni datos por sucursal.
 *
 * Guard: bloquea mutaciones si el SucursalContext aún no está en modo global,
 * para evitar escribir accidentalmente sobre la sucursal anterior.
 */
export function MiNegocioGeneralTabContent({
  isReady,
  services, extras, discounts, lines,
  onAddService, onUpdateService,
  onAddExtra, onUpdateExtra,
  onAddDiscount, onUpdateDiscount, onDeleteDiscount, onToggleDiscountActive,
  onAddLine, onUpdateLine,
  onDeleteService, onDeleteExtra, onDeleteLine,
  organizationId, allBarbers, allSucursales,
  onAddBarberToSucursal, onUpdateBarber, onRefreshBarbers, onNavigateToMiNegocio,
}: MiNegocioGeneralTabContentProps) {
  const { isOwner, isGeneralManager } = useAuth();
  const canManageEquipo = isOwner || isGeneralManager;

  const guarded = useCallback(<TArgs extends unknown[], TReturn>(fn: (...args: TArgs) => TReturn) => {
    return (...args: TArgs): TReturn | undefined => {
      if (!isReady) {
        toast.warning('Sincronizando vista general… probá de nuevo en un instante.');
        return undefined;
      }
      return fn(...args);
    };
  }, [isReady]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mt-4 space-y-6 sm:mt-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Settings2 className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">Configuración general del negocio</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Datos globales que aplican a todas las sucursales. Cada sucursal puede activar y configurar precios por su cuenta.
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!isReady && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Sincronizando vista general…
        </div>
      )}

      {/* Anchor nav — solo desktop */}
      <nav className="hidden md:flex items-center gap-1 sticky top-0 z-10 bg-background border-b border-border/50 py-2 overflow-x-auto">
        <button onClick={() => scrollTo('seccion-cuentas')} className="shrink-0 rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          Cuentas de sucursal
        </button>
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

      <div className={!isReady ? 'opacity-60 pointer-events-none select-none' : ''}>
        {/* Cuentas de sucursal */}
        <div id="seccion-cuentas">
          <CuentasSucursalConfig />
        </div>

        {/* Equipo General (solo owner/GM) */}
        {canManageEquipo && (
          <div id="seccion-equipo" className="mt-8 space-y-4">
            <h3 className="text-base font-medium text-foreground">Equipo</h3>
            <p className="text-xs text-muted-foreground">
              Gestioná el equipo del negocio: alta, cargos, acceso, PIN y en qué sucursales trabaja cada uno.
            </p>
            <EquipoGeneralConfig
              organizationId={organizationId}
              allBarbers={allBarbers}
              allSucursales={allSucursales}
              onAddBarberToSucursal={onAddBarberToSucursal}
              onUpdateBarber={onUpdateBarber}
              onRefreshBarbers={onRefreshBarbers}
              onNavigateToMiNegocio={onNavigateToMiNegocio}
            />
          </div>
        )}

        {/* Servicios */}
        <section id="seccion-servicios" className="border-t pt-6 mt-8">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">Servicios</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Nombre, duración y categoría. Los precios se configuran en cada sucursal.</p>
          </div>
          <Tabs defaultValue="services" className="w-full">
            <TabsList className="grid h-auto w-full gap-1 rounded-lg bg-muted p-1 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
              <TabsTrigger value="services" className="min-h-9 whitespace-normal rounded-md px-2 text-center text-xs data-[state=active]:bg-card sm:text-sm">Servicios</TabsTrigger>
              <TabsTrigger value="lines" className="min-h-9 whitespace-normal rounded-md px-2 text-center text-xs data-[state=active]:bg-card sm:text-sm">Categorías</TabsTrigger>
              <TabsTrigger value="extras" className="min-h-9 whitespace-normal rounded-md px-2 text-center text-xs data-[state=active]:bg-card sm:text-sm">Extras</TabsTrigger>
            </TabsList>

            <TabsContent value="services" className="mt-4 space-y-6 sm:mt-6">
              <ServicesConfig
                mode="global"
                services={services}
                lines={lines}
                onAdd={guarded(onAddService)}
                onUpdate={guarded(onUpdateService)}
                onAddLine={onAddLine}
                onUpdateLine={guarded(onUpdateLine)}
                onDeleteLine={guarded(onDeleteLine)}
                onDelete={guarded(onDeleteService)}
              />
            </TabsContent>

            <TabsContent value="lines" className="mt-4 sm:mt-6">
              <LinesConfig
                lines={lines}
                onAdd={onAddLine}
                onUpdate={guarded(onUpdateLine)}
                onDelete={guarded(onDeleteLine)}
              />
            </TabsContent>

            <TabsContent value="extras" className="mt-4 sm:mt-6">
              <ExtrasConfig
                mode="global"
                extras={extras}
                onAdd={guarded(onAddExtra)}
                onUpdate={guarded(onUpdateExtra)}
                onDelete={guarded(onDeleteExtra)}
              />
            </TabsContent>
          </Tabs>
        </section>

        {/* Productos */}
        <section id="seccion-productos" className="border-t pt-6 mt-8">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">Productos</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Catálogo de productos para reventa. Stock y precios se gestionan por sucursal.</p>
          </div>
          <ProductosGlobalConfig />
        </section>

        {/* Descuentos */}
        <section id="seccion-descuentos" className="border-t pt-6 mt-8">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">Descuentos</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Reglas de descuento para el cobro. Se activan por sucursal.</p>
          </div>
          <DiscountsConfig
            mode="global"
            discounts={discounts}
            onAdd={guarded(onAddDiscount)}
            onUpdate={guarded(onUpdateDiscount)}
            onDelete={guarded(onDeleteDiscount)}
            onToggleActive={onToggleDiscountActive ? guarded(onToggleDiscountActive) : undefined}
          />
        </section>

        {/* Métodos de pago generales */}
        <div id="seccion-metodos-pago" className="mt-8 space-y-4">
          <h3 className="text-base font-medium text-foreground">Métodos de pago</h3>
          <PaymentMethodsConfig sucursalId={null} />
        </div>
      </div>
    </div>
  );
}
