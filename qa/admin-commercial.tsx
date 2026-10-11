// Local fixture harness, not a production route or a Vite build entry.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AdminShell } from '@/admin/AdminShell';
import { OrganizationDetailView } from '@/admin/components/OrganizationDetailView';
import { OrganizationCommercialDrawer } from '@/admin/components/OrganizationCommercialDrawer';
import { OrganizationHistory } from '@/admin/components/OrganizationHistory';
import { adminCommercialFixture } from '@/test/fixtures/adminCommercial';
import type { PlatformAdminCommercialAction } from '@/types/platformAdmin';
import '@/index.css';

function Preview() {
  const [action, setAction] = useState<PlatformAdminCommercialAction | null>(null);
  const params = new URLSearchParams(location.search);
  const detail = structuredClone(adminCommercialFixture);
  if (params.get('state') === 'trial') {
    Object.assign(detail.subscription!, { provider: 'mercadopago', sourceStatus: 'trialing', currentPlanCode: null, effectivePlanCode: 'premium', trialEndsAt: '2026-10-25T14:12:00Z' });
    detail.capabilities.canExtendTrial = true;
    detail.capabilities.canChangeTrialEnd = true;
  }
  if (params.get('state') === 'mp') {
    Object.assign(detail.subscription!, { provider: 'mercadopago', providerStatus: 'authorized', hasPreapproval: true, billingAmountArs: 99999999 });
    Object.assign(detail.capabilities, { canAssignManualPlan: false, blockCode: 'PROVIDER_RECONCILIATION_REQUIRED' });
  }
  if (params.get('state') === 'readonly') detail.capabilities.mutationsEnabled = false;
  return <MemoryRouter initialEntries={['/admin/barberias/fixture']}><AdminShell onSignOut={() => {}}>
    <p className="mb-4 text-xs text-status-warning-foreground">QA local · Datos sintéticos · Sin conexión a APIs ni escrituras reales</p>
    <OrganizationDetailView detail={detail} onAction={setAction} history={<OrganizationHistory onRetry={() => {}} onPage={() => {}} data={{ page: 1, pageSize: 10, total: 1, items: [{ id: 'fixture-audit', actorUserId: null, actorAlias: 'admin', action: 'organization.manual_plan_assigned', targetType: 'organization', targetId: detail.organization.id, reason: 'Acceso de cortesía para una barbería de prueba.', previousState: { planCode: 'premium' }, nextState: { planCode: 'basico' }, result: 'success', requestId: '33333333-3333-4333-8333-333333333333', createdAt: '2026-10-01T12:00:00Z' }] }} />} />
    {action && <OrganizationCommercialDrawer action={action} detail={detail} onClose={() => setAction(null)} onStarted={() => {}} onResolved={() => {}} onApplied={() => setAction(null)}
      onApply={async (input, requestId) => ({ organizationId: input.organizationId, requestId, action: input.action, replayed: false })}
      onCheck={async requestId => ({ organizationId: detail.organization.id, requestId, status: 'not_found', action: null, completedAt: null })} />}
  </AdminShell><Toaster /></MemoryRouter>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Preview /></React.StrictMode>);
