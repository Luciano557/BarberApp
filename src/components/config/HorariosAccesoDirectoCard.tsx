import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface HorariosAccesoDirectoCardProps {
  /** Abre Mi Negocio en la ficha de esta sucursal, sobre "Horarios de atención". */
  onGoToHorarios?: () => void;
}

/**
 * Los horarios de trabajo se configuran en Mi Negocio › ficha de sucursal.
 * Acá queda solo el acceso directo para quien los busca desde Turnos.
 */
export function HorariosAccesoDirectoCard({ onGoToHorarios }: HorariosAccesoDirectoCardProps) {
  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-muted p-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Horarios de trabajo</p>
          <p className="text-xs text-muted-foreground">
            Se configuran desde Mi Negocio, en la ficha de cada sucursal
          </p>
        </div>
      </div>
      {onGoToHorarios && (
        <Button variant="outline" size="sm" onClick={onGoToHorarios} className="sm:shrink-0">
          Ir a horarios
        </Button>
      )}
    </Card>
  );
}
