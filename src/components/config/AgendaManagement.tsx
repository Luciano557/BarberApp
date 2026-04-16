import { AgendaConfigSection } from './AgendaConfigSection';
import { AgendaViewer } from './AgendaViewer';
import { BloqueosSection } from './BloqueosSection';
import { HorariosTrabajoSection } from './HorariosTrabajoSection';
import { Barber } from '@/types/barbershop';

interface AgendaManagementProps {
  sucursalId: string;
  organizationId: string;
  barbers: Barber[];
}

export function AgendaManagement({ sucursalId, organizationId, barbers }: AgendaManagementProps) {
  return (
    <div className="space-y-6">
      <AgendaConfigSection sucursalId={sucursalId} organizationId={organizationId} />
      <AgendaViewer sucursalId={sucursalId} organizationId={organizationId} barbers={barbers} />
      <BloqueosSection sucursalId={sucursalId} organizationId={organizationId} barbers={barbers} />
      <HorariosTrabajoSection sucursalId={sucursalId} organizationId={organizationId} barbers={barbers} />
    </div>
  );
}
