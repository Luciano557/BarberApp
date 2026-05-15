import { Shield, ChevronRight, ClipboardList, Crown, Wallet, Sparkles, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/components/onboarding/OnboardingProvider';

type ConfigSection = 'menu' | 'pin' | 'tareas' | 'plan' | 'payments' | 'notificaciones';

interface ConfigMenuItem {
  id: ConfigSection;
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface ConfigMenuProps {
  onSelect: (section: ConfigSection) => void;
}

export function ConfigMenu({ onSelect }: ConfigMenuProps) {
  const { isOwner, isGeneralManager, isSucursalAccount } = useAuth();
  const { restart } = useOnboarding();
  const canSeeOnboarding = isOwner || isGeneralManager;

  const items: ConfigMenuItem[] = [
    {
      id: 'plan',
      icon: <Crown className="h-5 w-5" />,
      title: 'Plan y Suscripción',
      description: 'Ver plan actual, límites e información del negocio',
    },
    {
      id: 'payments',
      icon: <Wallet className="h-5 w-5" />,
      title: 'Métodos de pago y recargos',
      description: 'Configuración general del negocio',
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
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className="w-full flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">{item.title}</p>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </button>
      ))}

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
