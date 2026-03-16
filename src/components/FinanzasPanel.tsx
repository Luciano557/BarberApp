import { useState } from 'react';
import { ArrowLeft, Receipt, TrendingUp, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GastosPanel } from '@/components/GastosPanel';
import { InversionesPanel } from '@/components/InversionesPanel';
import { DeudasPanel } from '@/components/DeudasPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Finanzas</h2>
      <Tabs defaultValue="gastos">
        <TabsList className="mb-6">
          <TabsTrigger value="gastos" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Gastos
          </TabsTrigger>
          <TabsTrigger value="inversiones" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Inversiones
          </TabsTrigger>
          <TabsTrigger value="deudas" className="flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            Deudas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gastos">
          <GastosPanel />
        </TabsContent>
        <TabsContent value="inversiones">
          <InversionesPanel />
        </TabsContent>
        <TabsContent value="deudas">
          <DeudasPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}