export const formatAdminDate = (value: string | null | undefined, includeTime = false) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
};

export const formatAdminMoney = (amount: number | null | undefined, currency = 'ARS') => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatAdminNumber = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('es-AR');

export const planLabel = (code: string | null | undefined) => {
  if (!code) return 'Sin plan';
  const labels: Record<string, string> = {
    basic: 'Básico',
    basico: 'Básico',
    professional: 'Profesional',
    profesional: 'Profesional',
    premium: 'Premium',
  };
  return labels[code.toLowerCase()] ?? code;
};

export const subscriptionStatusLabel = (status: string | null | undefined) => {
  if (!status) return 'Sin estado';
  const labels: Record<string, string> = {
    trialing: 'Trial vigente',
    active: 'Activa',
    authorized: 'Autorizada',
    pending: 'Pendiente',
    paused: 'Pausada',
    past_due: 'Pago pendiente',
    cancelled: 'Cancelada',
    canceled: 'Cancelada',
    expired: 'Vencida',
    rejected: 'Rechazada',
    approved: 'Aprobado',
    refunded: 'Reintegrado',
    legacy: 'Legacy',
  };
  return labels[status.toLowerCase()] ?? status;
};

export const statusTone = (status: string | null | undefined): 'success' | 'neutral' | 'info' | 'warning' | 'error' => {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'authorized':
    case 'approved':
    case 'completed':
      return 'success';
    case 'trialing':
    case 'processing':
    case 'pending':
      return 'info';
    case 'past_due':
    case 'paused':
    case 'partial':
    case 'partially_failed':
      return 'warning';
    case 'failed':
    case 'rejected':
    case 'expired':
    case 'interrupted':
      return 'error';
    default:
      return 'neutral';
  }
};
