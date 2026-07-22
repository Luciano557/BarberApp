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
  recargos: number;
  descuentos: number;
  costoLaboralPct: number;
  /** Solo tiene valor real en las series por-barbero de la Sección Equipo (ver buildBarberoSeries
   * en EstadisticasPanel.tsx); en la serie global de la organización queda en 0. Se agregó acá,
   * en vez de crear un tipo nuevo, para poder reusar MetricDetailDialog sin modificarlo. */
  comisionDevengada: number;
  tasaAttachExtras: number;
  clientesNuevos: number;
  /** Desglose por origen — solo se completa para la métrica "Clientes nuevos" (Sección 4);
   * ver MetricCardDef.origenKeys y su render condicional en MetricDetailDialog. */
  clientesManual: number;
  clientesImportado: number;
  clientesReserva: number;
  pctEligioBarbero: number;
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
  recargosVar: number | null;
  descuentosVar: number | null;
  costoLaboralPctVar: number | null;
  comisionDevengadaVar: number | null;
  tasaAttachExtrasVar: number | null;
  clientesNuevosVar: number | null;
  pctEligioBarberoVar: number | null;
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
  /** Si se completa, MetricDetailDialog agrega 3 columnas de desglose en la tabla mensual
   * (ej. Manual/Importado/Reserva para "Clientes nuevos"). Opcional — no afecta a los demás
   * consumidores del diálogo. */
  origenKeys?: {
    manual: keyof DerivedMonthlyMetrics;
    importado: keyof DerivedMonthlyMetrics;
    reserva: keyof DerivedMonthlyMetrics;
  };
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
  recargos: 'recargosVar',
  descuentos: 'descuentosVar',
  costoLaboralPct: 'costoLaboralPctVar',
  comisionDevengada: 'comisionDevengadaVar',
  tasaAttachExtras: 'tasaAttachExtrasVar',
  clientesNuevos: 'clientesNuevosVar',
  pctEligioBarbero: 'pctEligioBarberoVar',
};
