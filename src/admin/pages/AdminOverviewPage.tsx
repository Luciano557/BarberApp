import { AlertTriangle, Banknote, Building2, CreditCard, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { AdminMetricCard } from '@/admin/components/AdminMetricCard';
import { formatAdminDate, formatAdminMoney, formatAdminNumber, subscriptionStatusLabel } from '@/admin/adminFormatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InlineReadError } from '@/components/ui/InlineReadError';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { useDelayedVisible } from '@/hooks/useDelayedVisible';
import { usePlatformAdminOverview } from '@/hooks/usePlatformAdmin';

export default function AdminOverviewPage() {
  const query = usePlatformAdminOverview();
  const showSkeleton = useDelayedVisible(query.isPending);
  const data = query.data;

  return (
    <div>
      <PageHeader
        title="Resumen"
        subtitle={data ? `Vista global actualizada ${formatAdminDate(data.generatedAt, true)}.` : 'Estado global de acceso, actividad y cobros de Vittro.'}
        icon={ShieldAlert}
        actions={(
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={query.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Actualizar
          </Button>
        )}
      />

      {query.isError && !data ? (
        <InlineReadError message="No pudimos cargar el resumen administrativo." onRetry={() => void query.refetch()} />
      ) : query.isPending && !showSkeleton ? (
        <div className="min-h-72" />
      ) : (
        <div className="space-y-6">
          <section aria-label="Indicadores principales" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              label="Barberías con acceso"
              value={data ? formatAdminNumber(data.barberiasAcceso) : undefined}
              hint="Organizaciones habilitadas con trial o suscripción vigente."
              icon={Building2}
              tone="info"
              loading={!data}
            />
            <AdminMetricCard
              label="Usuarios activos"
              value={data ? formatAdminNumber(data.mau30) : undefined}
              hint="Cuentas tenant con inicio de sesión en los últimos 30 días."
              icon={Users}
              tone="success"
              loading={!data}
            />
            <AdminMetricCard
              label="Cobros aprobados"
              value={data ? formatAdminMoney(data.cobrosAprobados30.amountArs) : undefined}
              hint={data ? `${formatAdminNumber(data.cobrosAprobados30.count)} pagos aprobados en 30 días.` : 'Pagos aprobados en los últimos 30 días.'}
              icon={Banknote}
              tone="neutral"
              loading={!data}
            />
            <AdminMetricCard
              label="Incidencias"
              value={data ? formatAdminNumber(data.incidencias) : undefined}
              hint="Cobros, suscripciones o lotes que requieren revisión."
              icon={AlertTriangle}
              tone={data?.incidencias ? 'warning' : 'success'}
              loading={!data}
            />
          </section>

          {data && (
            <section className="grid gap-4 lg:grid-cols-2" aria-label="Distribuciones operativas">
              <BreakdownCard
                title="Acceso de barberías"
                icon={Building2}
                values={data.breakdowns.organizations}
                order={['active', 'trialing', 'legacy', 'past_due', 'expired', 'cancelled', 'inactive', 'unknown']}
              />
              <BreakdownCard
                title="Suscripciones"
                icon={CreditCard}
                values={data.breakdowns.subscriptions}
                order={['active', 'trialing', 'past_due', 'expired', 'cancelled', 'legacy', 'inactive', 'unknown']}
              />
            </section>
          )}

          {data && (
            <Card className="overflow-clip">
              <CardHeader className="flex-row items-start justify-between gap-4 border-b">
                <div>
                  <CardTitle className="text-base">Cola de atención</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Prioriza las excepciones de facturación y propagación de precios.</p>
                </div>
                <StatusPill
                  status={data.incidencias > 0 ? 'warning' : 'success'}
                  label={data.incidencias > 0 ? `${data.incidencias} por revisar` : 'Sin incidencias'}
                />
              </CardHeader>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
                <QueueItem label="Pagos rechazados" value={data.breakdowns.payments30.rejected ?? 0} to="/admin/suscripciones?tab=pagos&status=rejected" />
                <QueueItem label="Suscripciones con deuda" value={data.breakdowns.subscriptions.past_due ?? 0} to="/admin/suscripciones?tab=suscripciones&status=past_due" />
                <QueueItem label="Lotes parciales" value={data.breakdowns.priceChanges.partially_failed ?? 0} to="/admin/auditoria?result=partial" />
                <QueueItem label="Lotes interrumpidos" value={data.breakdowns.priceChanges.interrupted ?? 0} to="/admin/auditoria?result=failure" />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function BreakdownCard({
  title,
  icon: Icon,
  values,
  order,
}: {
  title: string;
  icon: typeof Building2;
  values: Partial<Record<string, number>>;
  order: string[];
}) {
  const rows = order.filter((key) => (values[key] ?? 0) > 0);
  const total = Object.values(values).reduce((sum, value) => sum + (value ?? 0), 0);

  return (
    <Card className="overflow-clip">
      <CardHeader className="flex-row items-center gap-3 border-b p-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatAdminNumber(total)} registros clasificados</p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No hay datos para esta distribución.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((key) => (
              <li key={key} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="text-sm text-muted-foreground">{subscriptionStatusLabel(key)}</span>
                <span className="text-sm font-semibold tabular-nums text-foreground">{formatAdminNumber(values[key])}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function QueueItem({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-border p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="text-xl font-semibold tabular-nums text-foreground">{formatAdminNumber(value)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </Link>
  );
}
