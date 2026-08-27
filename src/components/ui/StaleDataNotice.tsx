import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StaleDataNoticeProps {
  onRefresh: () => void;
  className?: string;
}

/**
 * Marca persistente y discreta de "estos datos podrían estar viejos" —
 * exclusiva de Agenda y del resumen diario de Caja (DESIGN.md → Loading).
 * Desaparece sola en cuanto una actualización posterior tiene éxito; eso lo
 * decide el consumidor dejando de renderizarla, no este componente.
 */
export function StaleDataNotice({ onRefresh, className }: StaleDataNoticeProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-md border border-status-warning bg-status-warning-bg px-2.5 py-2 text-xs text-status-warning-foreground',
        className,
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">Estos datos podrían estar desactualizados.</span>
      <button
        type="button"
        onClick={onRefresh}
        className="font-medium underline underline-offset-2 hover:no-underline"
      >
        Actualizar
      </button>
    </div>
  );
}
