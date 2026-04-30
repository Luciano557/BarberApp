import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ServicesConfig } from './ServicesConfig';
import { ExtrasConfig } from './ExtrasConfig';
import { DiscountsConfig } from './DiscountsConfig';
import { ProductosConfig } from '@/components/productos/ProductosConfig';
import { Service, Extra, Discount, Line } from '@/types/barbershop';

interface CobrarConfigProps {
  sucursalId: string;
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
}

export function CobrarConfig({
  sucursalId,
  services, extras, discounts, lines,
  onAddService, onUpdateService,
  onAddExtra, onUpdateExtra,
  onAddDiscount, onUpdateDiscount, onDeleteDiscount, onToggleDiscountActive,
  onAddLine, onUpdateLine,
}: CobrarConfigProps) {
  return (
    <Tabs defaultValue="services" className="w-full">
      <TabsList className="w-full h-10 bg-muted p-1 rounded-lg flex-wrap">
        <TabsTrigger value="services" className="flex-1 text-sm data-[state=active]:bg-card rounded-md">
          Servicios
        </TabsTrigger>
        <TabsTrigger value="extras" className="flex-1 text-sm data-[state=active]:bg-card rounded-md">
          Extras
        </TabsTrigger>
        <TabsTrigger value="productos" className="flex-1 text-sm data-[state=active]:bg-card rounded-md">
          Productos
        </TabsTrigger>
        <TabsTrigger value="discounts" className="flex-1 text-sm data-[state=active]:bg-card rounded-md">
          Descuentos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="services" className="mt-6">
        <ServicesConfig
          services={services}
          lines={lines}
          onAdd={onAddService}
          onUpdate={onUpdateService}
          onAddLine={onAddLine}
        />
      </TabsContent>

      <TabsContent value="extras" className="mt-6">
        <ExtrasConfig
          extras={extras}
          onAdd={onAddExtra}
          onUpdate={onUpdateExtra}
        />
      </TabsContent>

      <TabsContent value="productos" className="mt-6">
        <ProductosConfig sucursalId={sucursalId} />
      </TabsContent>

      <TabsContent value="discounts" className="mt-6">
        <DiscountsConfig
          discounts={discounts}
          onAdd={onAddDiscount}
          onUpdate={onUpdateDiscount}
          onDelete={onDeleteDiscount}
          onToggleActive={onToggleDiscountActive}
        />
      </TabsContent>
    </Tabs>
  );
}
