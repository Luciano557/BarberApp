import { useEffect, useState } from 'react';
import { FileSearch, ScrollText, Search } from 'lucide-react';

import { AdminCollectionCard } from '@/admin/components/AdminCollectionCard';
import { AdminPagination } from '@/admin/components/AdminPagination';
import { formatAdminDate, statusTone } from '@/admin/adminFormatters';
import { useAdminDebouncedValue } from '@/admin/useAdminDebouncedValue';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/StatusPill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePlatformAdminAudit } from '@/hooks/usePlatformAdmin';
import type { PlatformAdminAuditDto } from '@/types/platformAdmin';

const PAGE_SIZE = 25;

const RESULT_LABELS: Record<PlatformAdminAuditDto['result'], string> = {
  success: 'Correcto',
  partial: 'Parcial',
  failure: 'Fallido',
};

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [action, setAction] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const search = useAdminDebouncedValue(searchInput.trim());

  useEffect(() => setPage(1), [action, resultFilter, search]);

  const query = usePlatformAdminAudit({
    page,
    pageSize: PAGE_SIZE,
    search,
    filters: {
      ...(action !== 'all' ? { action } : {}),
      ...(resultFilter !== 'all' ? { result: resultFilter as PlatformAdminAuditDto['result'] } : {}),
    },
    sort: { field: 'createdAt', direction: 'desc' },
  });
  const result = query.data;
  const items = result?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Auditoría"
        subtitle="Trazabilidad de acciones administrativas, motivos y resultados sin secretos ni payloads completos."
        icon={ScrollText}
      />

      <AdminCollectionCard
        toolbar={(
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-medium text-foreground">Registro administrativo</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Cada solicitud conserva un identificador para diagnóstico.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(15rem,1fr)_13rem_11rem]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Actor, motivo, objetivo o request ID…"
                  aria-label="Buscar auditoría"
                  maxLength={200}
                  className="pl-9"
                />
              </div>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger aria-label="Filtrar por acción"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las acciones</SelectItem>
                  <SelectItem value="subscription_price_change.created">Cambio de precio</SelectItem>
                  <SelectItem value="subscription_price_change.processed">Proceso de lote</SelectItem>
                  <SelectItem value="subscription_price_change.retried">Reintento de lote</SelectItem>
                </SelectContent>
              </Select>
              <Select value={resultFilter} onValueChange={setResultFilter}>
                <SelectTrigger aria-label="Filtrar por resultado"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo resultado</SelectItem>
                  <SelectItem value="success">Correcto</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="failure">Fallido</SelectItem>
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
        errorMessage="No pudimos cargar la auditoría."
        emptyIcon={FileSearch}
        emptyTitle="No encontramos eventos"
        emptyDescription="Probá con otra búsqueda o quitá alguno de los filtros."
        onRetry={() => void query.refetch()}
        footer={result ? <AdminPagination page={result.page} pageSize={result.pageSize} total={result.total} onPageChange={setPage} disabled={query.isFetching} /> : undefined}
      >
        <div className="hidden md:block">
          <Table>
            <TableHeader><TableRow><TableHead>Fecha / actor</TableHead><TableHead>Acción</TableHead><TableHead>Objetivo</TableHead><TableHead>Motivo / cambio</TableHead><TableHead>Resultado</TableHead><TableHead>Request ID</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((item) => <AuditRow key={item.id} item={item} />)}</TableBody>
          </Table>
        </div>
        <div className="divide-y divide-border md:hidden">{items.map((item) => <AuditCard key={item.id} item={item} />)}</div>
      </AdminCollectionCard>
    </div>
  );
}

function AuditRow({ item }: { item: PlatformAdminAuditDto }) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap"><p>{formatAdminDate(item.createdAt, true)}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.actorAlias}</p></TableCell>
      <TableCell><p className="max-w-44 break-words font-medium text-foreground">{actionLabel(item.action)}</p></TableCell>
      <TableCell><p className="max-w-44 truncate">{item.targetType ?? '—'}</p><p className="mt-0.5 max-w-44 truncate text-xs text-muted-foreground">{item.targetId ?? 'Sin ID'}</p></TableCell>
      <TableCell><p className="max-w-72 text-sm text-foreground">{item.reason ?? 'Sin motivo informado'}</p>{stateSummary(item) && <p className="mt-1 max-w-72 truncate text-xs text-muted-foreground">{stateSummary(item)}</p>}</TableCell>
      <TableCell><StatusPill status={item.result === 'partial' ? 'warning' : statusTone(item.result)} label={RESULT_LABELS[item.result]} size="sm" /></TableCell>
      <TableCell><code className="block max-w-36 truncate text-xs text-muted-foreground" title={item.requestId}>{item.requestId}</code></TableCell>
    </TableRow>
  );
}

function AuditCard({ item }: { item: PlatformAdminAuditDto }) {
  return (
    <article className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-medium text-foreground">{actionLabel(item.action)}</h3><p className="mt-0.5 text-xs text-muted-foreground">{formatAdminDate(item.createdAt, true)} · {item.actorAlias}</p></div><StatusPill status={item.result === 'partial' ? 'warning' : statusTone(item.result)} label={RESULT_LABELS[item.result]} size="sm" /></div>
      <p className="text-sm text-foreground">{item.reason ?? 'Sin motivo informado'}</p>
      {stateSummary(item) && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{stateSummary(item)}</p>}
      <p className="truncate text-[11px] text-muted-foreground">Request: {item.requestId}</p>
    </article>
  );
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    'subscription_price_change.created': 'Cambio de precio',
    'subscription_price_change.processed': 'Proceso de lote',
    'subscription_price_change.retried': 'Reintento de lote',
  };
  return labels[action] ?? action;
}

function stateSummary(item: PlatformAdminAuditDto) {
  const previousAmount = item.previousState?.amountArs ?? item.previousState?.amount_ars;
  const nextAmount = item.nextState?.amountArs ?? item.nextState?.amount_ars;
  if (typeof previousAmount === 'number' && typeof nextAmount === 'number') {
    return `${previousAmount.toLocaleString('es-AR')} ARS → ${nextAmount.toLocaleString('es-AR')} ARS`;
  }
  return null;
}
