import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CatalogSectionCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Zona de acciones — derecha del header. Acepta botones, Switch+Label, cualquier ReactNode. */
  actions?: React.ReactNode;
  /**
   * Alineación vertical del header cuando hay actions.
   * 'start' para bloques de acción verticales (ej: Switch + texto descriptivo).
   */
  headerAlign?: 'center' | 'start';
  /** Buscador — se renderiza arriba de tabs, dentro de CardContent. */
  search?: React.ReactNode;
  /** SegmentedControl o cualquier ReactNode — se renderiza debajo de search. */
  tabs?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function CatalogSectionCard({
  icon: Icon,
  title,
  description,
  actions,
  headerAlign = 'center',
  search,
  tabs,
  children,
  className,
}: CatalogSectionCardProps) {
  return (
    <Card className={cn('border border-border bg-card', className)}>
      <CardHeader>
        <div
          className={cn(
            'flex flex-col gap-3 sm:flex-row sm:justify-between',
            headerAlign === 'center' ? 'sm:items-center' : 'sm:items-start',
          )}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-muted p-2">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
          {actions && (
            <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
              {actions}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {search && <div>{search}</div>}
        {tabs && <div>{tabs}</div>}
        {children}
      </CardContent>
    </Card>
  );
}
