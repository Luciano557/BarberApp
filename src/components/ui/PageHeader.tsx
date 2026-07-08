import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle: React.ReactNode;
  actions?: React.ReactNode;
  actionsLayout?: 'inline' | 'row';
  className?: string;
}

export function PageHeader({ title, subtitle, actions, actionsLayout = 'inline', className }: PageHeaderProps) {
  return (
    <div className={cn('pl-14 sm:pl-0 mb-6', className)}>
      <div className={cn('flex flex-col gap-4', actionsLayout === 'inline' && 'sm:flex-row sm:items-start sm:justify-between')}>
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-primary">
            <img src="/favicon.png" alt="Vittro" className="h-6 w-6 object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
