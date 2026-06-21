import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgendaConfigSection } from './AgendaConfigSection';
import { BloqueosSection } from './BloqueosSection';
import { HorariosTrabajoSection } from './HorariosTrabajoSection';
import { PortalPublicoSection } from './PortalPublicoSection';
import { AgendaPanel } from '@/components/agenda/AgendaPanel';
import { Barber } from '@/types/barbershop';
import { useSucursal } from '@/contexts/SucursalContext';
import { useAuth } from '@/contexts/AuthContext';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

interface AgendaManagementProps {
  sucursalId: string;
  organizationId: string;
  barbers: Barber[];
}

export function AgendaManagement({ sucursalId, organizationId, barbers }: AgendaManagementProps) {
  const { sucursales } = useSucursal();
  const sucursal = sucursales.find(s => s.id === sucursalId);
  const { isOwner, isGeneralManager, isManager } = useAuth();
  const canManageAgendaConfig = isOwner || isGeneralManager || isManager;
  const [tabActiva, setTabActiva] = useState<'agenda' | 'config'>('agenda');

  if (!canManageAgendaConfig) {
    return (
      <div className="mt-2">
        <AgendaPanel
          sucursalId={sucursalId}
          organizationId={organizationId}
          sucursalTimezone={sucursal?.timezone}
          barbers={barbers}
        />
      </div>
    );
  }

  return (
    <div className="w-full mt-2 space-y-4">
      <SegmentedControl
        options={[
          { value: 'agenda', label: 'Agenda' },
          { value: 'config', label: 'Configuración' },
        ]}
        value={tabActiva}
        onChange={(v) => setTabActiva(v as 'agenda' | 'config')}
      />

      {tabActiva === 'agenda' && (
        <AgendaPanel
          sucursalId={sucursalId}
          organizationId={organizationId}
          sucursalTimezone={sucursal?.timezone}
          barbers={barbers}
        />
      )}

      {tabActiva === 'config' && (
        <Tabs defaultValue="portal" className="w-full">
          <TabsList className="h-9 bg-muted p-1 rounded-lg">
            <TabsTrigger value="portal" className="text-xs px-4">Portal público</TabsTrigger>
            <TabsTrigger value="reservas" className="text-xs px-4">Configuración de reservas</TabsTrigger>
          </TabsList>

          <TabsContent value="portal" className="mt-4">
            <PortalPublicoSection />
          </TabsContent>

          <TabsContent value="reservas" className="mt-4 space-y-6">
            <AgendaConfigSection sucursalId={sucursalId} organizationId={organizationId} />
            <HorariosTrabajoSection sucursalId={sucursalId} organizationId={organizationId} barbers={barbers} />
            <BloqueosSection sucursalId={sucursalId} organizationId={organizationId} barbers={barbers} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
