import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AgendaConfigSectionProps {
  sucursalId: string;
  organizationId: string;
}

interface ConfigData {
  duracion_base_min: number;
  buffer_despues_min: number;
  cancelacion_limite_min: number;
  modificacion_limite_min: number;
  dias_anticipacion: number;
  anticipacion_minima_reserva_min: number;
}

type FieldKey = keyof ConfigData;

type FieldDef = {
  key: FieldKey;
  label: string;
  description: string;
  options: Array<{ label: string; value: number }>;
  customSuffix: string;
  customMax?: number;
};

const DEFAULTS: ConfigData = {
  duracion_base_min: 15,
  buffer_despues_min: 5,
  cancelacion_limite_min: 120,
  modificacion_limite_min: 120,
  dias_anticipacion: 30,
  anticipacion_minima_reserva_min: 30,
};

const CUSTOM_KEY = '__custom__';

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
  },
  {
    key: 'anticipacion_minima_reserva_min',
    label: 'Anticipación mínima',
    description: 'Tiempo mínimo entre ahora y el primer turno disponible.',
    options: [
      { label: 'Sin anticipacion', value: 0 },
      { label: '15 min', value: 15 },
      { label: '30 min', value: 30 },
      { label: '1 h', value: 60 },
      { label: '2 h', value: 120 },
      { label: '4 h', value: 240 },
      { label: '24 h', value: 1440 },
    ],
    customSuffix: 'min',
  },
  {
    key: 'dias_anticipacion',
    label: 'Días de anticipación',
    description: 'Cuántos días hacia adelante se puede reservar.',
    options: [
      { label: '7 dias', value: 7 },
      { label: '14 dias', value: 14 },
      { label: '30 dias', value: 30 },
      { label: '60 dias', value: 60 },
      { label: '90 dias', value: 90 },
    ],
    customSuffix: 'dias',
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
    customMax: 10080,
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
    customMax: 10080,
  },
];

export function AgendaConfigSection({ sucursalId, organizationId }: AgendaConfigSectionProps) {
  const [config, setConfig] = useState<ConfigData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customMode, setCustomMode] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [customDraft, setCustomDraft] = useState<Partial<Record<FieldKey, string>>>({});
  const [customError, setCustomError] = useState<Partial<Record<FieldKey, string>>>({});

  const fetchConfig = useCallback(async () => {
    const { data } = await supabase
      .from('agenda_config')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .maybeSingle();

    if (data) {
      setConfig({
        duracion_base_min: data.duracion_base_min,
        buffer_despues_min: data.buffer_despues_min,
        cancelacion_limite_min: (data as any).cancelacion_limite_min ?? 120,
        modificacion_limite_min: (data as any).modificacion_limite_min ?? 120,
        dias_anticipacion: data.dias_anticipacion,
        anticipacion_minima_reserva_min: (data as any).anticipacion_minima_reserva_min ?? 30,
      });
    }
    setLoading(false);
  }, [sucursalId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('agenda_config')
      .upsert(
        {
          sucursal_id: sucursalId,
          organization_id: organizationId,
          ...config,
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
          .update({ ...config, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (updateErr) {
          toast.error('Error al guardar configuracion');
          setSaving(false);
          return;
        }
      } else {
        const { error: insertErr } = await supabase
          .from('agenda_config')
          .insert({ sucursal_id: sucursalId, organization_id: organizationId, ...config });
        if (insertErr) {
          toast.error('Error al guardar configuracion');
          setSaving(false);
          return;
        }
      }
    }

    toast.success('Configuracion guardada');
    setSaving(false);
  };

  const updateField = (field: FieldKey, value: number) => {
    setConfig((prev) => ({ ...prev, [field]: value < 0 ? 0 : value }));
  };

  const formatCustomValue = (field: FieldDef, value: number) => `${value} ${field.customSuffix}`;

  const renderField = (field: FieldDef) => {
    const currentValue = config[field.key];
    const selectedOption = field.options.find((option) => option.value === currentValue);
    const isCustom = customMode[field.key] ?? !selectedOption;
    const selectValue = isCustom ? CUSTOM_KEY : String(selectedOption?.value ?? currentValue);
    const draftValue = customDraft[field.key] ?? String(currentValue);
    const errorText = customError[field.key] ?? '';

    return (
      <div key={field.key} className="space-y-2">
        <Label className="text-xs font-medium">{field.label}</Label>
        <Select
          value={selectValue}
          onValueChange={(value) => {
            if (value === CUSTOM_KEY) {
              setCustomMode((prev) => ({ ...prev, [field.key]: true }));
              setCustomDraft((prev) => ({ ...prev, [field.key]: String(config[field.key]) }));
              setCustomError((prev) => ({ ...prev, [field.key]: '' }));
              return;
            }

            setCustomMode((prev) => ({ ...prev, [field.key]: false }));
            setCustomError((prev) => ({ ...prev, [field.key]: '' }));
            updateField(field.key, Number(value));
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
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
                className="h-8 w-24 text-sm"
                value={draftValue}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw !== '' && !/^\d+$/.test(raw)) return;

                  setCustomDraft((prev) => ({ ...prev, [field.key]: raw }));

                  if (raw === '') {
                    setCustomError((prev) => ({ ...prev, [field.key]: '' }));
                    return;
                  }

                  const parsed = Number(raw);
                  if (parsed > 120) {
                    setCustomError((prev) => ({ ...prev, [field.key]: 'El valor máximo permitido es 120.' }));
                    updateField(field.key, 120);
                    return;
                  }

                  setCustomError((prev) => ({ ...prev, [field.key]: '' }));
                  updateField(field.key, parsed);
                }}
                onBlur={() => {
                  const raw = customDraft[field.key] ?? '';
                  const parsed = raw === '' ? 0 : Number(raw);
                  const normalized = Math.min(120, Math.max(0, Math.trunc(Number.isNaN(parsed) ? 0 : parsed)));
                  setCustomDraft((prev) => ({ ...prev, [field.key]: String(normalized) }));
                  setCustomError((prev) => ({
                    ...prev,
                    [field.key]: parsed > 120 ? 'El valor máximo permitido es 120.' : '',
                  }));
                  updateField(field.key, normalized);
                }}
              />
              <span className="text-xs text-muted-foreground">{field.customSuffix}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Ingresá un valor entre 0 y 120.</p>
            {errorText && <p className="text-[11px] text-destructive">{errorText}</p>}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">{field.description}</p>
        {!selectedOption && (
          <p className="text-[11px] text-foreground/80">
            Personalizado actual: <span className="font-medium">{formatCustomValue(field, currentValue)}</span>
          </p>
        )}
      </div>
    );
  };

  if (loading) return <div className="py-4 text-sm text-muted-foreground">Cargando configuración...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Settings className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Configuración general</h2>
          <p className="text-xs text-muted-foreground">Reglas y límites de las reservas online</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Reglas de reserva</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4">{REGLAS_FIELDS.map(renderField)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Límites y cancelaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4">{LIMITES_FIELDS.map(renderField)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" /> {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}
