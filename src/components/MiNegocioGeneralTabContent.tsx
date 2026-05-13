import { useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Settings2 } from 'lucide-react';
import { Service, Extra, Discount, Line } from '@/types/barbershop';
import { ServicesConfig } from './config/ServicesConfig';
import { ExtrasConfig } from './config/ExtrasConfig';
import { DiscountsConfig } from './config/DiscountsConfig';
import { LinesConfig } from './config/LinesConfig';
import { ProductosGlobalConfig } from './productos/ProductosGlobalConfig';
import { PaymentMethodsConfig } from './config/PaymentMethodsConfig';
import { CuentasSucursalConfig } from './config/CuentasSucursalConfig';
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
}: MiNegocioGeneralTabContentProps) {

  const guarded = useCallback(<TArgs extends unknown[], TReturn>(fn: (...args: TArgs) => TReturn) => {
    return (...args: TArgs): TReturn | undefined => {
      if (!isReady) {
        toast.warning('Sincronizando vista general… probá de nuevo en un instante.');
        return undefined;
      }
      return fn(...args);
    };
  }, [isReady]);

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

      <div className={!isReady ? 'opacity-60 pointer-events-none select-none' : ''}>
        {/* Cuentas de sucursal */}
        <CuentasSucursalConfig />

        {/* Catálogo */}
        <div className="space-y-4 mt-8">
          <h3 className="text-base font-medium text-foreground">Catálogo de Servicios</h3>
          <Tabs defaultValue="services" className="w-full">
            <TabsList className="grid h-auto w-full gap-1 rounded-lg bg-muted p-1 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
              <TabsTrigger value="services" className="min-h-9 whitespace-normal rounded-md px-2 text-center text-xs data-[state=active]:bg-card sm:text-sm">Servicios</TabsTrigger>
              <TabsTrigger value="lines" className="min-h-9 whitespace-normal rounded-md px-2 text-center text-xs data-[state=active]:bg-card sm:text-sm">Líneas de servicio</TabsTrigger>
              <TabsTrigger value="extras" className="min-h-9 whitespace-normal rounded-md px-2 text-center text-xs data-[state=active]:bg-card sm:text-sm">Extras</TabsTrigger>
              <TabsTrigger value="productos" className="min-h-9 whitespace-normal rounded-md px-2 text-center text-xs data-[state=active]:bg-card sm:text-sm">Productos</TabsTrigger>
              <TabsTrigger value="discounts" className="min-h-9 whitespace-normal rounded-md px-2 text-center text-xs data-[state=active]:bg-card sm:text-sm">Descuentos</TabsTrigger>
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

            <TabsContent value="productos" className="mt-4 sm:mt-6">
              <ProductosGlobalConfig />
            </TabsContent>

            <TabsContent value="discounts" className="mt-4 sm:mt-6">
              <DiscountsConfig
                mode="global"
                discounts={discounts}
                onAdd={guarded(onAddDiscount)}
                onUpdate={guarded(onUpdateDiscount)}
                onDelete={guarded(onDeleteDiscount)}
                onToggleActive={onToggleDiscountActive ? guarded(onToggleDiscountActive) : undefined}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Métodos de pago generales */}
        <div className="mt-8 space-y-4">
          <h3 className="text-base font-medium text-foreground">Métodos de pago</h3>
          <PaymentMethodsConfig sucursalId={null} />
        </div>
      </div>
    </div>
  );
}
