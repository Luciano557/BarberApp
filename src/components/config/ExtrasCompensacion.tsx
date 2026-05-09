import { useState } from 'react';
import { Plus, Users, DollarSign, Wrench, MoreHorizontal, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Barber } from '@/types/barbershop';
import { ComisionEquipoConfig } from './ComisionEquipoConfig';
import { BonoFijoConfig } from './BonoFijoConfig';
import { ComisionProductosConfig } from './ComisionProductosConfig';

type ExtraType = 'comision_equipo' | 'bono_fijo' | 'comision_productos';

interface ExtrasCompensacionProps {
  barber: Barber;
  organizationId: string;
  sucursalId: string;
  allBarbers: Barber[];
}

export function ExtrasCompensacion({ barber, organizationId, sucursalId, allBarbers }: ExtrasCompensacionProps) {
  const [showComisionEquipo, setShowComisionEquipo] = useState(false);
  const [showBonoFijo, setShowBonoFijo] = useState(false);
  const [showComisionProductos, setShowComisionProductos] = useState(false);

  const handleAddExtra = (type: ExtraType) => {
    if (type === 'comision_equipo') setShowComisionEquipo(true);
    else if (type === 'bono_fijo') setShowBonoFijo(true);
    else if (type === 'comision_productos') setShowComisionProductos(true);
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">Extras de compensación</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
              <Plus className="h-3 w-3 mr-1" /> Agregar extra
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleAddExtra('comision_equipo')}>
              <Users className="h-4 w-4 mr-2" />
              Comisión extra por equipo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddExtra('bono_fijo')}>
              <DollarSign className="h-4 w-4 mr-2" />
              Bono fijo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddExtra('comision_productos')}>
              <Package className="h-4 w-4 mr-2" />
              Comisión por productos vendidos
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="text-muted-foreground">
              <Wrench className="h-4 w-4 mr-2" />
              Ajuste manual
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="text-muted-foreground">
              <MoreHorizontal className="h-4 w-4 mr-2" />
              Otro adicional
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ComisionEquipoConfig
        barberId={barber.id}
        organizationId={organizationId}
        sucursalId={sucursalId}
        allBarbers={allBarbers}
        forceShow={showComisionEquipo}
      />

      <div className="mt-2">
        <BonoFijoConfig
          barberId={barber.id}
          organizationId={organizationId}
          sucursalId={sucursalId}
          forceShow={showBonoFijo}
        />
      </div>

      <ComisionProductosConfig
        barberId={barber.id}
        organizationId={organizationId}
        sucursalId={sucursalId}
        forceShow={showComisionProductos}
      />
    </div>
  );
}
