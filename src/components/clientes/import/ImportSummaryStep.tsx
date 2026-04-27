import { Card } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  inserted: number;
  total: number;
  errors: Array<{ index: number; error: string }>;
}

export function ImportSummaryStep({ inserted, total, errors }: Props) {
  return (
    <div className="space-y-4">
      <Card className="p-5 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-500" />
        </div>
        <p className="text-base font-medium">
          Se importaron {inserted} de {total} clientes
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Ya están disponibles en la sucursal seleccionada.
        </p>
      </Card>

      {errors.length > 0 && (
        <Card className="p-4 border-destructive/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <p className="text-sm font-medium">
              {errors.length} {errors.length === 1 ? 'fila no se pudo importar' : 'filas no se pudieron importar'}
            </p>
          </div>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {errors.map((e, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                Fila {e.index}: {e.error}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
