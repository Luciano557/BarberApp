import type { StatusPillStatus } from '@/components/ui/StatusPill';

export const TURNO_ESTADO_PILL: Record<string, { label: string; status: StatusPillStatus }> = {
  pendiente:  { label: 'Pendiente',  status: 'warning' },
  confirmado: { label: 'Confirmado', status: 'success' },
  completado: { label: 'Completado', status: 'neutral' },
  cancelado:  { label: 'Cancelado',  status: 'error' },
};
