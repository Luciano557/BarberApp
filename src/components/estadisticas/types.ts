import { DollarSign } from 'lucide-react';

export interface DerivedMonthlyMetrics {
  monthLabel: string;
  facturacion: number;
  servicios: number;
  efectivo: number;
  mp: number;
  costosFijos: number;
  rentabilidad: number;
  ticketPromedio: number;
  costoFijoPorServicio: number;
  costoVariablePorServicio: number;
  gananciaPorServicio: number;
  puntoEquilibrio: number;
  tasaOcupacion: number;
  isCurrentMonth?: boolean;
  diasTranscurridos?: number;
  // Variation fields (% change vs previous month)
  facturacionVar: number | null;
  serviciosVar: number | null;
  efectivoVar: number | null;
  mpVar: number | null;
  costosFijosVar: number | null;
  rentabilidadVar: number | null;
  ticketPromedioVar: number | null;
  costoFijoPorServicioVar: number | null;
  costoVariablePorServicioVar: number | null;
  gananciaPorServicioVar: number | null;
  puntoEquilibrioVar: number | null;
  tasaOcupacionVar: number | null;
}

export type MetricCardDef = {
  title: string;
  dataKey: keyof DerivedMonthlyMetrics;
  icon: typeof DollarSign;
  color: string;
  chartColor: string;
  formatFn: (v: number) => string;
  shortFormatFn: (v: number) => string;
  description: string;
};

export const varKeyMap: Record<string, keyof DerivedMonthlyMetrics> = {
  facturacion: 'facturacionVar',
  servicios: 'serviciosVar',
  efectivo: 'efectivoVar',
  mp: 'mpVar',
  costosFijos: 'costosFijosVar',
  rentabilidad: 'rentabilidadVar',
  ticketPromedio: 'ticketPromedioVar',
  costoFijoPorServicio: 'costoFijoPorServicioVar',
  costoVariablePorServicio: 'costoVariablePorServicioVar',
  gananciaPorServicio: 'gananciaPorServicioVar',
  puntoEquilibrio: 'puntoEquilibrioVar',
  tasaOcupacion: 'tasaOcupacionVar',
};
