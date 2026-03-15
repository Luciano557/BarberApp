import { useState } from 'react';
import { ArrowLeft, Building2, MapPin, Crown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { OrganizationSettings } from './OrganizationSettings';
import { SucursalesConfig } from './config/SucursalesConfig';

type Section = 'menu' | 'info' | 'sucursales' | 'plan';

const sectionTitles: Record<Section, string> = {
  menu: 'Mi Negocio',
  info: 'Información',
  sucursales: 'Sucursales',
  plan: 'Plan',
};

interface MenuItem {
  id: Section;
  icon: React.ReactNode;
  title: string;
  description: string;
  visible: boolean;
}

export function MiNegocioPanel() {
  const [activeSection, setActiveSection] = useState<Section>('menu');

  const items: MenuItem[] = [
    {
      id: 'info',
      icon: <Building2 className="h-5 w-5" />,
      title: 'Información del Negocio',
      description: 'Nombre, dirección, teléfono y zona horaria',
      visible: true,
    },
    {
      id: 'sucursales',
      icon: <MapPin className="h-5 w-5" />,
      title: 'Sucursales',
      description: 'Gestionar sucursales, usuarios y roles',
      visible: true,
    },
    {
      id: 'plan',
      icon: <Crown className="h-5 w-5" />,
      title: 'Plan y Suscripción',
      description: 'Ver plan actual y límites',
      visible: true,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        {activeSection !== 'menu' && (
          <Button variant="ghost" size="icon" onClick={() => setActiveSection('menu')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{sectionTitles[activeSection]}</h1>
          {activeSection === 'menu' && (
            <p className="text-muted-foreground text-sm mt-1">Administración general de tu negocio</p>
          )}
        </div>
      </div>

      {activeSection === 'menu' && (
        <div className="space-y-3">
          {items.filter(i => i.visible).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
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
      )}

      {activeSection === 'info' && <OrganizationSettings />}
      {activeSection === 'sucursales' && <SucursalesConfig />}
      {activeSection === 'usuarios' && <UserManagement barbers={allBarbers} />}
      {activeSection === 'plan' && <OrganizationSettings />}
    </div>
  );
}
