import { useState } from 'react';
import { RefreshCw, Loader2, MonitorSmartphone, Building2, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useSucursal } from '@/contexts/SucursalContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MpDevice } from '@/hooks/useMercadoPago';

interface MpDevicesConfigProps {
  devices: MpDevice[];
  devicesLoading: boolean;
  onSync: () => void;
  onAssign: (mpDeviceId: string, sucursalId: string | null) => Promise<void>;
  canManage: boolean;
}

function DeviceNameEditor({
  device,
  canManage,
}: {
  device: MpDevice;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(device.name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('mp_devices')
        .update({ name: trimmed })
        .eq('id', device.id);
      if (error) throw error;
      toast.success('Nombre actualizado');
      setEditing(false);
    } catch {
      toast.error('No se pudo guardar el nombre');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(device.name || '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
          className="h-7 text-sm"
          placeholder="Ej: Mostrador, Sala 2..."
          autoFocus
        />
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleCancel}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0 group">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{device.name || device.mp_device_id}</p>
        <p className="text-xs text-muted-foreground truncate">{device.mp_device_id}</p>
      </div>
      {canManage && (
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export function MpDevicesConfig({
  devices,
  devicesLoading,
  onSync,
  onAssign,
  canManage,
}: MpDevicesConfigProps) {
  const { sucursales } = useSucursal();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <MonitorSmartphone className="h-4 w-4" />
              Terminales Point
            </CardTitle>
            <CardDescription>
              Asigná cada terminal a una sucursal. Pasá el cursor sobre el nombre para editarlo.
            </CardDescription>
          </div>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={devicesLoading}
              className="gap-2 shrink-0"
            >
              {devicesLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sincronizar
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {devicesLoading && devices.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Buscando terminales...</span>
          </div>
        ) : devices.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            No se encontraron terminales vinculadas a esta cuenta de MercadoPago.
            <br />
            Verificá que la terminal esté encendida y asociada a tu cuenta MP, luego hacé clic en{' '}
            <strong>Sincronizar</strong>.
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.mp_device_id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <MonitorSmartphone className="h-5 w-5 shrink-0 text-muted-foreground" />

                <DeviceNameEditor device={device} canManage={canManage} />

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs hidden sm:flex">
                    {device.operating_mode ?? 'PDV'}
                  </Badge>

                  {canManage ? (
                    <Select
                      value={device.sucursal_id ?? 'none'}
                      onValueChange={(val) =>
                        onAssign(device.mp_device_id, val === 'none' ? null : val)
                      }
                    >
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">Sin asignar</span>
                        </SelectItem>
                        {sucursales.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-1.5">
                              <Building2 className="h-3 w-3" />
                              {s.nombre}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {sucursales.find((s) => s.id === device.sucursal_id)?.nombre ?? 'Sin asignar'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


