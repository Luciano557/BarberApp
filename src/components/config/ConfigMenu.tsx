import { Shield, ChevronRight, ClipboardList, Crown, Wallet, Sparkles, Bell, MonitorSmartphone, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/components/onboarding/OnboardingProvider';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';
import {
  getRequiredPlan,
  planAllowsFeature,
  PLAN_LABELS,
  resolveEffectivePlan,
  type PlanFeatureKey,
} from '@/lib/planAccess';

type ConfigSection = 'menu' | 'pin' | 'tareas' | 'plan' | 'payments' | 'mercadopago' | 'notificaciones' | 'mi-cuenta';

interface ConfigMenuItem {
  id: ConfigSection;
  icon: React.ReactNode;
  title: string;
  description: string;
  feature?: PlanFeatureKey;
}

interface ConfigMenuProps {
  onSelect: (section: ConfigSection) => void;
}

export function ConfigMenu({ onSelect }: ConfigMenuProps) {
  const { isOwner, isGeneralManager, isSucursalAccount } = useAuth();
  const { restart } = useOnboarding();
  const { organization } = useOrganization();
  const { access: subscriptionAccess } = useSubscriptionAccess();
  const effectivePlan = resolveEffectivePlan(subscriptionAccess, organization?.plan);
  const canSeeOnboarding = isOwner || isGeneralManager;

  const items: ConfigMenuItem[] = [
    {
      id: 'plan',
      icon: <Crown className="h-5 w-5" />,
      title: 'Plan y Facturación',
      description: 'Suscripción, renovación y pagos del negocio',
    },
    {
      id: 'payments',
      icon: <Wallet className="h-5 w-5" />,
      title: 'Métodos de pago y recargos',
      description: 'Configuración general del negocio',
    },
    {
      id: 'mercadopago',
      icon: <MonitorSmartphone className="h-5 w-5" />,
      title: 'MercadoPago Point',
      description: 'Conectar cuenta y gestionar terminales Point',
    },
    {
      id: 'pin',
      icon: <Shield className="h-5 w-5" />,
      title: 'PIN de Seguridad',
      description: 'Acceso a secciones protegidas',
    },
    {
      id: 'tareas',
      icon: <ClipboardList className="h-5 w-5" />,
      title: 'Tareas y Peticiones',
      description: 'Vencimiento de peticiones',
      feature: 'tasks',
    },
  ];

  // La cuenta de sucursal NO ve la configuración de notificaciones.
  if (!isSucursalAccount) {
    items.push({
      id: 'notificaciones',
      icon: <Bell className="h-5 w-5" />,
      title: 'Notificaciones',
      description: 'Elegí qué avisos querés recibir en tu Centro de Notificaciones',
    });
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const locked = item.feature ? !planAllowsFeature(effectivePlan, item.feature) : false;
        const requiredPlan = item.feature ? getRequiredPlan(item.feature) : null;

        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">{item.title}</p>
                {locked && requiredPlan && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-status-warning-bg px-2 py-0.5 text-[10px] font-medium text-status-warning-foreground">
                    <Lock className="h-3 w-3" />
                    {PLAN_LABELS[requiredPlan]}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </button>
        );
      })}

      {canSeeOnboarding && (
        <button
          onClick={restart}
          className="w-full flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">Ver tutorial otra vez</p>
            <p className="text-sm text-muted-foreground">Volvé a recorrer el onboarding inicial paso a paso</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </button>
      )}
    </div>
  );
}
