import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CalendarClock } from 'lucide-react';
import { AgendaConfigSection } from './AgendaConfigSection';
import { HorariosTrabajoSection } from './HorariosTrabajoSection';
import { BloqueosSection } from './BloqueosSection';
import { Barber } from '@/types/barbershop';

interface AgendaManagementProps {
  sucursalId: string;
  organizationId: string;
  barbers: Barber[];
}

export function AgendaManagement({ sucursalId, organizationId, barbers }: AgendaManagementProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <CalendarClock className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-medium text-foreground">Gestión de Turnos y Agenda</h3>
          <p className="text-xs text-muted-foreground">Configurá horarios, disponibilidad y bloqueos</p>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={['config']} className="space-y-2">
        <AccordionItem value="config" className="border rounded-lg">
          <AccordionTrigger className="px-4 py-3 text-sm hover:no-underline">
            Configuración general
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <AgendaConfigSection sucursalId={sucursalId} organizationId={organizationId} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="horarios" className="border rounded-lg">
          <AccordionTrigger className="px-4 py-3 text-sm hover:no-underline">
            Horarios de trabajo
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <HorariosTrabajoSection sucursalId={sucursalId} organizationId={organizationId} barbers={barbers} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="bloqueos" className="border rounded-lg">
          <AccordionTrigger className="px-4 py-3 text-sm hover:no-underline">
            Bloqueos y excepciones
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <BloqueosSection sucursalId={sucursalId} organizationId={organizationId} barbers={barbers} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
