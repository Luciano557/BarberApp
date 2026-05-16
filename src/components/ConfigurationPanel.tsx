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
  const { canManageConfig } = useAuth();
  // Roles no administrativos solo ven Mi cuenta — entran directo a esa sección.
  const initial: ConfigSection = !canManageConfig ? 'mi-cuenta' : (initialSection ?? 'menu');
  const [activeSection, setActiveSection] = useState<ConfigSection>(initial);

  useEffect(() => {
    if (!canManageConfig) {
      setActiveSection('mi-cuenta');
    } else if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection, canManageConfig]);

  const handleSelect = (section: ConfigSection) => {
    // Bloquear secciones administrativas para roles no admin.
    if (!canManageConfig && section !== 'mi-cuenta') return;
    setActiveSection(section);
    onSectionChange?.(section);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start gap-3">
        {canManageConfig && activeSection !== 'menu' && (
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
          {activeSection === 'mi-cuenta' && (
            <p className="text-muted-foreground text-sm mt-1">Datos de tu cuenta y preferencias personales</p>
          )}
        </div>
      </div>

      {canManageConfig && activeSection === 'menu' && <ConfigMenu onSelect={handleSelect} />}
      {canManageConfig && activeSection === 'plan' && <OrganizationSettings />}
      {canManageConfig && activeSection === 'payments' && <PaymentMethodsConfig sucursalId={null} />}
      {canManageConfig && activeSection === 'pin' && <PinConfigSection />}
      {canManageConfig && activeSection === 'tareas' && <TareasConfig />}
      {canManageConfig && activeSection === 'notificaciones' && <NotificationsConfig />}
      {activeSection === 'mi-cuenta' && <MiCuentaConfig />}
    </div>
  );
}
