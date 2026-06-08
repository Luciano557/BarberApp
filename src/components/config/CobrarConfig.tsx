import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ServicesConfig } from './ServicesConfig';
import { ExtrasConfig } from './ExtrasConfig';
import { Service, Extra, Line } from '@/types/barbershop';

interface CobrarConfigProps {
  services: Service[];
  extras: Extra[];
  lines: Line[];
  onAddService: (service: Omit<Service, 'id' | 'uid'>) => void;
  onUpdateService: (id: string, updates: Partial<Service>) => void;
  onAddExtra: (extra: Omit<Extra, 'id' | 'uid'>) => void;
  onUpdateExtra: (id: string, updates: Partial<Extra>) => void;
  onAddLine: (line: Omit<Line, 'id'>) => Promise<Line | null>;
  onUpdateLine: (id: string, updates: Partial<Line>) => void;
  canCreateServices?: boolean;
  canEditServiceStructure?: boolean;
}

export function CobrarConfig({
  services, extras, lines,
  onAddService, onUpdateService,
  onAddExtra, onUpdateExtra,
  onAddLine, onUpdateLine,
  canCreateServices = true,
  canEditServiceStructure = true,
}: CobrarConfigProps) {
  return (
    <Tabs defaultValue="services" className="w-full">
      <TabsList className="flex h-auto w-full gap-1 rounded-lg bg-muted p-1">
        <TabsTrigger value="services" className="min-h-9 flex-1 whitespace-normal rounded-md px-2 text-center text-xs data-[state=active]:bg-card sm:text-sm">
          Servicios
        </TabsTrigger>
        <TabsTrigger value="extras" className="min-h-9 flex-1 whitespace-normal rounded-md px-2 text-center text-xs data-[state=active]:bg-card sm:text-sm">
          Extras
        </TabsTrigger>
      </TabsList>

      <TabsContent value="services" className="mt-4 sm:mt-6">
        <p className="text-xs text-muted-foreground mb-4">
          Las categorías se administran desde la vista general del negocio.
        </p>
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
        <p className="text-xs text-muted-foreground mb-4">
          Para crear o eliminar extras, usá la vista general del negocio.
        </p>
        <ExtrasConfig
          extras={extras}
          onAdd={onAddExtra}
          onUpdate={onUpdateExtra}
        />
      </TabsContent>
    </Tabs>
  );
}
