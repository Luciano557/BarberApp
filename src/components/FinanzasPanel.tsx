import { useState } from 'react';
import { ArrowLeft, Receipt, TrendingUp, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GastosPanel } from '@/components/GastosPanel';
import { InversionesPanel } from '@/components/InversionesPanel';
import { DeudasPanel } from '@/components/DeudasPanel';

type FinanzasSection = 'menu' | 'gastos' | 'inversiones' | 'deudas';

const sectionTitles: Record<FinanzasSection, string> = {
  menu: 'Finanzas',
  gastos: 'Gastos',
  inversiones: 'Inversiones',
  deudas: 'Deudas',
};

const menuItems = [
  {
    id: 'gastos' as const,
    icon: Receipt,
    title: 'Gastos',
    description: 'Egresos operativos del local. Controlá cuánto cuesta operar el negocio mes a mes.',
  },
  {
    id: 'inversiones' as const,
    icon: TrendingUp,
    title: 'Inversiones',
    description: 'Compras o mejoras que generan valor. Distribuí el costo en el tiempo con amortización.',
  },
  {
    id: 'deudas' as const,
    icon: Landmark,
    title: 'Deudas',
    description: 'Dinero que el negocio todavía debe. Registrá cuotas y controlá pagos pendientes.',
  },
];

export function FinanzasPanel() {
  const [activeSection, setActiveSection] = useState<FinanzasSection>('menu');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {activeSection !== 'menu' && (
          <Button variant="ghost" size="icon" onClick={() => setActiveSection('menu')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <h2 className="text-2xl font-bold text-foreground">{sectionTitles[activeSection]}</h2>
      </div>

      {/* Menu */}
      {activeSection === 'menu' && (
        <div className="grid gap-4">
          {menuItems.map(item => (
            <Card
              key={item.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setActiveSection(item.id)}
            >
              <CardContent className="flex items-center gap-4 py-5">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  <item.icon className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sub-sections */}
      {activeSection === 'gastos' && <GastosPanel />}
      {activeSection === 'inversiones' && <InversionesPanel />}
      {activeSection === 'deudas' && <DeudasPanel />}
    </div>
  );
}
