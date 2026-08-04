import { Search, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      <Popover open={searchOpen} onOpenChange={onSearchOpenChange}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between font-normal">
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
            {selectedCliente ? (
              <X className="h-4 w-4 opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onSelect(null); }} />
            ) : (
              <Search className="h-4 w-4 opacity-60" />
            )}
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
              <div className="px-3 py-3 text-xs text-muted-foreground">Buscando...</div>
            )}
            {!searching && results.length === 0 && (
              <div className="px-3 py-3 text-xs text-muted-foreground">
                Sin resultados. Proba con otro termino o crea un cliente nuevo.
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
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    Otra sucursal
                  </span>
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
