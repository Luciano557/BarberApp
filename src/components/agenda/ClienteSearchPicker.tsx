import { Search, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatPhoneDisplay } from '@/lib/phone';
import { clienteFullName, type ClienteLite } from './hooks/useClienteSearch';

interface ClienteSearchPickerProps {
  label?: string;
  selectedCliente: ClienteLite | null;
  onSelect: (c: ClienteLite | null) => void;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (q: string) => void;
  results: ClienteLite[];
  searching: boolean;
}

export function ClienteSearchPicker({
  label = 'Cliente',
  selectedCliente,
  onSelect,
  searchOpen,
  onSearchOpenChange,
  query,
  onQueryChange,
  results,
  searching,
}: ClienteSearchPickerProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {/* relative + botón de limpiar como hermano posicionado: el trigger de
          abajo ya es un <button> (Button sin asChild), así que la X no puede
          vivir adentro como <button> propio (HTML no permite button dentro
          de button) — antes era un <svg onClick>, ahora es un <button> real
          con su propio hit-area de 44px, superpuesto visualmente. */}
      <div className="relative">
        <Popover open={searchOpen} onOpenChange={onSearchOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn('w-full justify-between font-normal', selectedCliente && 'pr-10')}
            >
              {selectedCliente ? (
                <span className="flex items-center gap-2 truncate">
                  <span className="truncate">{clienteFullName(selectedCliente)}</span>
                  {selectedCliente.telefono && (
                    <span className="text-xs text-muted-foreground truncate">· {formatPhoneDisplay(selectedCliente.telefono)}</span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">Buscar por nombre, apellido, telefono o email</span>
              )}
              {!selectedCliente && <Search className="h-4 w-4 opacity-60" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                autoFocus
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Buscar por nombre, apellido, telefono o email"
                className="flex h-10 w-full bg-transparent py-2 text-base md:text-sm outline-none placeholder:text-muted-foreground"
                maxLength={80}
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {searching && (
                <div className="flex items-center justify-center gap-1.5 px-3 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-status-info" />
                  <p className="text-xs text-muted-foreground">Buscando...</p>
                </div>
              )}
              {!searching && results.length === 0 && (
                <div className="flex items-center justify-center gap-1.5 px-3 py-4 text-center">
                  <Search className="h-4 w-4 shrink-0 text-status-info" />
                  <p className="text-xs text-muted-foreground">
                    Sin resultados. Proba con otro termino o crea un cliente nuevo.
                  </p>
                </div>
              )}
              {!searching && results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onSelect(c); onSearchOpenChange(false); }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-start gap-2',
                    selectedCliente?.id === c.id && 'bg-accent',
                  )}
                >
                  <Check className={cn('h-4 w-4 mt-0.5 shrink-0', selectedCliente?.id === c.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{clienteFullName(c)}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[c.telefono ? formatPhoneDisplay(c.telefono) : null, c.email].filter(Boolean).join(' · ') || '-'}
                    </div>
                  </div>
                  {!c.inSucursal && (
                    <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                      Otra sucursal
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        {selectedCliente && (
          <button
            type="button"
            aria-label="Quitar cliente seleccionado"
            onClick={(e) => { e.stopPropagation(); onSelect(null); }}
            className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
