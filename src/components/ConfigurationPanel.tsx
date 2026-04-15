import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfigMenu } from './config/ConfigMenu';
import { TareasConfig } from './config/TareasConfig';
import { PinConfigSection } from './PinConfigSection';
import { OrganizationSettings } from './OrganizationSettings';

type ConfigSection = 'menu' | 'pin' | 'tareas' | 'plan';

const sectionTitles: Record<ConfigSection, string> = {
  menu: 'Configuración',
  pin: 'PIN de Seguridad',
  tareas: 'Tareas y Peticiones',
  plan: 'Plan y Suscripción',
};

export function ConfigurationPanel() {
  const [activeSection, setActiveSection] = useState<ConfigSection>('menu');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        {activeSection !== 'menu' && (
          <Button variant="ghost" size="icon" onClick={() => setActiveSection('menu')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-xl font-semibold text-foreground">{sectionTitles[activeSection]}</h1>
          {activeSection === 'menu' && (
            <p className="text-muted-foreground text-sm mt-1">Configuración de servicios y operaciones</p>
          )}
        </div>
      </div>

      {activeSection === 'menu' && (
        <ConfigMenu onSelect={setActiveSection} />
      )}

      {activeSection === 'plan' && (
        <OrganizationSettings />
      )}

      {activeSection === 'pin' && (
        <PinConfigSection />
      )}

      {activeSection === 'tareas' && (
        <TareasConfig />
      )}
    </div>
  );
}
