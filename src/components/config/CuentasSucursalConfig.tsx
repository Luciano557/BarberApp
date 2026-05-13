import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Building2,
  ChevronDown,
  Sparkles,
  Briefcase,
  Lock,
  ShieldCheck,
  KeyRound,
  MapPin,
} from 'lucide-react';
import { useSucursalActionPinConfig } from '@/hooks/useSucursalActionPinConfig';
import { PinActionsToggleList } from './PinActionsToggleList';
import { useState } from 'react';

function InfoRow({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <p className="text-sm text-foreground leading-snug pt-1">{children}</p>
    </div>
  );
}

function FactRow({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: any;
  label: string;
  value?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-xs font-medium text-foreground text-right truncate">
        {badge ?? value}
      </div>
    </div>
  );
}

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
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base">Cuentas de sucursal</CardTitle>
            <p className="text-sm text-muted-foreground leading-snug">
              Accesos operativos para usar Vittro desde caja, recepción o un dispositivo compartido.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 3 mini filas con ícono */}
        <div className="space-y-2.5">
          <InfoRow icon={Sparkles}>
            Cada sucursal tiene una cuenta propia generada automáticamente por Vittro.
          </InfoRow>
          <InfoRow icon={Briefcase}>
            Sirve para operar el día a día sin usar cuentas personales del equipo.
          </InfoRow>
          <InfoRow icon={Lock}>
            No accede a configuración, estadísticas, comisiones ni gestión del negocio.
          </InfoRow>
        </div>

        {/* Bloque destacado: Funcionamiento */}
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs font-medium text-foreground mb-1">Funcionamiento</p>
          <div className="divide-y divide-border">
            <FactRow
              icon={ShieldCheck}
              label="Estado"
              badge={<Badge variant="default" className="text-[10px] py-0 px-1.5 h-5">Activas por defecto</Badge>}
            />
            <FactRow
              icon={KeyRound}
              label="Credenciales"
              value="Se gestionan desde cada sucursal"
            />
            <FactRow
              icon={MapPin}
              label="Alcance"
              value="Solo opera la sucursal asignada"
            />
          </div>
        </div>

        {/* Configuración avanzada */}
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border border-border px-3 py-2 hover:bg-muted/40 transition-colors">
            <span className="text-sm font-medium text-foreground">Configuración avanzada</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Definí qué acciones requieren PIN cuando se realizan desde una Cuenta de sucursal.
              Si una sucursal tiene configuración personalizada, esa configuración tiene prioridad sobre estos valores generales.
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
