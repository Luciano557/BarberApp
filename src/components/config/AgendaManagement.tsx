import { useEffect, useState } from 'react';
import { Calendar, Settings, Globe, SlidersHorizontal } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgendaConfigSection } from './AgendaConfigSection';
import { BloqueosSection } from './BloqueosSection';
import { HorariosTrabajoSection } from './HorariosTrabajoSection';
import { PortalPublicoSection } from './PortalPublicoSection';
import { AgendaPanel } from '@/components/agenda/AgendaPanel';
import { Barber } from '@/types/barbershop';
import { useSucursal } from '@/contexts/SucursalContext';
import { useAuth } from '@/contexts/AuthContext';

interface AgendaManagementProps {
  sucursalId: string;
  organizationId: string;
  barbers: Barber[];
}

type AgendaTab = 'agenda' | 'config';
type ConfigTab = 'portal' | 'reservas';

function readStoredTab<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}

function writeStoredTab(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors.
  }
}

export function AgendaManagement({ sucursalId, organizationId, barbers }: AgendaManagementProps) {
  const { sucursales } = useSucursal();
  const sucursal = sucursales.find(s => s.id === sucursalId);
  const { isOwner, isGeneralManager, isManager } = useAuth();
  const canManageAgendaConfig = isOwner || isGeneralManager || isManager;
  // El portal escribe en organizations, cuya RLS solo admite owner y GM.
  const canManagePortal = isOwner || isGeneralManager;

  const agendaTabKey = `vittro:agenda:activeTab:${organizationId}:${sucursalId}`;
  const configTabKey = `vittro:agenda:configTab:${organizationId}:${sucursalId}`;

  const [tabActiva, setTabActiva] = useState<AgendaTab>(() => readStoredTab<AgendaTab>(agendaTabKey, 'agenda'));
  const [configTab, setConfigTab] = useState<ConfigTab>(() => {
    const stored = readStoredTab<ConfigTab>(configTabKey, 'portal');
    return stored === 'portal' && !canManagePortal ? 'reservas' : stored;
  });

  // Los roles pueden resolverse después del primer render: si para entonces
  // el usuario no puede ver el portal, lo devolvemos a reservas. No se
  // reescribe el storage para no pisar la preferencia de un owner.
  useEffect(() => {
    if (!canManagePortal && configTab === 'portal') {
      setConfigTab('reservas');
    }
  }, [canManagePortal, configTab]);

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

  const reservasContent = (
    <>
      <AgendaConfigSection sucursalId={sucursalId} organizationId={organizationId} />
      <HorariosTrabajoSection sucursalId={sucursalId} organizationId={organizationId} barbers={barbers} />
      <BloqueosSection sucursalId={sucursalId} organizationId={organizationId} barbers={barbers} />
    </>
  );

  return (
    <div className="w-full mt-2 space-y-4">
      <Tabs
        value={tabActiva}
        onValueChange={(v) => {
          const next = v as AgendaTab;
          setTabActiva(next);
          writeStoredTab(agendaTabKey, next);
        }}
      >
        <TabsList variant="underline" className="w-auto">
          <TabsTrigger value="agenda" variant="underline" className="text-[13px]">
            <Calendar className="h-4 w-4" />
            Agenda
          </TabsTrigger>
          <TabsTrigger value="config" variant="underline" className="text-[13px]">
            <Settings className="h-4 w-4" />
            Configuración
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="mt-3">
          <AgendaPanel
            sucursalId={sucursalId}
            organizationId={organizationId}
            sucursalTimezone={sucursal?.timezone}
            barbers={barbers}
          />
        </TabsContent>

        <TabsContent value="config" className="mt-3">
          {canManagePortal ? (
            <Tabs
              value={configTab}
              onValueChange={(v) => {
                const next = v as ConfigTab;
                setConfigTab(next);
                writeStoredTab(configTabKey, next);
              }}
            >
              <TabsList variant="underline" className="w-auto">
                <TabsTrigger value="portal" variant="underline" className="text-[13px]">
                  <Globe className="h-4 w-4" />
                  Portal público
                </TabsTrigger>
                <TabsTrigger value="reservas" variant="underline" className="text-[13px]">
                  <SlidersHorizontal className="h-4 w-4" />
                  Configuración de reservas
                </TabsTrigger>
              </TabsList>

              <TabsContent value="portal" className="mt-3">
                <PortalPublicoSection />
              </TabsContent>

              <TabsContent value="reservas" className="mt-3 space-y-6">
                {reservasContent}
              </TabsContent>
            </Tabs>
          ) : (
            /* Sin acceso al portal queda una sola sección: se muestra directa,
               sin una barra de tabs de un solo ítem. */
            <div className="space-y-6">{reservasContent}</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
