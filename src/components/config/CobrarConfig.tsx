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
  canCreateServices?: boolean;
  canEditServiceStructure?: boolean;
}

export function CobrarConfig({
  sucursalId,
  services, extras, discounts, lines,
  onAddService, onUpdateService,
  onAddExtra, onUpdateExtra,
  onAddDiscount, onUpdateDiscount, onDeleteDiscount, onToggleDiscountActive,
  onAddLine, onUpdateLine,
  canCreateServices = true,
  canEditServiceStructure = true,
}: CobrarConfigProps) {
  return (
    <Tabs defaultValue="services" className="w-full">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-4">
        <TabsTrigger value="services" className="min-h-9 whitespace-normal rounded-md px-2 text-center text-xs data-[state=active]:bg-card sm:text-sm">
          Servicios
        </TabsTrigger>
        <TabsTrigger value="extras" className="min-h-9 whitespace-normal rounded-md px-2 text-center text-xs data-[state=active]:bg-card sm:text-sm">
          Extras
        </TabsTrigger>
        <TabsTrigger value="productos" className="min-h-9 whitespace-normal rounded-md px-2 text-center text-xs data-[state=active]:bg-card sm:text-sm">
          Productos
        </TabsTrigger>
        <TabsTrigger value="discounts" className="min-h-9 whitespace-normal rounded-md px-2 text-center text-xs data-[state=active]:bg-card sm:text-sm">
          Descuentos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="services" className="mt-4 sm:mt-6">
        <ServicesConfig
          services={services}
          lines={lines}
          onAdd={onAddService}
          onUpdate={onUpdateService}
          onAddLine={onAddLine}
          canCreate={canCreateServices}
          canEditStructure={canEditServiceStructure}
        />
      </TabsContent>

      <TabsContent value="extras" className="mt-4 sm:mt-6">
        <ExtrasConfig
          extras={extras}
          onAdd={onAddExtra}
          onUpdate={onUpdateExtra}
        />
      </TabsContent>

      <TabsContent value="productos" className="mt-4 sm:mt-6">
        <ProductosConfig sucursalId={sucursalId} />
      </TabsContent>

      <TabsContent value="discounts" className="mt-4 sm:mt-6">
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
