import { Building2, MapPin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSucursal } from '@/contexts/SucursalContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface SucursalSelectorProps {
  collapsed?: boolean;
}

export function SucursalSelector({ collapsed = false }: SucursalSelectorProps) {
  const { sucursales, currentSucursal, setCurrentSucursal, isAllMode } = useSucursal();
  const { isOwner, isGeneralManager } = useAuth();

  // Don't show if only 1 sucursal and not owner
  if (sucursales.length <= 1 && !isOwner && !isGeneralManager) return null;

  // Collapsed mode: just show icon
  if (collapsed) {
    return (
      <div className="px-2 py-2">
        <div
          className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center mx-auto"
          title={currentSucursal?.nombre || 'Todas las sucursales'}
        >
          <MapPin className="h-4 w-4 text-accent-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 border-b border-sidebar-border">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">
        Sucursal
      </label>
      <Select
        value={isAllMode ? '__all__' : (currentSucursal?.id || '')}
        onValueChange={(val) => {
          if (val === '__all__') {
            setCurrentSucursal(null);
          } else {
            setCurrentSucursal(val);
          }
        }}
      >
        <SelectTrigger className="h-8 text-xs bg-accent border-none">
          <SelectValue placeholder="Seleccionar sucursal" />
        </SelectTrigger>
        <SelectContent>
          {isOwner && sucursales.length > 1 && (
            <SelectItem value="__all__">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3" />
                Todas las sucursales
              </span>
            </SelectItem>
          )}
          {sucursales.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />
                {s.nombre}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
