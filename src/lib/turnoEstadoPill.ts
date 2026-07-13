import type { StatusPillStatus } from '@/components/ui/StatusPill';

export const TURNO_ESTADO_PILL: Record<string, { label: string; status: StatusPillStatus }> = {
  pendiente:  { label: 'Pendiente',  status: 'warning' },
  confirmado: { label: 'Confirmado', status: 'success' },
  en_curso:   { label: 'En curso',   status: 'info' },
  completado: { label: 'Completado', status: 'neutral' },
  cancelado:  { label: 'Cancelado',  status: 'error' },
};
