import { ArrowRight, BarChart3, CalendarClock, Crown, Lock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BillingPlanCode } from '@/hooks/useSubscriptionAccess';
import { PLAN_LABELS } from '@/lib/planAccess';

type PreviewVariant = 'analytics' | 'finance' | 'agenda' | 'clients' | 'tasks';

interface PlanLockedFeatureProps {
  title: string;
  description?: string;
  requiredPlan: BillingPlanCode;
  currentPlan: BillingPlanCode;
  onManagePlan: () => void;
  variant?: PreviewVariant;
  className?: string;
}

const VARIANT_ICON: Record<PreviewVariant, typeof BarChart3> = {
  analytics: BarChart3,
  finance: Crown,
  agenda: CalendarClock,
  clients: Users,
  tasks: Lock,
};

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
      <div className="mt-3 h-1.5 rounded-full bg-muted">
        <div className="h-full w-2/3 rounded-full bg-primary/35" />
      </div>
    </div>
  );
}

function PreviewRows({ labels }: { labels: string[] }) {
  return (
    <div className="space-y-2">
      {labels.map((label, index) => (
        <div key={label} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <div className="mt-1 h-2 w-2/3 rounded-full bg-muted" />
          </div>
          <div className={cn('h-2 rounded-full bg-muted', index % 2 === 0 ? 'w-16' : 'w-10')} />
        </div>
      ))}
    </div>
  );
}

function PreviewChart() {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Servicios</p>
          <p className="text-xs text-muted-foreground">Rendimiento mensual</p>
        </div>
        <Badge variant="outline">Vista avanzada</Badge>
      </div>
      <div className="flex h-40 items-end gap-2">
        {[42, 68, 54, 88, 72, 96, 60, 78].map((height, index) => (
          <div key={index} className="flex flex-1 items-end rounded-t bg-primary/10">
            <div className="w-full rounded-t bg-primary/35" style={{ height: `${height}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FeaturePreview({ variant }: { variant: PreviewVariant }) {
  if (variant === 'analytics') {
    return (
      <div className="space-y-3 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <PreviewMetric label="Facturacion" value="$1.250.000" />
          <PreviewMetric label="Servicios" value="342" />
          <PreviewMetric label="Ticket promedio" value="$8.900" />
        </div>
        <PreviewChart />
      </div>
    );
  }

  if (variant === 'agenda') {
    return (
      <div className="space-y-3 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-3">
          {['09:00', '10:30', '12:00', '15:00', '16:30', '18:00'].map((time) => (
            <div key={time} className="rounded-lg border border-border bg-background p-3">
              <p className="font-mono text-xs text-muted-foreground">{time}</p>
              <p className="mt-2 text-sm font-medium text-foreground">Turno reservado</p>
              <div className="mt-2 h-2 w-2/3 rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'clients') {
    return (
      <div className="space-y-3 p-4 sm:p-5">
        <div className="h-10 rounded-lg border border-border bg-background" />
        <PreviewRows labels={['Cliente frecuente', 'Cliente nuevo', 'Cliente con historial']} />
      </div>
    );
  }

  if (variant === 'tasks') {
    return (
      <div className="space-y-3 p-4 sm:p-5">
        <PreviewRows labels={['Reponer productos', 'Confirmar proveedor', 'Revisar cierre semanal']} />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <PreviewMetric label="Periodo actual" value="$640.000" />
        <PreviewMetric label="Pendiente" value="$120.000" />
      </div>
      <PreviewRows labels={['Detalle por barbero', 'Movimiento mensual', 'Registro avanzado']} />
    </div>
  );
}

export function PlanLockPill({ requiredPlan }: { requiredPlan: BillingPlanCode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-status-warning-bg px-2 py-0.5 text-[10px] font-medium text-status-warning-foreground">
      <Lock className="h-3 w-3" />
      {PLAN_LABELS[requiredPlan]}
    </span>
  );
}

export function PlanLockedFeature({
  title,
  description,
  requiredPlan,
  currentPlan,
  onManagePlan,
  variant = 'finance',
  className,
}: PlanLockedFeatureProps) {
  const Icon = VARIANT_ICON[variant];

  return (
    <div className={cn('relative min-h-[360px] overflow-hidden rounded-lg border border-border bg-card shadow-sm', className)}>
      <div aria-hidden="true" className="pointer-events-none select-none blur-[2px] opacity-55">
        <FeaturePreview variant={variant} />
      </div>

      <div className="absolute inset-0 bg-background/70" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-4 text-center shadow-lg sm:p-5">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
            <Badge variant="outline">Plan actual: {PLAN_LABELS[currentPlan]}</Badge>
            <PlanLockPill requiredPlan={requiredPlan} />
          </div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mx-auto mt-2 max-w-[52ch] text-sm leading-6 text-muted-foreground">
            {description ?? `Amplia al plan ${PLAN_LABELS[requiredPlan]} para usar esta funcion.`}
          </p>
          <Button onClick={onManagePlan} className="mt-4 w-full sm:w-auto">
            Ver Plan y Suscripcion
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
