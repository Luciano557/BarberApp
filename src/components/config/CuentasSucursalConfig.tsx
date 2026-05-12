import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Building2, ChevronDown } from 'lucide-react';
import { useSucursalActionPinConfig } from '@/hooks/useSucursalActionPinConfig';
import { PinActionsToggleList } from './PinActionsToggleList';
import { useState } from 'react';

export function CuentasSucursalConfig() {
  const { isOwner, isGeneralManager } = useAuth();
  const canSee = isOwner || isGeneralManager;
  const [open, setOpen] = useState(false);
  const config = useSucursalActionPinConfig({ scope: 'org', enabled: canSee });

  if (!canSee) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-2 flex-1">
            <CardTitle className="text-base">Cuentas de sucursal</CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Las Cuentas de sucursal son accesos operativos para usar Vittro desde la caja, recepción o dispositivo principal de cada local.
              Cada sucursal tiene una cuenta propia generada automáticamente por Vittro. Estas cuentas permiten operar el día a día sin usar
              cuentas personales del equipo y sin acceder a la configuración administrativa del negocio.
            </p>
            <p className="text-xs text-muted-foreground">
              No son miembros del equipo, no son barberos y no aparecen en estadísticas, comisiones ni agenda como recurso.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
          <Badge variant="default">Activas por defecto</Badge>
          <p className="text-xs text-muted-foreground flex-1">
            Cada sucursal tiene una Cuenta de sucursal propia. Las credenciales se gestionan desde la configuración de cada sucursal.
          </p>
        </div>

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border border-border px-3 py-2 hover:bg-muted/40 transition-colors">
            <span className="text-sm font-medium text-foreground">Configuración avanzada</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Definí qué acciones requieren PIN cuando se realizan desde una Cuenta de sucursal. Si una sucursal tiene configuración
              personalizada, esa configuración tendrá prioridad sobre estos valores generales.
            </p>
            <PinActionsToggleList
              values={(a) => config.valuesByAction(a)}
              onChange={(a, v) => config.setRequiresPin(a, v)}
              savingAction={config.saving}
              isLoading={config.isLoading}
            />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
