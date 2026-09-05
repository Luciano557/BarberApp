import { useCallback, useEffect, useState } from 'react';
import { useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedVisible } from '@/hooks/useDelayedVisible';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { EditableSectionHeader } from '@/components/ui/EditableSectionHeader';
import { CalendarX, Timer, type LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AgendaConfigSectionProps {
  sucursalId: string;
  organizationId: string;
  /** Avisa a AgendaManagement.tsx si hay cambios sin guardar, mismo protocolo
      que PortalPublicoSection, para bloquear la navegación con un aviso. */
  onDirtyChange?: (dirty: boolean) => void;
}

interface ConfigData {
  duracion_base_min: number;
  buffer_despues_min: number;
  cancelacion_limite_min: number;
  modificacion_limite_min: number;
  dias_anticipacion: number;
  anticipacion_minima_reserva_min: number;
}

const DEFAULTS: ConfigData = {
  duracion_base_min: 15,
  buffer_despues_min: 5,
  cancelacion_limite_min: 120,
  modificacion_limite_min: 120,
  dias_anticipacion: 30,
  anticipacion_minima_reserva_min: 30,
};

const CUSTOM_KEY = '__custom__';

type FieldDef = {
  key: string;
  label: string;
  description: string;
  options: Array<{ label: string; value: number }>;
  customSuffix: string;
  min: number;
  max: number;
};

const REGLAS_FIELDS: FieldDef[] = [
  {
    key: 'duracion_base_min',
    label: 'Duración mínima de servicio',
    description: 'Tiempo mínimo que cualquier servicio bloquea en la agenda.',
    options: [
      { label: '15 min', value: 15 },
      { label: '20 min', value: 20 },
      { label: '30 min', value: 30 },
      { label: '45 min', value: 45 },
      { label: '60 min', value: 60 },
    ],
    customSuffix: 'min',
    min: 1,
    max: 120,
  },
  {
    key: 'buffer_despues_min',
    label: 'Tiempo de espera',
    description: 'Tiempo libre después de cada turno.',
    options: [
      { label: 'Sin espera', value: 0 },
      { label: '5 min', value: 5 },
      { label: '10 min', value: 10 },
      { label: '15 min', value: 15 },
      { label: '20 min', value: 20 },
      { label: '30 min', value: 30 },
    ],
    customSuffix: 'min',
    min: 0,
    max: 120,
  },
  {
    key: 'anticipacion_minima_reserva_min',
    label: 'Anticipación mínima',
    description: 'Tiempo mínimo entre ahora y el primer turno disponible.',
    options: [
      { label: 'Sin anticipación', value: 0 },
      { label: '15 min', value: 15 },
      { label: '30 min', value: 30 },
      { label: '1 h', value: 60 },
      { label: '2 h', value: 120 },
      { label: '4 h', value: 240 },
      { label: '24 h', value: 1440 },
    ],
    customSuffix: 'min',
    min: 0,
    max: 1440,
  },
  {
    key: 'dias_anticipacion',
    label: 'Días de anticipación',
    description: 'Cuántos días hacia adelante se puede reservar.',
    options: [
      { label: '7 días', value: 7 },
      { label: '14 días', value: 14 },
      { label: '30 días', value: 30 },
      { label: '60 días', value: 60 },
      { label: '90 días', value: 90 },
    ],
    customSuffix: 'días',
    min: 1,
    max: 120,
  },
];

const LIMITES_FIELDS: FieldDef[] = [
  {
    key: 'cancelacion_limite_min',
    label: 'Límite cancelación',
    description: 'Anticipación mínima para cancelar.',
    options: [
      { label: '15 min', value: 15 },
      { label: '30 min', value: 30 },
      { label: '1 h', value: 60 },
      { label: '2 h', value: 120 },
      { label: '4 h', value: 240 },
      { label: '24 h', value: 1440 },
    ],
    customSuffix: 'min',
    min: 0,
    max: 10080,
  },
  {
    key: 'modificacion_limite_min',
    label: 'Límite reprogramación',
    description: 'Anticipación mínima para reprogramar.',
    options: [
      { label: '15 min', value: 15 },
      { label: '30 min', value: 30 },
      { label: '1 h', value: 60 },
      { label: '2 h', value: 120 },
      { label: '4 h', value: 240 },
      { label: '24 h', value: 1440 },
    ],
    customSuffix: 'min',
    min: 0,
    max: 10080,
  },
];

const digitos = (min: number, max: number) =>
  z.string()
    .regex(/^\d+$/, 'Ingresá solo números enteros.')
    .refine((v) => Number(v) >= min, `El valor mínimo es ${min}.`)
    .refine((v) => Number(v) <= max, `El valor máximo permitido es ${max}.`);

const reglasSchema = z.object({
  duracion_base_min: digitos(1, 120),
  buffer_despues_min: digitos(0, 120),
  anticipacion_minima_reserva_min: digitos(0, 1440),
  dias_anticipacion: digitos(1, 120),
});
type ReglasFormValues = z.infer<typeof reglasSchema>;

const limitesSchema = z.object({
  cancelacion_limite_min: digitos(0, 10080),
  modificacion_limite_min: digitos(0, 10080),
});
type LimitesFormValues = z.infer<typeof limitesSchema>;

const toReglasFormValues = (c: ConfigData): ReglasFormValues => ({
  duracion_base_min: String(c.duracion_base_min),
  buffer_despues_min: String(c.buffer_despues_min),
  anticipacion_minima_reserva_min: String(c.anticipacion_minima_reserva_min),
  dias_anticipacion: String(c.dias_anticipacion),
});

const toLimitesFormValues = (c: ConfigData): LimitesFormValues => ({
  cancelacion_limite_min: String(c.cancelacion_limite_min),
  modificacion_limite_min: String(c.modificacion_limite_min),
});

const formatFieldValue = (field: FieldDef, value: number) => {
  const preset = field.options.find((o) => o.value === value);
  return preset ? preset.label : `${value} ${field.customSuffix}`;
};

type EditingSection = 'reglas' | 'limites' | null;

export function AgendaConfigSection({ sucursalId, organizationId, onDirtyChange }: AgendaConfigSectionProps) {
  const [config, setConfig] = useState<ConfigData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedVisible(loading);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EditingSection>(null);
  const [customMode, setCustomMode] = useState<Partial<Record<string, boolean>>>({});

  const reglasForm = useForm<ReglasFormValues>({
    resolver: zodResolver(reglasSchema),
    defaultValues: toReglasFormValues(DEFAULTS),
    mode: 'onChange',
  });
  const limitesForm = useForm<LimitesFormValues>({
    resolver: zodResolver(limitesSchema),
    defaultValues: toLimitesFormValues(DEFAULTS),
    mode: 'onChange',
  });

  const { isDirty: reglasDirty } = reglasForm.formState;
  const { isDirty: limitesDirty } = limitesForm.formState;

  useEffect(() => {
    onDirtyChange?.(reglasDirty || limitesDirty);
  }, [reglasDirty, limitesDirty, onDirtyChange]);

  // Ambos forms se mantienen sincronizados con la última verdad guardada aun
  // cuando no están en edición: onSubmitReglas/onSubmitLimites arman el
  // upsert combinando reglasForm.getValues() con limitesForm.getValues() (la
  // fila de agenda_config es una sola), y eso solo es seguro si el form que
  // no se está editando ya tiene los datos reales cargados — no los defaults
  // hardcodeados del primer render. afterSaveSync() mantiene esa garantía
  // después de cada guardado.
  const afterSaveSync = useCallback((next: ConfigData) => {
    reglasForm.reset(toReglasFormValues(next));
    limitesForm.reset(toLimitesFormValues(next));
  }, [reglasForm, limitesForm]);

  const fetchConfig = useCallback(async () => {
    const { data } = await supabase
      .from('agenda_config')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .maybeSingle();

    const next: ConfigData = data
      ? {
          duracion_base_min: data.duracion_base_min,
          buffer_despues_min: data.buffer_despues_min,
          cancelacion_limite_min: (data as any).cancelacion_limite_min ?? 120,
          modificacion_limite_min: (data as any).modificacion_limite_min ?? 120,
          dias_anticipacion: data.dias_anticipacion,
          anticipacion_minima_reserva_min: (data as any).anticipacion_minima_reserva_min ?? 30,
        }
      : DEFAULTS;

    setConfig(next);
    afterSaveSync(next);
    setLoading(false);
  }, [sucursalId, afterSaveSync]);

  useEffect(() => {
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalId]);

  const startEditingSection = (section: Exclude<EditingSection, null>) => {
    if (section === 'reglas') reglasForm.reset(toReglasFormValues(config));
    else limitesForm.reset(toLimitesFormValues(config));
    setCustomMode({});
    setEditing(section);
  };

  const cancelEditSection = (section: Exclude<EditingSection, null>) => {
    if (section === 'reglas') reglasForm.reset(toReglasFormValues(config));
    else limitesForm.reset(toLimitesFormValues(config));
    setCustomMode({});
    setEditing(null);
  };

  // Preserva verbatim la lógica de persistencia previa: upsert con
  // onConflict sucursal_id, y si falla, fallback a select→update/insert.
  // buffer_antes_min queda hardcodeado en 0, como ya estaba.
  const persistConfig = async (next: ConfigData): Promise<boolean> => {
    setSaving(true);
    const { error } = await supabase
      .from('agenda_config')
      .upsert(
        {
          sucursal_id: sucursalId,
          organization_id: organizationId,
          ...next,
          buffer_antes_min: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'sucursal_id' },
      );

    if (error) {
      const { data: existing } = await supabase
        .from('agenda_config')
        .select('id')
        .eq('sucursal_id', sucursalId)
        .maybeSingle();

      if (existing) {
        const { error: updateErr } = await supabase
          .from('agenda_config')
          .update({ ...next, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (updateErr) {
          toast.error('Error al guardar configuración');
          setSaving(false);
          return false;
        }
      } else {
        const { error: insertErr } = await supabase
          .from('agenda_config')
          .insert({ sucursal_id: sucursalId, organization_id: organizationId, ...next });
        if (insertErr) {
          toast.error('Error al guardar configuración');
          setSaving(false);
          return false;
        }
      }
    }

    setConfig(next);
    setSaving(false);
    return true;
  };

  const onSubmitReglas = async (values: ReglasFormValues) => {
    const next: ConfigData = {
      duracion_base_min: Number(values.duracion_base_min),
      buffer_despues_min: Number(values.buffer_despues_min),
      anticipacion_minima_reserva_min: Number(values.anticipacion_minima_reserva_min),
      dias_anticipacion: Number(values.dias_anticipacion),
      cancelacion_limite_min: Number(limitesForm.getValues('cancelacion_limite_min')),
      modificacion_limite_min: Number(limitesForm.getValues('modificacion_limite_min')),
    };
    const ok = await persistConfig(next);
    if (!ok) return;
    toast.success('Configuración guardada');
    afterSaveSync(next);
    setCustomMode({});
    setEditing(null);
  };

  const onSubmitLimites = async (values: LimitesFormValues) => {
    const next: ConfigData = {
      duracion_base_min: Number(reglasForm.getValues('duracion_base_min')),
      buffer_despues_min: Number(reglasForm.getValues('buffer_despues_min')),
      anticipacion_minima_reserva_min: Number(reglasForm.getValues('anticipacion_minima_reserva_min')),
      dias_anticipacion: Number(reglasForm.getValues('dias_anticipacion')),
      cancelacion_limite_min: Number(values.cancelacion_limite_min),
      modificacion_limite_min: Number(values.modificacion_limite_min),
    };
    const ok = await persistConfig(next);
    if (!ok) return;
    toast.success('Configuración guardada');
    afterSaveSync(next);
    setCustomMode({});
    setEditing(null);
  };

  const handleSaveReglas = () => { void reglasForm.handleSubmit(onSubmitReglas)(); };
  const handleSaveLimites = () => { void limitesForm.handleSubmit(onSubmitLimites)(); };

  const renderField = (control: Control<any>, field: FieldDef) => (
    <FormField
      key={field.key}
      control={control}
      name={field.key}
      render={({ field: rhfField }) => {
        const numericValue = Number(rhfField.value);
        const selectedOption = field.options.find((o) => o.value === numericValue);
        const isCustom = customMode[field.key] ?? !selectedOption;
        const selectValue = isCustom ? CUSTOM_KEY : String(selectedOption?.value ?? rhfField.value);

        return (
          <FormItem>
            <FormLabel className="text-xs font-medium">{field.label}</FormLabel>
            <Select
              value={selectValue}
              onValueChange={(value) => {
                if (value === CUSTOM_KEY) {
                  setCustomMode((prev) => ({ ...prev, [field.key]: true }));
                  return;
                }
                setCustomMode((prev) => ({ ...prev, [field.key]: false }));
                rhfField.onChange(value);
              }}
            >
              {/* FormControl vive en el trigger del Select, que es el control
                  siempre presente del campo: le da el id que FormLabel apunta
                  con htmlFor. El Input de "Personalizado" no puede llevar otro
                  FormControl (repetiría ese id), así que se nombra solo con
                  aria-label. */}
              <FormControl>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {field.options.map((option) => (
                  <SelectItem key={`${field.key}-${option.value}`} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_KEY}>Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {isCustom && (
              <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 p-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={`${field.label}, valor personalizado en ${field.customSuffix}`}
                    className="h-8 w-24 text-sm"
                    value={rhfField.value}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw !== '' && !/^\d+$/.test(raw)) return;
                      rhfField.onChange(raw);
                    }}
                    onBlur={() => {
                      const raw = rhfField.value as string;
                      const parsed = raw === '' ? field.min : Number(raw);
                      const normalized = Math.min(field.max, Math.max(field.min, parsed));
                      rhfField.onChange(String(normalized));
                      rhfField.onBlur();
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{field.customSuffix}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Ingresá un valor entre {field.min} y {field.max}.
                </p>
              </div>
            )}

            {/* Fuera del bloque isCustom: así un valor inválido que llegue de
                base sin coincidir con ningún preset también muestra su error. */}
            <FormMessage />

            <p className="text-[11px] text-muted-foreground">{field.description}</p>
          </FormItem>
        );
      }}
    />
  );

  const renderReadRow = (field: FieldDef, value: number) => (
    <div key={field.key} className="space-y-1">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs font-medium">{field.label}</span>
        <span className="text-sm font-medium tabular-nums">{formatFieldValue(field, value)}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">{field.description}</p>
    </div>
  );

  // min-w-0 + truncate: en el header de la Card el título compite con los
  // botones de acción, y "Límites y cancelaciones" en modo edición no entra a
  // 390px. El chip nunca se encoge; el que cede es el texto.
  const sectionTitle = (Icon: LucideIcon, label: string) => (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <span className="truncate">{label}</span>
    </span>
  );

  if (loading) {
    if (!showSkeleton) return null;
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <Skeleton className="h-4 w-32" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-0">
            <EditableSectionHeader
              title={sectionTitle(Timer, 'Reglas de reserva')}
              isEditing={editing === 'reglas'}
              saving={saving}
              disabled={editing !== null}
              onEdit={() => startEditingSection('reglas')}
              onCancel={() => cancelEditSection('reglas')}
              onSave={handleSaveReglas}
            />
          </CardHeader>
          <CardContent>
            {editing === 'reglas' ? (
              <Form {...reglasForm}>
                <div className="grid grid-cols-1 gap-4">
                  {REGLAS_FIELDS.map((field) => renderField(reglasForm.control, field))}
                </div>
              </Form>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {REGLAS_FIELDS.map((field) => renderReadRow(field, config[field.key as keyof ConfigData]))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <EditableSectionHeader
              title={sectionTitle(CalendarX, 'Límites y cancelaciones')}
              isEditing={editing === 'limites'}
              saving={saving}
              disabled={editing !== null}
              onEdit={() => startEditingSection('limites')}
              onCancel={() => cancelEditSection('limites')}
              onSave={handleSaveLimites}
            />
          </CardHeader>
          <CardContent>
            {editing === 'limites' ? (
              <Form {...limitesForm}>
                <div className="grid grid-cols-1 gap-4">
                  {LIMITES_FIELDS.map((field) => renderField(limitesForm.control, field))}
                </div>
              </Form>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {LIMITES_FIELDS.map((field) => renderReadRow(field, config[field.key as keyof ConfigData]))}
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
