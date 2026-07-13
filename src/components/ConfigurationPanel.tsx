import { useState, useEffect } from 'react';
import { ArrowLeft, LogOut, Settings, Shield, ClipboardList, Crown, Wallet, MonitorSmartphone, Bell, User, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ConfigMenu } from './config/ConfigMenu';
import { TareasConfig } from './config/TareasConfig';
import { PinConfigSection } from './PinConfigSection';
import { PaymentMethodsConfig } from './config/PaymentMethodsConfig';
import { MercadoPagoConnect } from './config/MercadoPagoConnect';
import { NotificationsConfig } from './config/NotificationsConfig';
import { MiCuentaConfig } from './config/MiCuentaConfig';
import { BillingSettings } from './config/BillingSettings';
import { useAuth } from '@/contexts/AuthContext';
import { PlanLockedFeature } from '@/components/billing/PlanLockedFeature';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';
import { getRequiredPlan, planAllowsFeature, resolveEffectivePlan } from '@/lib/planAccess';

type ConfigSection = 'menu' | 'pin' | 'tareas' | 'plan' | 'payments' | 'mercadopago' | 'notificaciones' | 'mi-cuenta';

const sectionTitles: Record<ConfigSection, string> = {
  menu: 'Configuración',
  pin: 'PIN de Seguridad',
  tareas: 'Tareas y Peticiones',
  plan: 'Plan y Suscripcion',
  payments: 'Métodos de pago y recargos',
  mercadopago: 'MercadoPago Point',
  notificaciones: 'Notificaciones',
  'mi-cuenta': 'Mi cuenta',
};

const sectionIcons: Record<ConfigSection, LucideIcon> = {
  menu: Settings,
  pin: Shield,
  tareas: ClipboardList,
  plan: Crown,
  payments: Wallet,
  mercadopago: MonitorSmartphone,
  notificaciones: Bell,
  'mi-cuenta': User,
};

interface ConfigurationPanelProps {
  initialSection?: ConfigSection;
  onSectionChange?: (section: ConfigSection) => void;
}

export function ConfigurationPanel({ initialSection, onSectionChange }: ConfigurationPanelProps = {}) {
  const { canManageConfig, signOut } = useAuth();
  const { organization } = useOrganization();
  const { access: subscriptionAccess } = useSubscriptionAccess();
  const effectivePlan = resolveEffectivePlan(subscriptionAccess, organization?.plan);
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

  const sectionSubtitle: string | undefined =
    activeSection === 'menu' ? 'Configuración de servicios y operaciones' :
    activeSection === 'payments' ? 'Configuración general del negocio' :
    activeSection === 'notificaciones' ? 'Personalizá los avisos del Centro de Notificaciones' :
    activeSection === 'mi-cuenta' ? 'Datos de tu cuenta y preferencias personales' :
    undefined;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        {canManageConfig && activeSection !== 'menu' && (
          <button
            onClick={() => handleSelect('menu')}
            className="mb-2 flex items-center gap-1 pl-14 text-sm text-muted-foreground transition-colors hover:text-foreground sm:pl-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Configuración
          </button>
        )}
        <PageHeader title={sectionTitles[activeSection]} icon={sectionIcons[activeSection]} subtitle={sectionSubtitle} />
      </div>

      {canManageConfig && activeSection === 'menu' && <ConfigMenu onSelect={handleSelect} />}
      {canManageConfig && activeSection === 'plan' && <BillingSettings />}
      {canManageConfig && activeSection === 'payments' && <PaymentMethodsConfig sucursalId={null} />}
      {canManageConfig && activeSection === 'mercadopago' && <MercadoPagoConnect />}
      {canManageConfig && activeSection === 'pin' && <PinConfigSection />}
      {canManageConfig && activeSection === 'tareas' && (
        planAllowsFeature(effectivePlan, 'tasks') ? (
          <TareasConfig />
        ) : (
          <PlanLockedFeature
            title="Tareas esta disponible en Premium"
            description="La configuracion de tareas y peticiones se habilita junto con el modulo de Tareas en el plan Premium."
            requiredPlan={getRequiredPlan('tasks')}
            currentPlan={effectivePlan}
            onManagePlan={() => handleSelect('plan')}
            variant="tasks"
          />
        )
      )}
      {canManageConfig && activeSection === 'notificaciones' && <NotificationsConfig />}
      {activeSection === 'mi-cuenta' && <MiCuentaConfig />}

      <div className="mt-8 border-t border-border pt-6 pb-2 px-1">
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 w-full"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
