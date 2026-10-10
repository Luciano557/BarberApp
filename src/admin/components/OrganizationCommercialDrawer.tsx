import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, isValid, parse } from 'date-fns';
import { Building2, CalendarDays, ShieldCheck, Loader2 } from 'lucide-react';
import { DrawerForm, DrawerFormSection } from '@/components/ui/drawer-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { feedback } from '@/lib/feedback';
import { formatAdminDate, planLabel } from '@/admin/adminFormatters';
import type { PlatformAdminCommercialAction, PlatformAdminCommercialInput, PlatformAdminCommercialResult, PlatformAdminCommercialStatus, PlatformAdminOrganizationDetail } from '@/types/platformAdmin';

// Existing Operate surface: Inter/navy, three factual sections, no redesign.
// Protected focus: review the exact barbería and consequences before writing.
// Limits match the server contract (email 254, address 300, audit reason 500).
function localDeadline(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const value = `${date} ${time}`;
  const parsed = parse(value, 'yyyy-MM-dd HH:mm', new Date());
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd HH:mm') === value ? parsed : null;
}
export function commercialFormSchema(action: PlatformAdminCommercialAction) {
  return z.object({
    name: z.string().trim().max(120, 'Máximo 120 caracteres.'), phone: z.string().trim().max(40),
    address: z.string().trim().max(300), contactEmail: z.string().trim().max(254).refine(value => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Ingresá un email válido.'),
    planCode: z.enum(['basico', 'profesional', 'premium']), date: z.string(), time: z.string(), indefinite: z.boolean(),
    reason: z.string().trim().min(10, 'Explicá el motivo en al menos 10 caracteres.').max(500),
    password: z.string().min(1, 'Ingresá la contraseña administrativa.').max(1024),
    confirmed: z.boolean().refine(Boolean, 'Confirmá que revisaste las consecuencias.'),
  }).superRefine((value, ctx) => {
    if (action === 'update_details' && !value.name) ctx.addIssue({ code: 'custom', path: ['name'], message: 'Ingresá el nombre.' });
    if (action !== 'update_details' && !(action === 'assign_manual_plan' && value.indefinite)) {
      const deadline = localDeadline(value.date, value.time);
      if (!value.date) ctx.addIssue({ code: 'custom', path: ['date'], message: 'Elegí la fecha de vencimiento.' });
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)) ctx.addIssue({ code: 'custom', path: ['time'], message: 'Ingresá una hora válida (HH:MM).' });
      if (!deadline || deadline.getTime() <= Date.now()) ctx.addIssue({ code: 'custom', path: ['date'], message: 'Elegí un vencimiento futuro.' });
    }
  });
}
type Values = z.infer<ReturnType<typeof commercialFormSchema>>;
const titles: Record<PlatformAdminCommercialAction, string> = { update_details: 'Editar barbería y contacto', assign_manual_plan: 'Asignar acceso manual', extend_trial: 'Extender trial' };
interface Props {
  action: PlatformAdminCommercialAction; detail: PlatformAdminOrganizationDetail;
  onClose(): void;
  onApply(input: PlatformAdminCommercialInput, requestId: string): Promise<PlatformAdminCommercialResult>;
  onCheck(requestId: string): Promise<PlatformAdminCommercialStatus>;
  onStarted(requestId: string): void;
  onResolved(): void;
  onApplied(): void;
}
export function OrganizationCommercialDrawer({ action, detail, onClose, onApply, onCheck, onStarted, onResolved, onApplied }: Props) {
  const requestId = useRef(crypto.randomUUID());
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [conflict, setConflict] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(commercialFormSchema(action)), defaultValues: {
    name: detail.organization.name, phone: detail.organization.phone ?? '', address: detail.organization.address ?? '',
    contactEmail: detail.organization.contactEmail ?? '', planCode: (['basico', 'profesional', 'premium'].includes(detail.subscription?.effectivePlanCode ?? '') ? detail.subscription!.effectivePlanCode : 'basico') as Values['planCode'],
    date: '', time: '', indefinite: false, reason: '', password: '', confirmed: false,
  } });
  const indefinite = form.watch('indefinite');
  const plan = form.watch('planCode');
  const deadline = localDeadline(form.watch('date'), form.watch('time'));
  const close = () => { if (!busy) { form.setValue('password', ''); onClose(); } };
  const submit = form.handleSubmit(async values => {
    if (submitting.current || busy || uncertain || conflict || !detail.capabilities.mutationsEnabled) return;
    submitting.current = true;
    const changes = action === 'update_details'
      ? { name: values.name, phone: values.phone || null, address: values.address || null, contactEmail: values.contactEmail || null }
      : action === 'assign_manual_plan'
        ? { planCode: values.planCode, endsAt: values.indefinite ? null : localDeadline(values.date, values.time)!.toISOString() }
        : { endsAt: localDeadline(values.date, values.time)!.toISOString() };
    setBusy(true);
    let started = false;
    try {
      onStarted(requestId.current);
      started = true;
      await onApply({ action, organizationId: detail.organization.id, expectedOrganizationUpdatedAt: detail.organization.updatedAt,
        expectedSubscriptionUpdatedAt: detail.subscription?.updatedAt ?? null, changes, reason: values.reason, password: values.password }, requestId.current);
      onResolved(); feedback.success('Cambio administrativo guardado.'); onApplied();
    } catch (error) {
      const issue = error as { status?: number | null; code?: string | null };
      const ambiguous = started && (!issue.status || issue.status >= 500 && issue.code !== 'COMMERCIAL_MUTATIONS_DISABLED');
      if (ambiguous) setUncertain(true); else onResolved();
      if (issue.status === 409) setConflict(true);
      const messages: Record<string, string> = {
        REAUTHENTICATION_FAILED: 'La contraseña no coincide. Ingresala nuevamente.',
        COMMERCIAL_MUTATIONS_DISABLED: 'La gestión comercial está deshabilitada en el servidor.',
        COMMERCIAL_CONFLICT: 'La barbería cambió en otra sesión. Cerrá y actualizá la ficha.',
        COMMERCIAL_REQUEST_CONFLICT: 'El identificador corresponde a otra operación. Consultá el historial.',
        PROVIDER_RECONCILIATION_REQUIRED: 'Primero hay que reconciliar el vínculo con Mercado Pago.',
        OPERATION_IN_PROGRESS: 'Hay una operación de facturación pendiente. Resolvela primero.',
        TRIAL_EXTENSION_NOT_ALLOWED: 'Este acceso ya no admite extensión de trial. Actualizá la ficha.',
      };
      feedback.error(!started ? 'No pudimos guardar el identificador de recuperación en este navegador. No se envió ningún cambio.' : messages[issue.code ?? ''] ?? 'No pudimos confirmar el cambio. Consultá el resultado antes de repetirlo.');
    } finally { form.setValue('password', ''); setBusy(false); submitting.current = false; }
  });
  const check = async () => {
    setBusy(true);
    try {
      const result = await onCheck(requestId.current);
      if (result.status === 'completed') { onResolved(); feedback.success('El cambio quedó confirmado en auditoría.'); onApplied(); }
      else feedback.info('Todavía no hay confirmación. No repitas el cambio; conservá el identificador.');
    } catch { feedback.error('No pudimos consultar el resultado. Reintentá la consulta, no el cambio.'); }
    finally { setBusy(false); }
  };
  return (
    <DrawerForm open onOpenChange={open => { if (!open) close(); }} size="md" title={titles[action]} description={`Operación comercial para ${detail.organization.name}. No modifica credenciales ni débitos de Mercado Pago.`}
      isDirty={form.formState.isDirty && !busy && !uncertain} footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={close}>Cancelar</Button>
          <Button type="submit" form="organization-commercial-form" disabled={busy || uncertain || conflict || !detail.capabilities.mutationsEnabled}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Confirmando…' : 'Guardar cambio'}
          </Button>
        </div>
      }>
      <Form {...form}>
        <form id="organization-commercial-form" onSubmit={submit} noValidate className="space-y-6">
          <fieldset disabled={busy || uncertain || conflict} className="space-y-6">
            <DrawerFormSection icon={action === 'update_details' ? Building2 : CalendarDays} title={detail.organization.name}
              description={`Plan actual: ${planLabel(detail.subscription?.effectivePlanCode)} · ${detail.subscription?.provider === 'manual' ? 'acceso manual' : 'sin cambios automáticos en Mercado Pago'}`}>
              {action === 'update_details' ? <>
                {([['name', 'Nombre', 120], ['phone', 'Teléfono (opcional)', 40], ['address', 'Dirección (opcional)', 300], ['contactEmail', 'Email comercial (opcional)', 254]] as const).map(([name, label, maxLength]) => (
                  <FormField key={name} control={form.control} name={name} render={({ field }) => <FormItem><FormLabel>{label}</FormLabel><FormControl><Input {...field} maxLength={maxLength} type={name === 'contactEmail' ? 'email' : 'text'} /></FormControl>{name === 'contactEmail' && <FormDescription>No cambia el email de inicio de sesión de ningún usuario.</FormDescription>}<FormMessage /></FormItem>} />
                ))}
              </> : <>
                {action === 'assign_manual_plan' && <>
                  <FormField control={form.control} name="planCode" render={({ field }) => <FormItem><FormLabel>Plan de acceso</FormLabel><Select value={field.value} onValueChange={field.onChange} disabled={busy || uncertain || conflict}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{detail.plans.filter(p => p.isActive).map(p => <SelectItem key={p.code} value={p.code}>{planLabel(p.code)}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                  <FormField control={form.control} name="indefinite" render={({ field }) => <FormItem className="flex items-start gap-3 space-y-0 py-2"><FormControl><Checkbox checked={field.value} onCheckedChange={value => field.onChange(value === true)} className="mt-0.5" /></FormControl><div><FormLabel>Otorgar acceso sin vencimiento</FormLabel><FormDescription>Es una cortesía indefinida, no una suscripción paga.</FormDescription></div></FormItem>} />
                </>}
                {!(action === 'assign_manual_plan' && indefinite) && <div className="space-y-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="date" render={({ field }) => <FormItem><FormLabel>Fecha de vencimiento</FormLabel><FormControl><DatePicker ref={field.ref} value={field.value || null} onChange={value => field.onChange(value ?? '')} fromDate={format(new Date(), 'yyyy-MM-dd')} disabled={busy || uncertain || conflict} /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="time" render={({ field }) => <FormItem><FormLabel>Hora de vencimiento</FormLabel><FormControl><TimePicker ref={field.ref} value={field.value} onChange={field.onChange} disabled={busy || uncertain || conflict} /></FormControl><FormMessage /></FormItem>} />
                  </div>
                  <p className="text-xs text-muted-foreground">Hora local de este navegador ({Intl.DateTimeFormat().resolvedOptions().timeZone}).{action === 'extend_trial' && ` Trial actual: ${formatAdminDate(detail.subscription?.trialEndsAt, true)}.`}</p>
                </div>}
                <p className="rounded-lg bg-muted p-3 text-sm leading-relaxed text-foreground">{action === 'assign_manual_plan'
                  ? `${planLabel(detail.subscription?.effectivePlanCode)} → ${planLabel(plan)} · ${indefinite ? 'sin vencimiento' : deadline ? formatAdminDate(deadline.toISOString(), true) : 'elegí el vencimiento'}. No genera cobros, no cancela contratos y no cambia el catálogo.`
                  : 'Extiende el acceso Premium de prueba. No crea pagos ni reemplaza acceso pago o manual.'}</p>
              </>}
            </DrawerFormSection>
            <DrawerFormSection icon={ShieldCheck} title="Confirmación administrativa" description="El cambio y su motivo quedan auditados. La contraseña no se registra.">
              <FormField control={form.control} name="reason" render={({ field }) => <FormItem><FormLabel>Motivo</FormLabel><FormControl><Textarea {...field} maxLength={500} placeholder="Explicá la decisión comercial…" /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="password" render={({ field }) => <FormItem><FormLabel>Contraseña administrativa</FormLabel><FormControl><Input {...field} type="password" autoComplete="current-password" maxLength={1024} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="confirmed" render={({ field }) => <FormItem className="space-y-2"><div className="flex items-start gap-3"><FormControl><Checkbox checked={field.value} onCheckedChange={value => field.onChange(value === true)} className="mt-0.5" /></FormControl><FormLabel className="leading-relaxed">Revisé la barbería, el cambio y sus consecuencias.</FormLabel></div><FormMessage /></FormItem>} />
            </DrawerFormSection>
          </fieldset>
          {conflict && <p role="alert" className="text-sm text-status-warning-foreground">La ficha ya no está vigente para esta operación. Cerrá este panel y actualizá los datos.</p>}
          {uncertain && <div role="alert" className="space-y-3 rounded-lg border border-status-warning bg-status-warning-bg p-3 text-sm text-status-warning-foreground"><p>No tenemos confirmación. Consultá el resultado antes de repetir el cambio.</p><p className="break-all text-xs">Identificador: {requestId.current}</p><Button type="button" variant="outline" onClick={() => void check()} disabled={busy}>Consultar resultado</Button></div>}
        </form>
      </Form>
    </DrawerForm>
  );
}
