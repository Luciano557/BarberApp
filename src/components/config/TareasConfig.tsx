import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { Loader2, Clock } from 'lucide-react';

export function TareasConfig() {
  const { organization, updateOrganization } = useOrganization();
  const [dias, setDias] = useState(String(organization?.peticiones_vencimiento_dias ?? 60));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const value = parseInt(dias);
    if (isNaN(value) || value < 1 || value > 365) {
      toast.error('El valor debe ser entre 1 y 365 días');
      return;
    }

    setSaving(true);
    const { error } = await updateOrganization({ peticiones_vencimiento_dias: value });
    setSaving(false);

    if (error) {
      toast.error('Error al guardar');
    } else {
      toast.success('Configuración guardada');
    }
  };

  const presets = [
    { label: '15 días', value: 15 },
    { label: '30 días', value: 30 },
    { label: '60 días', value: 60 },
    { label: '90 días', value: 90 },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Vencimiento de peticiones</CardTitle>
              <CardDescription>
                Las peticiones pendientes se marcarán como vencidas después de este plazo
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {presets.map(p => (
              <Button
                key={p.value}
                variant={parseInt(dias) === p.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDias(String(p.value))}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Label className="text-sm shrink-0">Personalizado:</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              value={dias}
              onChange={e => setDias(e.target.value)}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">días</span>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
