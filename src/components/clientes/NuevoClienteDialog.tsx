import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DrawerForm } from '@/components/ui/drawer-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useSucursal } from '@/contexts/SucursalContext';
import { useClientes, type ClienteMatch } from '@/hooks/useClientes';
import { toast } from 'sonner';
import { Loader2, ChevronDown, CalendarIcon, X, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ClienteFormFields } from '@/components/agenda/ClienteFormFields';
import { EmptySelectHint } from '@/components/agenda/EmptySelectHint';
import { clienteModeFieldsSchema } from '@/components/agenda/clienteModeSchema';
import { isValidEmail } from '@/components/clientes/import/lib/normalize';

/**
 * Reusa la forma/maxLength de nombre-apellido-telefono-email de clienteModeSchema
 * (Fase 3, Agenda), pero con su propia validación cruzada: acá no hay modo
 * existing/new, y la regla de negocio del alta standalone es distinta a la de
 * NewAppointmentDialog (apellido opcional, telefono O email en vez de ambos
 * obligatorios) — por eso no se reusa `validateClienteMode` tal cual.
 */
function buildNuevoClienteSchema(needsSucursalPicker: boolean) {
  return clienteModeFieldsSchema
    .omit({ clienteId: true })
    .extend({
      sucursalId: z.string().optional().default(''),
      fechaNacimiento: z.string().optional().default(''),
      instagram: z.string().max(120).optional().default(''),
      tiktok: z.string().max(120).optional().default(''),
      otraRedSocial: z.string().max(120).optional().default(''),
      alergias: z.string().max(240).optional().default(''),
      aceptaMarketing: z.boolean().default(true),
    })
    .superRefine((data, ctx) => {
      if (!data.nombre.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nombre'], message: 'Ingresá el nombre' });
      }
      if (data.telefono && !data.telefono.isValid && data.telefono.reason !== 'empty') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['telefono'], message: 'Revisá el teléfono antes de guardar' });
      }
      const hasTelefono = !!data.telefono?.e164;
      const hasEmail = !!data.email.trim();
      if (!hasTelefono && !hasEmail) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Ingresá teléfono o email' });
      }
      if (data.email.trim() && !isValidEmail(data.email.trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Email inválido' });
      }
      if (needsSucursalPicker && !data.sucursalId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sucursalId'], message: 'Seleccioná una sucursal' });
      }
    });
}

type NuevoClienteFormValues = z.infer<ReturnType<typeof buildNuevoClienteSchema>>;

interface NuevoClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function NuevoClienteDialog({ open, onOpenChange, onCreated }: NuevoClienteDialogProps) {
  const { sucursales, currentSucursal, isAllMode } = useSucursal();
  const { createCliente, findClienteByPhone, linkClienteToSucursal } = useClientes();

  const [showMore, setShowMore] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Aviso de duplicado potencial — flujo secundario disparado tras el submit,
  // fuera del ciclo de vida de RHF (por eso tiene su propio `saving`).
  const [duplicateMatch, setDuplicateMatch] = useState<ClienteMatch | null>(null);
  const [pendingSucursalId, setPendingSucursalId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const needsSucursalPicker = isAllMode || !currentSucursal;
  const noBranchAvailable = needsSucursalPicker && sucursales.length === 0;

  const defaultValues = (): NuevoClienteFormValues => ({
    nombre: '',
    apellido: '',
    telefono: null,
    email: '',
    sucursalId: currentSucursal?.id ?? '',
    fechaNacimiento: '',
    instagram: '',
    tiktok: '',
    otraRedSocial: '',
    alergias: '',
    aceptaMarketing: true,
  });

  const form = useForm<NuevoClienteFormValues>({
    resolver: zodResolver(buildNuevoClienteSchema(needsSucursalPicker)),
    defaultValues: defaultValues(),
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues());
      setShowMore(false);
      setDuplicateMatch(null);
      setPendingSucursalId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentSucursal?.id]);

  const doCreate = async (targetSucursalId: string, posibleDuplicadoDe: string | null) => {
    const values = form.getValues();
    const { id, error } = await createCliente({
      nombre: values.nombre.trim(),
      apellido: values.apellido.trim(),
      sucursalId: targetSucursalId,
      telefono: values.telefono?.e164 ?? null,
      email: values.email.trim() || null,
      fecha_nacimiento: values.fechaNacimiento || null,
      instagram: values.instagram.trim() || null,
      tiktok: values.tiktok.trim() || null,
      otra_red_social: values.otraRedSocial.trim() || null,
      alergias: values.alergias.trim() || null,
      acepta_marketing: values.aceptaMarketing,
      posible_duplicado_de: posibleDuplicadoDe,
    });

    if (error || !id) {
      toast.error(error || 'No se pudo crear el cliente');
      return;
    }
    toast.success('Cliente creado');
    onCreated?.(id);
    onOpenChange(false);
  };

  const onSubmit = async (values: NuevoClienteFormValues) => {
    const targetSucursalId = needsSucursalPicker ? values.sucursalId : currentSucursal!.id;
    const t = values.telefono?.e164 ?? '';

    if (t) {
      const { matches, error: matchErr } = await findClienteByPhone(t);
      if (matchErr) {
        // Falla blanda: si no podemos verificar, seguimos flujo normal.
        console.warn('[NuevoClienteDialog] duplicate check failed:', matchErr);
      } else {
        const first = matches.find((m) => !m.eliminado) ?? null;
        if (first) {
          setPendingSucursalId(targetSucursalId);
          setDuplicateMatch(first);
          return;
        }
      }
    }

    await doCreate(targetSucursalId, null);
  };

  const handleLinkExisting = async () => {
    if (!duplicateMatch || !pendingSucursalId) return;
    setSaving(true);
    const { error } = await linkClienteToSucursal(duplicateMatch.cliente_id, pendingSucursalId);
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Cliente vinculado a la sucursal');
    onCreated?.(duplicateMatch.cliente_id);
    setDuplicateMatch(null);
    onOpenChange(false);
  };

  const handleCreateAnyway = async () => {
    if (!duplicateMatch || !pendingSucursalId) return;
    const dupId = duplicateMatch.cliente_id;
    const suc = pendingSucursalId;
    setSaving(true);
    setDuplicateMatch(null);
    await doCreate(suc, dupId);
    setSaving(false);
  };

  const alreadyLinkedHere = !!duplicateMatch && !!pendingSucursalId &&
    duplicateMatch.sucursales.some((s) => s.sucursal_id === pendingSucursalId);

  return (
    <DrawerForm
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo cliente"
      size="md"
      isDirty={form.formState.isDirty}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting || saving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="nuevo-cliente-form"
            disabled={form.formState.isSubmitting || saving || noBranchAvailable}
          >
            {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {form.formState.isSubmitting ? 'Guardando...' : 'Crear cliente'}
          </Button>
        </div>
      }
    >
      <Form {...form}>
        <form id="nuevo-cliente-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cargá los datos básicos. Podés completar más información desde el perfil del cliente.
          </p>

          <ClienteFormFields
            control={form.control}
            nombreName="nombre"
            apellidoName="apellido"
            telefonoName="telefono"
            emailName="email"
          />

          <FormField
            control={form.control}
            name="fechaNacimiento"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-xs">Fecha de nacimiento (opcional)</FormLabel>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                      >
                        <CalendarIcon className="h-4 w-4" />
                        {field.value ? format(parseISO(field.value), "d 'de' MMMM yyyy", { locale: es }) : 'Seleccionar fecha'}
                        {field.value && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(ev) => { ev.stopPropagation(); field.onChange(''); }}
                            onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); field.onChange(''); } }}
                            className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded hover:bg-accent"
                            aria-label="Limpiar fecha"
                          >
                            <X className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? parseISO(field.value) : undefined}
                      onSelect={(d) => {
                        field.onChange(d ? format(d, 'yyyy-MM-dd') : '');
                        setDatePickerOpen(false);
                      }}
                      disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                      captionLayout="dropdown-buttons"
                      fromYear={1900}
                      toYear={new Date().getFullYear()}
                    />
                    <div className="border-t p-2 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => { field.onChange(''); setDatePickerOpen(false); }}
                      >
                        Limpiar
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {needsSucursalPicker && (
            noBranchAvailable ? (
              <EmptySelectHint
                message="No hay sucursales creadas todavía."
                ctaLabel="Cómo resolverlo"
                onCta={() => toast.message('Cerrá esta ventana y creá una sucursal desde Mi Negocio antes de cargar un cliente.')}
              />
            ) : (
              <FormField
                control={form.control}
                name="sucursalId"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Sucursal</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Seleccioná una sucursal" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sucursales.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )
          )}

          {/* Más datos */}
          <Collapsible open={showMore} onOpenChange={setShowMore}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between px-2 -mx-2 text-sm font-medium">
                Más datos
                <ChevronDown className={cn("h-4 w-4 transition-transform", showMore && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="instagram"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs">Instagram (opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={120} placeholder="@usuario" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tiktok"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs">TikTok (opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={120} placeholder="@usuario" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="otraRedSocial"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Otra red social (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={120} placeholder="Ej: Twitter @usuario" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="alergias"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Alergias (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        maxLength={240}
                        rows={2}
                        placeholder="Ej: alergia a tintes, productos con amoníaco..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aceptaMarketing"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border px-3 py-2.5 space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm">Acepta marketing</FormLabel>
                      <p className="text-xs text-muted-foreground">Promociones y novedades por mensajes.</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CollapsibleContent>
          </Collapsible>
        </form>
      </Form>

      <AlertDialog
        open={!!duplicateMatch}
        onOpenChange={(o) => { if (!o) setDuplicateMatch(null); }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-status-warning-foreground" />
              Ya existe un cliente con ese teléfono
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p className="text-foreground">
                  <span className="font-medium">
                    {duplicateMatch?.nombre}{duplicateMatch?.apellido ? ` ${duplicateMatch.apellido}` : ''}
                  </span>{' '}
                  ya está registrado en tu organización con este teléfono.
                </p>
                {duplicateMatch && duplicateMatch.sucursales.length > 0 && (
                  <div className="rounded-md border bg-muted/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground mb-1">Vinculado en:</p>
                    <ul className="text-sm space-y-0.5">
                      {duplicateMatch.sucursales.map((s) => (
                        <li key={s.sucursal_id}>• {s.nombre}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {alreadyLinkedHere && (
                  <p className="text-xs text-muted-foreground">
                    Este cliente ya está vinculado a la sucursal seleccionada.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Recomendamos vincular el cliente existente en lugar de crear uno nuevo.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button
              variant="ghost"
              onClick={() => setDuplicateMatch(null)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={handleCreateAnyway}
              disabled={saving}
            >
              Crear cliente nuevo igual
            </Button>
            <Button
              variant="default"
              onClick={handleLinkExisting}
              disabled={saving || alreadyLinkedHere}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Vincular a esta sucursal
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DrawerForm>
  );
}
