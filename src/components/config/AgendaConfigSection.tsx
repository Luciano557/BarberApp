import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AgendaConfigSectionProps {
  sucursalId: string;
  organizationId: string;
}

interface ConfigData {
  duracion_base_min: number;
  buffer_despues_min: number;
  cancelacion_limite_hs: number;
  modificacion_limite_hs: number;
  dias_anticipacion: number;
  anticipacion_minima_reserva_min: number;
}

const DEFAULTS: ConfigData = {
  duracion_base_min: 15,
  buffer_despues_min: 5,
  cancelacion_limite_hs: 2,
  modificacion_limite_hs: 2,
  dias_anticipacion: 30,
  anticipacion_minima_reserva_min: 30,
};

export function AgendaConfigSection({ sucursalId, organizationId }: AgendaConfigSectionProps) {
  const [config, setConfig] = useState<ConfigData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        cancelacion_limite_hs: data.cancelacion_limite_hs,
        modificacion_limite_hs: data.modificacion_limite_hs,
        dias_anticipacion: data.dias_anticipacion,
        anticipacion_minima_reserva_min: (data as any).anticipacion_minima_reserva_min ?? 30,
      });
    }
    setLoading(false);
  }, [sucursalId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('agenda_config')
      .upsert({
        sucursal_id: sucursalId,
        organization_id: organizationId,
        ...config,
        buffer_antes_min: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'sucursal_id' });

    if (error) {
      // If unique constraint doesn't exist on sucursal_id, try insert/update pattern
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
        if (updateErr) { toast.error('Error al guardar configuración'); setSaving(false); return; }
      } else {
        const { error: insertErr } = await supabase
          .from('agenda_config')
          .insert({ sucursal_id: sucursalId, organization_id: organizationId, ...config });
        if (insertErr) { toast.error('Error al guardar configuración'); setSaving(false); return; }
      }
    }

    toast.success('Configuración guardada');
    setSaving(false);
  };

  const updateField = (field: keyof ConfigData, value: string) => {
    const num = parseInt(value) || 0;
    setConfig(prev => ({ ...prev, [field]: Math.max(0, num) }));
  };

  if (loading) return <div className="text-sm text-muted-foreground py-4">Cargando configuración...</div>;

  type FieldDef = { key: keyof ConfigData; label: string; suffix: string; description: string };

  const reglas: FieldDef[] = [
    { key: 'duracion_base_min', label: 'Duración base', suffix: 'min', description: 'Unidad mínima de tiempo para turnos' },
    { key: 'buffer_despues_min', label: 'Tiempo de espera', suffix: 'min', description: 'Tiempo libre después de cada turno' },
    { key: 'anticipacion_minima_reserva_min', label: 'Anticipación mínima', suffix: 'min', description: 'Tiempo mínimo entre ahora y el primer turno disponible' },
    { key: 'dias_anticipacion', label: 'Días de anticipación', suffix: 'días', description: 'Cuántos días hacia adelante se puede reservar' },
  ];

  const limites: FieldDef[] = [
    { key: 'cancelacion_limite_hs', label: 'Límite cancelación', suffix: 'hs', description: 'Horas mínimas de anticipación para cancelar' },
    { key: 'modificacion_limite_hs', label: 'Límite reprogramación', suffix: 'hs', description: 'Horas mínimas de anticipación para reprogramar' },
  ];

  const renderField = (f: FieldDef) => (
    <div key={f.key} className="space-y-1.5">
      <Label className="text-xs font-medium">{f.label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={config[f.key]}
          onChange={e => updateField(f.key, e.target.value)}
          className="w-24 h-8 text-sm"
        />
        <span className="text-xs text-muted-foreground">{f.suffix}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">{f.description}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Configuración general</h2>
          <p className="text-xs text-muted-foreground">Reglas y límites de las reservas online</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Reglas de reserva</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {reglas.map(renderField)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Límites y cancelaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {limites.map(renderField)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}
