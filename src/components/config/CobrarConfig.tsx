import { useState } from 'react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ServicesConfig } from './ServicesConfig';
import { ExtrasConfig } from './ExtrasConfig';
import { Service, Extra, Line } from '@/types/barbershop';

interface CobrarConfigProps {
  services: Service[];
  extras: Extra[];
  lines: Line[];
  onAddService: (service: Omit<Service, 'id' | 'uid'>) => void;
  onUpdateService: (id: string, updates: Partial<Service>) => void;
  onAddExtra: (extra: Omit<Extra, 'id' | 'uid'>) => void;
  onUpdateExtra: (id: string, updates: Partial<Extra>) => void;
  onAddLine: (line: Omit<Line, 'id'>) => Promise<Line | null>;
  onUpdateLine: (id: string, updates: Partial<Line>) => void;
  canCreateServices?: boolean;
  canEditServiceStructure?: boolean;
}

export function CobrarConfig({
  services, extras, lines,
  onAddService, onUpdateService,
  onAddExtra, onUpdateExtra,
  onAddLine, onUpdateLine,
  canCreateServices = true,
  canEditServiceStructure = true,
}: CobrarConfigProps) {
  const [activeTab, setActiveTab] = useState<'services' | 'extras'>('services');

  return (
    <div className="space-y-4">
      <SegmentedControl
        options={[
          { value: 'services', label: 'Servicios' },
          { value: 'extras', label: 'Extras' },
        ]}
        value={activeTab}
        onChange={(v) => setActiveTab(v as 'services' | 'extras')}
      />

      {activeTab === 'services' && (
        <div className="animate-fade-in">
          <ServicesConfig
            services={services}
            lines={lines}
            onAdd={onAddService}
            onUpdate={onUpdateService}
            onAddLine={onAddLine}
            canCreate={canCreateServices}
            canEditStructure={canEditServiceStructure}
          />
        </div>
      )}

      {activeTab === 'extras' && (
        <div className="animate-fade-in">
          <p className="text-xs text-muted-foreground mb-4">
            Para crear o eliminar extras, usá la vista general del negocio.
          </p>
          <ExtrasConfig
            extras={extras}
            onAdd={onAddExtra}
            onUpdate={onUpdateExtra}
          />
        </div>
      )}
    </div>
  );
}
