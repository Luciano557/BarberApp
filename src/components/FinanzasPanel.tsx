import { Receipt, TrendingUp, Landmark, BarChart3, Wallet } from 'lucide-react';
import { GastosPanel } from '@/components/GastosPanel';
import { InversionesPanel } from '@/components/InversionesPanel';
import { DeudasPanel } from '@/components/DeudasPanel';
import { EstadisticasPanel } from '@/components/EstadisticasPanel';
import { SueldosPanel } from '@/components/SueldosPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Barber } from '@/types/barbershop';

interface FinanzasPanelProps {
  barbers: Barber[];
}

export function FinanzasPanel({ barbers }: FinanzasPanelProps) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Finanzas</h2>
      <Tabs defaultValue="gastos">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
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
          <TabsTrigger value="estadisticas" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Estadísticas
          </TabsTrigger>
          <TabsTrigger value="sueldos" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Sueldos
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
        <TabsContent value="estadisticas">
          <EstadisticasPanel />
        </TabsContent>
        <TabsContent value="sueldos">
          <SueldosPanel barbers={barbers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}