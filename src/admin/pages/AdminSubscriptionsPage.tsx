import { useCallback, useEffect, useState } from 'react';
import {
  BadgeDollarSign,
  CreditCard,
  Loader2,
  ReceiptText,
  RefreshCw,
  Search,
  WalletCards,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { AdminCollectionCard } from '@/admin/components/AdminCollectionCard';
import { AdminPagination } from '@/admin/components/AdminPagination';
import { PriceChangeDrawer } from '@/admin/components/PriceChangeDrawer';
import {
  formatAdminDate,
  formatAdminMoney,
  planLabel,
  statusTone,
  subscriptionStatusLabel,
} from '@/admin/adminFormatters';
import { useAdminDebouncedValue } from '@/admin/useAdminDebouncedValue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Progress } from '@/components/ui/progress';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/StatusPill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { feedback } from '@/lib/feedback';
import {
  useApplyPlatformAdminPriceChange,
  usePlatformAdminPayments,
  usePlatformAdminPriceChangeStatus,
  usePlatformAdminPricePreview,
  usePlatformAdminSubscriptions,
  useProcessPlatformAdminPriceChange,
  useRetryPlatformAdminPriceChange,
} from '@/hooks/usePlatformAdmin';
import type {
  PlatformAdminPaymentDto,
  PlatformAdminPaymentStatus,
  PlatformAdminPlanDto,
  PlatformAdminPriceApplyInput,
  PlatformAdminPriceApplyResponse,
  PlatformAdminPriceChangeBatchDto,
  PlatformAdminPriceBatchStatus,
  PlatformAdminSubscriptionDto,
  PlatformAdminSubscriptionStatus,
} from '@/types/platformAdmin';

const PAGE_SIZE = 25;
type SubscriptionTab = 'planes' | 'suscripciones' | 'pagos';

export default function AdminSubscriptionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: SubscriptionTab = rawTab === 'suscripciones' || rawTab === 'pagos' ? rawTab : 'planes';

  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    params.delete('status');
    setSearchParams(params, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Suscripciones"
        subtitle="Catálogo, contratos y pagos de plataforma en una única superficie de control."
        icon={CreditCard}
      />

      <SegmentedControl
        value={tab}
        onChange={setTab}
        ariaLabel="Sección de suscripciones"
        options={[
          { value: 'planes', label: 'Planes' },
          { value: 'suscripciones', label: 'Suscripciones' },
          { value: 'pagos', label: 'Pagos' },
        ]}
        className="mb-6 max-w-xl"
      />

      {tab === 'planes' && <PlansPanel />}
      {tab === 'suscripciones' && <SubscriptionsPanel initialStatus={searchParams.get('status')} />}
      {tab === 'pagos' && <PaymentsPanel initialStatus={searchParams.get('status')} />}
    </div>
  );
}

function PlansPanel() {
  const plansQuery = usePlatformAdminSubscriptions({ page: 1, pageSize: 1, sort: { field: 'updatedAt', direction: 'desc' } });
  const statusQuery = usePlatformAdminPriceChangeStatus(
    { page: 1, pageSize: 25, sort: { field: 'updatedAt', direction: 'desc' } },
    { refetchInterval: (query) => {
      const status = query.state.data?.batch?.status;
      return status === 'pending' || status === 'processing' ? 3_000 : false;
    } },
  );
  const previewMutation = usePlatformAdminPricePreview();
  const applyMutation = useApplyPlatformAdminPriceChange();
  const processMutation = useProcessPlatformAdminPriceChange();
  const retryMutation = useRetryPlatformAdminPriceChange();
  const [selectedPlan, setSelectedPlan] = useState<PlatformAdminPlanDto | null>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const previewPlan = previewMutation.mutateAsync;
  const applyPrice = applyMutation.apply;
  const processBatch = processMutation.mutateAsync;
  const refetchBatchStatus = statusQuery.refetch;

  const preview = useCallback(
    (planCode: string) => previewPlan({ planCode }),
    [previewPlan],
  );
  const apply = useCallback(
    (input: PlatformAdminPriceApplyInput) => applyPrice(input),
    [applyPrice],
  );

  const drainBatch = useCallback(async (batchId: string) => {
    if (isProcessingBatch) return;
    setIsProcessingBatch(true);
    try {
      let hasMore = true;
      while (hasMore) {
        const result = await processBatch({ batchId });
        hasMore = result.hasMore;
      }
      feedback.success('El lote de precios terminó de procesarse.');
    } catch {
      feedback.error('El lote quedó pendiente de revisión.', {
        description: 'Podés continuarlo desde esta pantalla sin duplicar efectos.',
      });
    } finally {
      setIsProcessingBatch(false);
      void refetchBatchStatus();
    }
  }, [isProcessingBatch, processBatch, refetchBatchStatus]);

  const onApplied = useCallback((result: PlatformAdminPriceApplyResponse) => {
    feedback.success(`Nuevo precio de ${result.plan.name} guardado.`, {
      description: 'El catálogo ya está actualizado; comenzó la propagación a Mercado Pago.',
    });
    setSelectedPlan(null);
    void drainBatch(result.batch.id);
  }, [drainBatch]);

  const retryFailed = async () => {
    const batchId = statusQuery.data?.batch?.id;
    if (!batchId) return;
    try {
      const result = await retryMutation.mutateAsync({ batchId });
      feedback.success(`${result.reopened} ítems reabiertos para reintento.`);
      await drainBatch(batchId);
    } catch {
      feedback.error('No pudimos reabrir los ítems fallidos.');
    }
  };

  if (plansQuery.isError && !plansQuery.data) {
    return <AdminCollectionCard
      toolbar={<h2 className="text-base font-medium">Catálogo de planes</h2>}
      isPending={false}
      isError
      hasData={false}
      isEmpty={false}
      errorMessage="No pudimos cargar los planes."
      emptyIcon={WalletCards}
      emptyTitle="Sin planes"
      emptyDescription="No hay planes configurados."
      onRetry={() => void plansQuery.refetch()}
    >
      <div />
    </AdminCollectionCard>;
  }

  const plans = plansQuery.data?.plans ?? [];

  return (
    <div className="space-y-6">
      <section aria-labelledby="catalog-title">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 id="catalog-title" className="text-base font-medium text-foreground">Catálogo vigente</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Fuente única para Homepage, Registro, Facturación y checkout.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void plansQuery.refetch()} disabled={plansQuery.isFetching}>
            <RefreshCw className={plansQuery.isFetching ? 'animate-spin' : undefined} />
            Actualizar
          </Button>
        </div>

        {plansQuery.isPending ? (
          <div className="grid min-h-48 gap-4 md:grid-cols-3" />
        ) : plans.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No hay planes activos configurados.</Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.code} className="flex overflow-clip flex-col">
                <CardHeader className="border-b p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">{plan.description ?? 'Plan mensual de Vittro'}</p>
                    </div>
                    <StatusPill status={plan.isActive ? 'success' : 'neutral'} label={plan.isActive ? 'Publicado' : 'Oculto'} size="sm" />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col p-5">
                  <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{formatAdminMoney(plan.amountArs)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">por mes · ARS</p>
                  <dl className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-xs">
                    <div><dt className="text-muted-foreground">Versión</dt><dd className="mt-0.5 font-medium text-foreground">v{plan.priceVersion}</dd></div>
                    <div><dt className="text-muted-foreground">Actualizado</dt><dd className="mt-0.5 font-medium text-foreground">{formatAdminDate(plan.updatedAt)}</dd></div>
                  </dl>
                  <Button type="button" variant="outline" className="mt-5 w-full" onClick={() => setSelectedPlan(plan)}>
                    <BadgeDollarSign className="h-4 w-4" />
                    Cambiar precio
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <PriceBatchCard
        data={statusQuery.data?.batch ?? null}
        isLoading={statusQuery.isPending}
        isProcessing={isProcessingBatch || processMutation.isPending}
        isRetrying={retryMutation.isPending}
        onContinue={(batchId) => void drainBatch(batchId)}
        onRetry={() => void retryFailed()}
      />

      <PriceChangeDrawer
        open={Boolean(selectedPlan)}
        plan={selectedPlan}
        onOpenChange={(open) => {
          if (!open) setSelectedPlan(null);
        }}
        onPreview={preview}
        onApply={apply}
        onApplied={onApplied}
      />
    </div>
  );
}

function PriceBatchCard({
  data,
  isLoading,
  isProcessing,
  isRetrying,
  onContinue,
  onRetry,
}: {
  data: PlatformAdminPriceChangeBatchDto | null;
  isLoading: boolean;
  isProcessing: boolean;
  isRetrying: boolean;
  onContinue: (batchId: string) => void;
  onRetry: () => void;
}) {
  if (isLoading) return <Card className="h-40" />;
  if (!data) return null;

  const total = data.eligibleCount + data.skippedCount;
  const terminal = data.succeededCount + data.failedCount + data.skippedCount;
  const percent = total > 0 ? Math.min(100, Math.round((terminal / total) * 100)) : 100;
  const canContinue = ['pending', 'processing', 'interrupted', 'partially_failed'].includes(data.status);

  return (
    <Card className="overflow-clip">
      <CardHeader className="flex-row items-start justify-between gap-4 border-b p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Último lote</p>
          <CardTitle className="mt-1 text-base">{planLabel(data.planCode)} · {formatAdminMoney(data.previousAmountArs)} → {formatAdminMoney(data.nextAmountArs)}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Creado {formatAdminDate(data.createdAt, true)} por {data.actorAlias}</p>
        </div>
        <StatusPill status={statusTone(data.status)} label={batchStatusLabel(data.status)} />
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div>
          <div className="mb-2 flex items-center justify-between gap-4 text-xs">
            <span className="text-muted-foreground">{terminal} de {total} finalizados</span>
            <span className="font-medium tabular-nums text-foreground">{percent}%</span>
          </div>
          <Progress value={percent} className="h-2" />
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <BatchCount label="Pendientes" value={data.pendingCount} />
          <BatchCount label="Procesando" value={data.processingCount} />
          <BatchCount label="Correctos" value={data.succeededCount} />
          <BatchCount label="Fallidos" value={data.failedCount} warning={data.failedCount > 0} />
        </div>
        {(canContinue || data.failedCount > 0) && (
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            {data.failedCount > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={isProcessing || isRetrying}>
                {isRetrying ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Reintentar fallidos
              </Button>
            )}
            {canContinue && data.pendingCount > 0 && (
              <Button type="button" size="sm" onClick={() => onContinue(data.id)} disabled={isProcessing || isRetrying}>
                {isProcessing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Continuar lote
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BatchCount({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className={warning ? 'rounded-lg border border-status-warning bg-status-warning-bg p-3' : 'rounded-lg border border-border p-3'}>
      <p className={warning ? 'text-lg font-semibold tabular-nums text-status-warning-foreground' : 'text-lg font-semibold tabular-nums text-foreground'}>{value}</p>
      <p className="mt-0.5 text-muted-foreground">{label}</p>
    </div>
  );
}

function batchStatusLabel(status: PlatformAdminPriceBatchStatus) {
  const labels: Record<PlatformAdminPriceBatchStatus, string> = {
    pending: 'Pendiente',
    processing: 'Procesando',
    partially_failed: 'Resultado parcial',
    completed: 'Completo',
    failed: 'Fallido',
    interrupted: 'Interrumpido',
  };
  return labels[status];
}

function SubscriptionsPanel({ initialStatus }: { initialStatus: string | null }) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [planCode, setPlanCode] = useState('all');
  const [status, setStatus] = useState(initialStatus ?? 'all');
  const search = useAdminDebouncedValue(searchInput.trim());

  useEffect(() => setPage(1), [planCode, search, status]);

  const query = usePlatformAdminSubscriptions({
    page,
    pageSize: PAGE_SIZE,
    search,
    filters: {
      ...(planCode !== 'all' ? { planCode } : {}),
      ...(status !== 'all' ? { status: status as PlatformAdminSubscriptionStatus } : {}),
    },
    sort: { field: 'updatedAt', direction: 'desc' },
  });
  const result = query.data;
  const items = result?.items ?? [];

  return (
    <AdminCollectionCard
      toolbar={(
        <div className="space-y-4">
          <div><h2 className="text-base font-medium text-foreground">Contratos de suscripción</h2><p className="mt-0.5 text-xs text-muted-foreground">Importe contratado, período y vínculo con Mercado Pago.</p></div>
          <div className="grid gap-2 sm:grid-cols-[minmax(15rem,1fr)_11rem_12rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Buscar barbería…" aria-label="Buscar suscripciones" maxLength={200} className="pl-9" />
            </div>
            <PlanFilter value={planCode} onChange={setPlanCode} />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Filtrar suscripciones por estado"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="trialing">Trial</SelectItem>
                <SelectItem value="past_due">Pago pendiente</SelectItem>
                <SelectItem value="expired">Vencidas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
                <SelectItem value="legacy">Legacy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      isPending={query.isPending}
      isError={query.isError}
      isFetching={query.isFetching}
      hasData={Boolean(result)}
      isEmpty={Boolean(result && items.length === 0)}
      errorMessage="No pudimos cargar las suscripciones."
      emptyIcon={CreditCard}
      emptyTitle="No encontramos suscripciones"
      emptyDescription="Probá con otra búsqueda o quitá alguno de los filtros."
      onRetry={() => void query.refetch()}
      footer={result ? <AdminPagination page={result.page} pageSize={result.pageSize} total={result.total} onPageChange={setPage} disabled={query.isFetching} /> : undefined}
    >
      <div className="hidden md:block"><Table><TableHeader><TableRow>
        <TableHead>Barbería</TableHead><TableHead>Estado</TableHead><TableHead>Plan</TableHead><TableHead>Importe contratado</TableHead><TableHead>Próximo cobro</TableHead><TableHead>Proveedor</TableHead>
      </TableRow></TableHeader><TableBody>{items.map((item) => <SubscriptionRow key={item.id} item={item} />)}</TableBody></Table></div>
      <div className="divide-y divide-border md:hidden">{items.map((item) => <SubscriptionCard key={item.id} item={item} />)}</div>
    </AdminCollectionCard>
  );
}

function SubscriptionRow({ item }: { item: PlatformAdminSubscriptionDto }) {
  return <TableRow>
    <TableCell><p className="font-medium text-foreground">{item.organizationName}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.organizationSlug ?? 'Sin slug'}</p></TableCell>
    <TableCell><StatusPill status={statusTone(item.status)} label={subscriptionStatusLabel(item.status)} size="sm" />{item.cancelAtPeriodEnd && <p className="mt-1 text-[11px] text-status-warning-foreground">Cancela al cierre</p>}</TableCell>
    <TableCell><p>{planLabel(item.effectivePlanCode)}</p>{item.pendingPlanCode && <p className="mt-0.5 text-xs text-muted-foreground">Pendiente: {planLabel(item.pendingPlanCode)}</p>}</TableCell>
    <TableCell><p className="font-medium tabular-nums">{formatAdminMoney(item.billingAmountArs)}</p><p className="mt-0.5 text-xs text-muted-foreground">v{item.billingPriceVersion ?? '—'}</p></TableCell>
    <TableCell className="whitespace-nowrap">{formatAdminDate(item.nextPaymentDate ?? item.currentPeriodEnd)}</TableCell>
    <TableCell><StatusPill status={item.hasPreapproval ? 'success' : 'warning'} label={item.hasPreapproval ? 'Vinculado' : 'Sin preapproval'} size="sm" /></TableCell>
  </TableRow>;
}

function SubscriptionCard({ item }: { item: PlatformAdminSubscriptionDto }) {
  return <article className="space-y-3 p-4">
    <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-medium">{item.organizationName}</h3><p className="mt-0.5 text-xs text-muted-foreground">{planLabel(item.effectivePlanCode)}</p></div><StatusPill status={statusTone(item.status)} label={subscriptionStatusLabel(item.status)} size="sm" /></div>
    <dl className="grid grid-cols-2 gap-3 text-xs"><Info label="Importe" value={formatAdminMoney(item.billingAmountArs)} /><Info label="Versión" value={`v${item.billingPriceVersion ?? '—'}`} /><Info label="Próximo cobro" value={formatAdminDate(item.nextPaymentDate ?? item.currentPeriodEnd)} /><Info label="Mercado Pago" value={item.hasPreapproval ? 'Vinculado' : 'Sin preapproval'} /></dl>
  </article>;
}

function PaymentsPanel({ initialStatus }: { initialStatus: string | null }) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [planCode, setPlanCode] = useState('all');
  const [status, setStatus] = useState(initialStatus ?? 'all');
  const search = useAdminDebouncedValue(searchInput.trim());

  useEffect(() => setPage(1), [planCode, search, status]);
  const query = usePlatformAdminPayments({
    page,
    pageSize: PAGE_SIZE,
    search,
    filters: {
      ...(planCode !== 'all' ? { planCode } : {}),
      ...(status !== 'all' ? { status: status as PlatformAdminPaymentStatus } : {}),
    },
    sort: { field: 'createdAt', direction: 'desc' },
  });
  const result = query.data;
  const items = result?.items ?? [];

  return <AdminCollectionCard
    toolbar={<div className="space-y-4"><div><h2 className="text-base font-medium text-foreground">Pagos de suscripción</h2><p className="mt-0.5 text-xs text-muted-foreground">Solo campos permitidos; payloads del proveedor quedan fuera de esta interfaz.</p></div><div className="grid gap-2 sm:grid-cols-[minmax(15rem,1fr)_11rem_12rem]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Barbería o referencia…" aria-label="Buscar pagos" maxLength={200} className="pl-9" /></div><PlanFilter value={planCode} onChange={setPlanCode} /><Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Filtrar pagos por estado"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="approved">Aprobados</SelectItem><SelectItem value="pending">Pendientes</SelectItem><SelectItem value="rejected">Rechazados</SelectItem><SelectItem value="refunded">Reintegrados</SelectItem><SelectItem value="charged_back">Contracargos</SelectItem></SelectContent></Select></div></div>}
    isPending={query.isPending} isError={query.isError} isFetching={query.isFetching} hasData={Boolean(result)} isEmpty={Boolean(result && items.length === 0)}
    errorMessage="No pudimos cargar los pagos." emptyIcon={ReceiptText} emptyTitle="No encontramos pagos" emptyDescription="Probá con otra búsqueda o quitá alguno de los filtros." onRetry={() => void query.refetch()}
    footer={result ? <AdminPagination page={result.page} pageSize={result.pageSize} total={result.total} onPageChange={setPage} disabled={query.isFetching} /> : undefined}
  >
    <div className="hidden md:block"><Table><TableHeader><TableRow><TableHead>Barbería</TableHead><TableHead>Estado</TableHead><TableHead>Plan</TableHead><TableHead>Importe</TableHead><TableHead>Fecha efectiva</TableHead><TableHead>Referencia</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => <PaymentRow key={item.id} item={item} />)}</TableBody></Table></div>
    <div className="divide-y divide-border md:hidden">{items.map((item) => <PaymentCard key={item.id} item={item} />)}</div>
  </AdminCollectionCard>;
}

function PaymentRow({ item }: { item: PlatformAdminPaymentDto }) {
  return <TableRow><TableCell className="font-medium">{item.organizationName}</TableCell><TableCell><StatusPill status={statusTone(item.status)} label={subscriptionStatusLabel(item.status)} size="sm" /></TableCell><TableCell>{planLabel(item.planCode)}</TableCell><TableCell className="font-medium tabular-nums">{formatAdminMoney(item.amountArs, item.currencyId)}</TableCell><TableCell className="whitespace-nowrap">{formatAdminDate(item.paidAt ?? item.createdAt, true)}</TableCell><TableCell className="max-w-40 truncate text-xs text-muted-foreground">{item.providerPaymentReference ?? '—'}</TableCell></TableRow>;
}

function PaymentCard({ item }: { item: PlatformAdminPaymentDto }) {
  return <article className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-medium">{item.organizationName}</h3><p className="mt-0.5 text-xs text-muted-foreground">{planLabel(item.planCode)}</p></div><StatusPill status={statusTone(item.status)} label={subscriptionStatusLabel(item.status)} size="sm" /></div><dl className="grid grid-cols-2 gap-3 text-xs"><Info label="Importe" value={formatAdminMoney(item.amountArs, item.currencyId)} /><Info label="Fecha" value={formatAdminDate(item.paidAt ?? item.createdAt, true)} /><Info label="Proveedor" value={item.provider} /><Info label="Referencia" value={item.providerPaymentReference ?? '—'} /></dl></article>;
}

function PlanFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label="Filtrar por plan"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los planes</SelectItem><SelectItem value="basico">Básico</SelectItem><SelectItem value="profesional">Profesional</SelectItem><SelectItem value="premium">Premium</SelectItem></SelectContent></Select>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 break-words font-medium text-foreground">{value}</dd></div>;
}
