import { Building2, MapPin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useSucursal } from '@/contexts/SucursalContext';
import { useAuth } from '@/contexts/AuthContext';

interface SucursalSelectorProps {
  collapsed?: boolean;
}

export function SucursalSelector({ collapsed = false }: SucursalSelectorProps) {
  const { sucursales, currentSucursal, setCurrentSucursal, isAllMode } = useSucursal();
  const { isOwner, isGeneralManager, isManager } = useAuth();

  const canSwitch = isOwner || isGeneralManager;

  // Rail (collapsed): a single location glyph that sits on the light sidebar.
  const collapsedGlyph = (title: string) => (
    <div className="px-2 py-2">
      <div
        className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center mx-auto"
        title={title}
      >
        <MapPin className="h-4 w-4 text-accent-foreground" />
      </div>
    </div>
  );

  // For managers/barbers: show their fixed sucursal as a static pill on the navy card.
  if (!canSwitch) {
    if (!currentSucursal) return null;
    if (collapsed) return collapsedGlyph(currentSucursal.nombre);

    return (
      <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-white/10 text-white text-xs ring-1 ring-inset ring-white/10">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--status-success))] shadow-[0_0_0_3px_hsl(var(--status-success)/0.25)]" />
        <span className="font-medium truncate">{currentSucursal.nombre}</span>
      </div>
    );
  }

  // Don't show if only 1 sucursal and is owner (still show dropdown so they can see it)
  if (sucursales.length <= 1 && !isOwner && !isGeneralManager) return null;

  if (collapsed) return collapsedGlyph(currentSucursal?.nombre || 'Todas las sucursales');

  const triggerLabel = isAllMode
    ? 'Todas las sucursales'
    : (currentSucursal?.nombre || 'Seleccionar sucursal');

  return (
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
      <SelectTrigger className="h-9 rounded-lg border border-white/10 bg-white/10 px-3 text-xs font-medium text-white transition-colors hover:bg-white/[0.15] focus:ring-white/30 focus:ring-offset-0 [&>svg]:text-white">
        <span className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              isAllMode
                ? 'bg-white/50'
                : 'bg-[hsl(var(--status-success))] shadow-[0_0_0_3px_hsl(var(--status-success)/0.25)]',
            )}
          />
          <span className="truncate">{triggerLabel}</span>
        </span>
      </SelectTrigger>
      <SelectContent>
        {(isOwner || isGeneralManager) && sucursales.length > 1 && (
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
  );
}
