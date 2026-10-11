import { FileSearch } from 'lucide-react';
import { AdminCollectionCard } from '@/admin/components/AdminCollectionCard';
import { AdminPagination } from '@/admin/components/AdminPagination';
import { formatAdminDate } from '@/admin/adminFormatters';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusPill } from '@/components/ui/StatusPill';
import type { PlatformAdminAuditDto, PlatformAdminListResponse } from '@/types/platformAdmin';

const labels: Record<string, string> = { 'organization.details_updated': 'Datos y contacto', 'organization.manual_plan_assigned': 'Acceso manual', 'organization.trial_extended': 'Trial extendido', 'organization.trial_end_changed': 'Vencimiento de trial' };
const fields: Record<string, string> = { name: 'Nombre', phone: 'Teléfono', address: 'Dirección', contactEmail: 'Email comercial', planCode: 'Plan', currentPlanCode: 'Plan seleccionado', billingPlanCode: 'Plan de cobro', provider: 'Proveedor', status: 'Estado', accessEndsAt: 'Vencimiento', trialEndsAt: 'Fin de trial', billingAmountArs: 'Importe configurado', billingPriceVersion: 'Versión de precio' };
function changes(item: PlatformAdminAuditDto) {
  return Object.keys(item.nextState ?? {}).filter(key => fields[key] && item.nextState?.[key] !== item.previousState?.[key]).map(key => `${fields[key]}: ${item.previousState?.[key] ?? '—'} → ${item.nextState?.[key] ?? '—'}`).join(' · ');
}
export function OrganizationHistory({ data, isPending = false, isError = false, isFetching = false, onRetry, onPage }: {
  data?: PlatformAdminListResponse<PlatformAdminAuditDto>; isPending?: boolean; isError?: boolean; isFetching?: boolean; onRetry(): void; onPage(page: number): void;
}) {
  const items = data?.items ?? [];
  return <AdminCollectionCard toolbar={<p className="text-sm text-muted-foreground">Cambios y resultados de esta barbería. No incluye actividad operativa.</p>}
    isPending={isPending} isError={isError} isFetching={isFetching} hasData={!!data} isEmpty={!!data && !items.length} onRetry={onRetry}
    errorMessage="No pudimos cargar el historial de esta barbería." emptyIcon={FileSearch} emptyTitle="Todavía no hay cambios administrativos" emptyDescription="Cada modificación confirmada aparecerá aquí con su motivo y resultado."
    footer={data ? <AdminPagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={onPage} disabled={isFetching} /> : undefined}>
    <div className="hidden md:block"><Table><TableHeader><TableRow><TableHead>Fecha / actor</TableHead><TableHead>Acción</TableHead><TableHead>Motivo y cambio</TableHead><TableHead>Resultado</TableHead></TableRow></TableHeader><TableBody>{items.map(item => <TableRow key={item.id}>
      <TableCell className="whitespace-nowrap">{formatAdminDate(item.createdAt, true)}<p className="text-xs text-muted-foreground">{item.actorAlias}</p></TableCell>
      <TableCell>{labels[item.action] ?? item.action}</TableCell><TableCell className="min-w-56 max-w-lg"><p className="break-words text-sm">{item.reason ?? 'Sin motivo informado'}</p><p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{changes(item)}</p><p className="mt-2 break-all text-xs text-muted-foreground">ID: {item.requestId}</p></TableCell>
      <TableCell><Result item={item} /></TableCell>
    </TableRow>)}</TableBody></Table></div>
    <div className="divide-y md:hidden">{items.map(item => <article key={item.id} className="space-y-2 p-4"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-medium">{labels[item.action] ?? item.action}</h3><Result item={item} /></div><p className="text-xs text-muted-foreground">{formatAdminDate(item.createdAt, true)} · {item.actorAlias}</p><p className="break-words text-sm">{item.reason}</p><p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{changes(item)}</p><p className="break-all text-xs text-muted-foreground">ID: {item.requestId}</p></article>)}</div>
  </AdminCollectionCard>;
}
function Result({ item }: { item: PlatformAdminAuditDto }) { return <StatusPill size="sm" status={item.result === 'success' ? 'success' : item.result === 'partial' ? 'warning' : 'error'} label={item.result === 'success' ? 'Correcto' : item.result === 'partial' ? 'Parcial' : 'Fallido'} />; }
