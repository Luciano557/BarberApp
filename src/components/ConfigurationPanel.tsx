import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfigMenu } from './config/ConfigMenu';
import { TareasConfig } from './config/TareasConfig';
import { PinConfigSection } from './PinConfigSection';
import { OrganizationSettings } from './OrganizationSettings';
import { PaymentMethodsConfig } from './config/PaymentMethodsConfig';
import { NotificationsConfig } from './config/NotificationsConfig';
import { MiCuentaConfig } from './config/MiCuentaConfig';
import { useAuth } from '@/contexts/AuthContext';

type ConfigSection = 'menu' | 'pin' | 'tareas' | 'plan' | 'payments' | 'notificaciones' | 'mi-cuenta';

const sectionTitles: Record<ConfigSection, string> = {
  menu: 'Configuración',
  pin: 'PIN de Seguridad',
  tareas: 'Tareas y Peticiones',
  plan: 'Plan y Suscripción',
  payments: 'Métodos de pago y recargos',
  notificaciones: 'Notificaciones',
  'mi-cuenta': 'Mi cuenta',
};

interface ConfigurationPanelProps {
  initialSection?: ConfigSection;
  onSectionChange?: (section: ConfigSection) => void;
}

export function ConfigurationPanel({ initialSection, onSectionChange }: ConfigurationPanelProps = {}) {
  const [activeSection, setActiveSection] = useState<ConfigSection>(initialSection ?? 'menu');

  useEffect(() => {
    if (initialSection) setActiveSection(initialSection);
  }, [initialSection]);

  const handleSelect = (section: ConfigSection) => {
    setActiveSection(section);
    onSectionChange?.(section);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start gap-3">
        {activeSection !== 'menu' && (
          <Button variant="ghost" size="icon" onClick={() => handleSelect('menu')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-xl font-semibold text-foreground">{sectionTitles[activeSection]}</h1>
          {activeSection === 'menu' && (
            <p className="text-muted-foreground text-sm mt-1">Configuración de servicios y operaciones</p>
          )}
          {activeSection === 'payments' && (
            <p className="text-muted-foreground text-sm mt-1">Configuración general del negocio</p>
          )}
          {activeSection === 'notificaciones' && (
            <p className="text-muted-foreground text-sm mt-1">Personalizá los avisos del Centro de Notificaciones</p>
          )}
        </div>
      </div>

      {activeSection === 'menu' && <ConfigMenu onSelect={handleSelect} />}
      {activeSection === 'plan' && <OrganizationSettings />}
      {activeSection === 'payments' && <PaymentMethodsConfig sucursalId={null} />}
      {activeSection === 'pin' && <PinConfigSection />}
      {activeSection === 'tareas' && <TareasConfig />}
      {activeSection === 'notificaciones' && <NotificationsConfig />}
    </div>
  );
}
