import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgendaConfigSection } from './AgendaConfigSection';
import { BloqueosSection } from './BloqueosSection';
import { HorariosTrabajoSection } from './HorariosTrabajoSection';
import { AgendaPanel } from '@/components/agenda/AgendaPanel';
import { Barber } from '@/types/barbershop';
import { useSucursal } from '@/contexts/SucursalContext';

interface AgendaManagementProps {
  sucursalId: string;
  organizationId: string;
  barbers: Barber[];
}

export function AgendaManagement({ sucursalId, organizationId, barbers }: AgendaManagementProps) {
  const { sucursales } = useSucursal();
  const sucursal = sucursales.find(s => s.id === sucursalId);

  return (
    <Tabs defaultValue="agenda" className="w-full mt-2">
      <TabsList className="h-9 bg-muted p-1 rounded-lg">
        <TabsTrigger value="agenda" className="text-xs px-4">Agenda</TabsTrigger>
        <TabsTrigger value="config" className="text-xs px-4">Configuración</TabsTrigger>
      </TabsList>

      <TabsContent value="agenda" className="mt-4">
        <AgendaPanel
          sucursalId={sucursalId}
          organizationId={organizationId}
          sucursalTimezone={sucursal?.timezone}
          barbers={barbers}
        />
      </TabsContent>

      <TabsContent value="config" className="mt-4 space-y-6">
        <AgendaConfigSection sucursalId={sucursalId} organizationId={organizationId} />
        <HorariosTrabajoSection sucursalId={sucursalId} organizationId={organizationId} barbers={barbers} />
        <BloqueosSection sucursalId={sucursalId} organizationId={organizationId} barbers={barbers} />
      </TabsContent>
    </Tabs>
  );
}
