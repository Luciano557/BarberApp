import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Service, Extra, Barber, Discount, Line } from '@/types/barbershop';
import { ConfigMenu } from './config/ConfigMenu';
import { NegocioConfig } from './config/NegocioConfig';
import { CobrarConfig } from './config/CobrarConfig';
import { PinConfigSection } from './PinConfigSection';

type ConfigSection = 'menu' | 'negocio' | 'cobrar' | 'pin';

interface ConfigurationPanelProps {
  services: Service[];
  extras: Extra[];
  barbers: Barber[];
  discounts: Discount[];
  lines: Line[];
  onAddService: (service: Omit<Service, 'id' | 'uid'>) => void;
  onUpdateService: (id: string, updates: Partial<Service>) => void;
  onAddExtra: (extra: Omit<Extra, 'id' | 'uid'>) => void;
  onUpdateExtra: (id: string, updates: Partial<Extra>) => void;
  onAddBarber: (barber: Omit<Barber, 'id' | 'uid'>) => void;
  onUpdateBarber: (id: string, updates: Partial<Barber>) => void;
  onAddDiscount: (discount: Omit<Discount, 'id'>) => void;
  onUpdateDiscount: (id: string, updates: Partial<Discount>) => void;
  onDeleteDiscount: (id: string) => void;
  onAddLine: (line: Omit<Line, 'id'>) => Promise<Line | null>;
  onUpdateLine: (id: string, updates: Partial<Line>) => void;
}

const sectionTitles: Record<ConfigSection, string> = {
  menu: 'Configuración',
  negocio: 'Negocio',
  cobrar: 'Cobrar',
  pin: 'PIN de Seguridad',
};

export function ConfigurationPanel({
  services, extras, barbers, discounts, lines,
  onAddService, onUpdateService,
  onAddExtra, onUpdateExtra,
  onAddBarber, onUpdateBarber,
  onAddDiscount, onUpdateDiscount, onDeleteDiscount,
  onAddLine, onUpdateLine,
}: ConfigurationPanelProps) {
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
          <h1 className="text-2xl font-semibold text-foreground">{sectionTitles[activeSection]}</h1>
          {activeSection === 'menu' && (
            <p className="text-muted-foreground text-sm mt-1">Administrá tu negocio y configuraciones</p>
          )}
        </div>
      </div>

      {activeSection === 'menu' && (
        <ConfigMenu onSelect={setActiveSection} />
      )}

      {activeSection === 'negocio' && (
        <NegocioConfig
          barbers={barbers}
          onAddBarber={onAddBarber}
          onUpdateBarber={onUpdateBarber}
        />
      )}

      {activeSection === 'cobrar' && (
        <CobrarConfig
          services={services} extras={extras} discounts={discounts} lines={lines}
          onAddService={onAddService} onUpdateService={onUpdateService}
          onAddExtra={onAddExtra} onUpdateExtra={onUpdateExtra}
          onAddDiscount={onAddDiscount} onUpdateDiscount={onUpdateDiscount}
          onDeleteDiscount={onDeleteDiscount}
          onAddLine={onAddLine} onUpdateLine={onUpdateLine}
        />
      )}

      {activeSection === 'pin' && (
        <PinConfigSection />
      )}
    </div>
  );
}
