import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEXTO_AVISO_PAUSA_SIN_DATO, textoAvisoPausa, type PausaAvisoTipo } from '@/lib/tareasAutomaticas';

interface Props {
  tipo: PausaAvisoTipo;
  /** `undefined` = todavía consultando (no se muestra nada); `null` = no se pudo consultar; `0` = nada que avisar. */
  cantidad: number | null | undefined;
  /** `sm` para los diálogos de Equipo (texto chico), `md` para el de Sucursal. */
  size?: 'sm' | 'md';
}

/**
 * Aviso previo, dentro de un AlertDialog existente, de que la acción va a pausar Tareas automáticas.
 * Usa el mismo recuadro de advertencia que ya tienen esos diálogos para "turnos futuros".
 */
export function TareasAutomaticasPausaAviso({ tipo, cantidad, size = 'sm' }: Props) {
  if (cantidad === undefined) return null;
  const texto = cantidad === null ? TEXTO_AVISO_PAUSA_SIN_DATO : textoAvisoPausa(tipo, cantidad);
  if (!texto) return null;
  const small = size === 'sm';
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10',
        small ? 'p-2 text-xs text-foreground' : 'p-3 text-sm text-status-warning-foreground',
      )}
    >
      <AlertTriangle className={cn('mt-0.5 shrink-0', small ? 'h-3.5 w-3.5 text-status-warning' : 'h-4 w-4')} />
      <span>{texto}</span>
    </div>
  );
}
