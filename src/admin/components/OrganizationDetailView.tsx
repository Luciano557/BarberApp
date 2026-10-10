import { Building2, Pencil, CalendarDays, ScrollText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatAdminDate, formatAdminMoney, planLabel, subscriptionStatusLabel } from '@/admin/adminFormatters';
import type { PlatformAdminCommercialAction, PlatformAdminOrganizationDetail } from '@/types/platformAdmin';
import type { ReactNode } from 'react';

// THESIS: distinguish the source of access from evidence of payment.
// OWN-WORLD: incumbent Inter/navy Operate tokens and canonical components.
// STORY: find the barbería, review exact consequences, then edit in a DrawerForm.
// FIRST VIEWPORT: name/back link; contact and access; audit below, no tenant data.
// FORM: approved narrow extension of /admin, not a new visual world.
export function organizationAccessPresentation(detail: PlatformAdminOrganizationDetail, now = Date.now()) {
  const sub = detail.subscription;
  const source = !sub ? 'Sin suscripción' : sub.sourceStatus === 'trialing' || (!sub.currentPlanCode && sub.sourceStatus === 'expired') ? 'Trial' : sub.provider === 'manual' ? 'Acceso manual' : 'Mercado Pago';
  const deadline = source === 'Trial' ? sub?.trialEndsAt : sub?.currentPeriodEnd;
  const permitted = detail.organization.isEnabled && !!sub && (
    sub.sourceStatus === 'trialing' ? !!deadline && Date.parse(deadline) > now :
    ['active', 'cancelled'].includes(sub.sourceStatus) && (!deadline || Date.parse(deadline) > now)
  );
  return { source, deadline, permitted, label: !detail.organization.isEnabled ? 'Organización deshabilitada' : permitted ? 'Con acceso vigente' : 'Sin acceso vigente' };
}
export function OrganizationDetailView({ detail, onAction, history, blocked = false }: {
  detail: PlatformAdminOrganizationDetail; onAction(action: PlatformAdminCommercialAction): void; history: ReactNode; blocked?: boolean;
}) {
  const { organization: org, subscription: sub, capabilities } = detail;
  const access = organizationAccessPresentation(detail);
  const disabled = blocked || !capabilities.mutationsEnabled;
  return (
    <div className="space-y-6">
      <PageHeader title={org.name} subtitle="Ficha comercial de la barbería. Sin datos de clientes, ventas ni caja." icon={Building2} />
      <Button asChild variant="ghost" size="sm"><Link to="/admin/barberias">Volver a barberías</Link></Button>
      {!capabilities.mutationsEnabled && <p className="text-sm text-muted-foreground">Modo lectura: la gestión comercial todavía no está habilitada en el servidor.</p>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card className="overflow-clip">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5"><h2 className="text-lg font-medium">Datos y contacto</h2><Button size="sm" variant="outline" disabled={disabled} onClick={() => onAction('update_details')}><Pencil className="h-4 w-4" />Editar datos</Button></div>
          <dl className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Info label="Nombre" value={org.name} /><Info label="Slug · no editable" value={org.slug} />
            <Info label="Teléfono" value={org.phone} /><Info label="Email comercial" value={org.contactEmail} />
            <Info label="Dirección" value={org.address} /><Info label="Alta" value={formatAdminDate(org.createdAt)} />
            <Info label="Sucursales" value={String(org.branchesCount)} /><Info label="Usuarios" value={String(org.usersCount)} />
          </dl>
        </Card>
        <Card className="overflow-clip">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5"><h2 className="text-lg font-medium">Acceso y suscripción</h2><StatusPill status={access.permitted ? 'success' : 'neutral'} label={access.label} size="sm" /></div>
          <div className="space-y-5 p-4 sm:p-5">
            <dl className="grid gap-4 sm:grid-cols-2"><Info label="Fuente del acceso" value={access.source} /><Info label="Plan efectivo" value={planLabel(sub?.effectivePlanCode)} /><Info label="Vencimiento" value={!sub ? 'Sin suscripción' : access.deadline ? formatAdminDate(access.deadline, true) : access.source === 'Trial' ? 'Sin fecha de trial' : 'Sin vencimiento'} />
              <Info label="Facturación" value={sub?.provider === 'manual' ? 'Sin débito por este acceso' : sub?.providerStatus ? `Mercado Pago · ${subscriptionStatusLabel(sub.providerStatus)}` : 'Sin contrato autorizado confirmado'} />
              {sub?.provider !== 'manual' && sub?.billingAmountArs != null && <Info label="Importe configurado · no prueba un pago" value={formatAdminMoney(sub.billingAmountArs)} money />}
            </dl>
            {capabilities.blockCode && <p className="rounded-lg bg-status-warning-bg p-3 text-sm text-status-warning-foreground">{capabilities.blockCode === 'OPERATION_IN_PROGRESS' ? 'Hay una operación de facturación pendiente. Resolvela antes de modificar el acceso.' : 'Hay un vínculo o checkout de Mercado Pago. Reconciliá su estado real antes de otorgar acceso manual o extender el trial.'}</p>}
            <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={disabled || !capabilities.canAssignManualPlan || !detail.plans.some(p => p.isActive)} onClick={() => onAction('assign_manual_plan')}>Asignar acceso manual</Button><Button variant="outline" size="sm" disabled={disabled || !capabilities.canExtendTrial} onClick={() => onAction('extend_trial')}><CalendarDays className="h-4 w-4" />Extender trial</Button></div>
            <p className="text-sm leading-relaxed text-muted-foreground">Las acciones de acceso no generan pagos ni modifican contratos externos. La suspensión administrativa no está disponible en esta etapa.</p>
          </div>
        </Card>
      </div>
      <section aria-labelledby="org-history"><div className="mb-3 flex items-center gap-2"><ScrollText className="h-4 w-4 text-muted-foreground" /><h2 id="org-history" className="text-base font-medium">Historial administrativo</h2></div>{history}</section>
    </div>
  );
}
function Info({ label, value, money = false }: { label: string; value: string | null | undefined; money?: boolean }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className={money ? 'mt-1 whitespace-nowrap text-sm font-medium tabular-nums text-foreground' : 'mt-1 break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]'}>{value || 'Sin informar'}</dd></div>;
}
