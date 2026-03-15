import { Scissors, Shield, ChevronRight, ClipboardList, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type ConfigSection = 'menu' | 'cobrar' | 'pin' | 'tareas' | 'staff';

interface ConfigMenuItem {
  id: ConfigSection;
  icon: React.ReactNode;
  title: string;
  description: string;
  visible: boolean;
}

interface ConfigMenuProps {
  onSelect: (section: ConfigSection) => void;
}

export function ConfigMenu({ onSelect }: ConfigMenuProps) {
  const { isOwner } = useAuth();

  const items: ConfigMenuItem[] = [
    {
      id: 'staff',
      icon: <Users className="h-5 w-5" />,
      title: 'Staff',
      description: 'Barberos y comisiones',
      visible: true,
    },
    {
      id: 'cobrar',
      icon: <Scissors className="h-5 w-5" />,
      title: 'Cobrar',
      description: 'Servicios, extras, descuentos',
      visible: true,
    },
    {
      id: 'pin',
      icon: <Shield className="h-5 w-5" />,
      title: 'PIN de Seguridad',
      description: 'Acceso a secciones protegidas',
      visible: true,
    },
    {
      id: 'tareas',
      icon: <ClipboardList className="h-5 w-5" />,
      title: 'Tareas y Peticiones',
      description: 'Vencimiento de peticiones',
      visible: true,
    },
  ];

  return (
    <div className="space-y-3">
      {items.filter(i => i.visible).map((item) => (
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
    </div>
  );
}
