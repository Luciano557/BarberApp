import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { OrganizationDetailView } from '@/admin/components/OrganizationDetailView';
import { OrganizationCommercialDrawer } from '@/admin/components/OrganizationCommercialDrawer';
import { OrganizationHistory } from '@/admin/components/OrganizationHistory';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { InlineReadError } from '@/components/ui/InlineReadError';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedVisible } from '@/hooks/useDelayedVisible';
import { usePlatformAdminAudit, usePlatformAdminOrganizationDetail, usePlatformAdminCommercialMutation, getPlatformAdminCommercialStatus } from '@/hooks/usePlatformAdmin';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { readCommercialRecovery, rememberCommercialOperation, clearCommercialRecovery } from '@/admin/commercialRecovery';
import { feedback } from '@/lib/feedback';
import type { PlatformAdminCommercialAction, PlatformAdminOrganizationDetail } from '@/types/platformAdmin';

export default function AdminOrganizationDetailPage() {
  const { organizationId = '' } = useParams();
  const { user } = useAdminAuth();
  // Remount state when either principal or target changes. Never carry drafts/CAS.
  return <OrganizationDetailController key={`${user?.id}:${organizationId}`} organizationId={organizationId} actorId={user?.id ?? ''} />;
}
function OrganizationDetailController({ organizationId, actorId }: { organizationId: string; actorId: string }) {
  const query = usePlatformAdminOrganizationDetail(organizationId);
  const [page, setPage] = useState(1);
  const audit = usePlatformAdminAudit({ page, pageSize: 10, filters: { organizationId }, sort: { field: 'createdAt', direction: 'desc' } }, { enabled: !!query.data });
  const mutation = usePlatformAdminCommercialMutation();
  const [selected, setSelected] = useState<{ action: PlatformAdminCommercialAction; detail: PlatformAdminOrganizationDetail } | null>(null);
  const [pending, setPending] = useState(() => readCommercialRecovery(actorId, organizationId));
  const [checking, setChecking] = useState(false);
  const showSkeleton = useDelayedVisible(query.isPending && !query.data);
  const clear = () => { clearCommercialRecovery(actorId, organizationId); setPending(null); };
  const refresh = () => { void query.refetch(); void audit.refetch(); };
  const recover = async () => {
    if (!pending) return; setChecking(true);
    try {
      const result = await getPlatformAdminCommercialStatus(organizationId, pending.requestId);
      if (result.status === 'completed') { clear(); refresh(); feedback.success('Operación confirmada en auditoría.'); }
      else feedback.info('Aún no hay confirmación. Conservá el identificador y no repitas el cambio.');
    } catch { feedback.error('No pudimos consultar el resultado. Reintentá esta consulta.'); }
    finally { setChecking(false); }
  };
  if (!query.data) return <div><PageHeader title="Ficha de barbería" subtitle="Datos comerciales y acceso a Vittro." icon={Building2} />{query.error?.status === 404
    ? <EmptyState icon={Building2} title="No encontramos la barbería" description="Revisá el enlace o volvé al directorio." />
    : query.isError ? <InlineReadError message="No pudimos cargar la ficha." onRetry={() => void query.refetch()} />
    : showSkeleton ? <div role="status" aria-label="Cargando ficha" className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-72 rounded-container" /><Skeleton className="h-48 rounded-container" /></div> : <div className="min-h-64" />}</div>;
  return <>
    {query.isError && <InlineReadError message="No se pudo actualizar. Se conservan los datos anteriores." onRetry={refresh} />}
    {pending && !selected && <div role="status" className="mb-6 space-y-3 rounded-container border border-status-warning bg-status-warning-bg p-4 text-sm text-status-warning-foreground"><p>Hay una operación sin resultado confirmado. Consultala antes de hacer otro cambio.</p><p className="break-all text-xs">Identificador: {pending.requestId}</p><Button variant="outline" size="sm" onClick={() => void recover()} disabled={checking}>{checking ? 'Consultando…' : 'Consultar resultado'}</Button></div>}
    <OrganizationDetailView detail={query.data} blocked={!!pending || query.isError || query.isFetching} onAction={action => setSelected({ action, detail: query.data })}
      history={<OrganizationHistory data={audit.data} isPending={audit.isPending} isError={audit.isError} isFetching={audit.isFetching} onRetry={() => void audit.refetch()} onPage={setPage} />} />
    {selected && <OrganizationCommercialDrawer action={selected.action} detail={selected.detail} onClose={() => { setSelected(null); if (!pending) refresh(); }}
      onStarted={requestId => { const operation = { requestId, action: selected.action }; rememberCommercialOperation(actorId, organizationId, operation); setPending(operation); }}
      onResolved={clear} onApply={mutation.apply} onCheck={requestId => getPlatformAdminCommercialStatus(organizationId, requestId)}
      onApplied={() => { setSelected(null); setPage(1); refresh(); }} />}
  </>;
}
