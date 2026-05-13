import { Edit2, MoreVertical, PackagePlus, Settings2, History, Power, PowerOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ProductoConSucursal } from './types';

interface Props {
  item: ProductoConSucursal;
  onEdit: () => void;
  onToggleActive: (next: boolean) => void;
  onStockInicial: () => void;
  onAgregarStock: () => void;
  onAjustarStock: () => void;
  onVerHistorial: () => void;
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—';
  return `$${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtNumber(n: number) {
  return Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

export function ProductoListItem({
  item, onEdit, onToggleActive, onStockInicial, onAgregarStock, onAjustarStock, onVerHistorial,
}: Props) {
  const ps = item.sucursal;
  const activeInSucursal = ps?.activo === true;
  const sinConfig = !ps;
  const stock = ps?.stock_actual ?? 0;
  const stockMin = ps?.stock_minimo ?? 0;
  const stockBajo = ps && stockMin > 0 && stock <= stockMin;
  const stockNegativo = stock < 0;
  const sinMovimientoInicial = ps && stock === 0 && (ps.precio_venta || 0) === 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-transparent bg-muted/30 p-3 transition-colors hover:border-border hover:bg-muted/50 sm:flex-row sm:items-center">
      {/* Color de marca */}
      <div
        className="h-1 w-full shrink-0 rounded-full sm:h-10 sm:w-1"
        style={{ backgroundColor: item.marca?.color || 'hsl(var(--muted-foreground))' }}
        aria-hidden
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-foreground truncate">{item.producto.nombre}</span>
          {item.marca && (
            <Badge variant="outline" className="text-xs font-normal">
              {item.marca.nombre}
            </Badge>
          )}
          {!activeInSucursal && (
            <Badge variant="secondary" className="text-xs">
              {sinConfig ? 'No configurado' : 'Inactivo en sucursal'}
            </Badge>
          )}
          {stockNegativo && (
            <Badge variant="destructive" className="text-xs gap-1">
              <AlertTriangle className="h-3 w-3" /> Stock negativo
            </Badge>
          )}
          {stockBajo && !stockNegativo && (
            <Badge className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
              Stock bajo
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
          {ps ? (
            <>
              <span>Venta: <span className="text-foreground">{fmtMoney(ps.precio_venta)}</span></span>
              <span>Costo: {fmtMoney(ps.precio_costo)}</span>
              {ps.margen_pct != null && <span>Margen: {fmtNumber(ps.margen_pct)}%</span>}
              <span>Stock: <span className={stockNegativo ? 'text-destructive font-medium' : 'text-foreground'}>{fmtNumber(stock)}</span></span>
            </>
          ) : (
            <span>Aún no configurado en esta sucursal.</span>
          )}
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        {ps && (
          <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 flex-1 sm:flex-none">
            <Edit2 className="h-4 w-4 mr-1" /> Editar
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {!ps && (
              <>
                <DropdownMenuItem onClick={onEdit}>
                  <Edit2 className="h-4 w-4 mr-2" /> Configurar en sucursal
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {ps && sinMovimientoInicial && (
              <>
                <DropdownMenuItem onClick={onStockInicial}>
                  <PackagePlus className="h-4 w-4 mr-2" /> Cargar stock inicial
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {ps && (
              <>
                <DropdownMenuItem onClick={onAgregarStock}>
                  <PackagePlus className="h-4 w-4 mr-2" /> Agregar stock
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onAjustarStock}>
                  <Settings2 className="h-4 w-4 mr-2" /> Ajustar stock
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onVerHistorial}>
                  <History className="h-4 w-4 mr-2" /> Historial de movimientos
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {activeInSucursal ? (
              <DropdownMenuItem onClick={() => onToggleActive(false)}>
                <PowerOff className="h-4 w-4 mr-2 text-destructive" /> Desactivar en sucursal
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onToggleActive(true)}>
                <Power className="h-4 w-4 mr-2 text-success" /> Activar en sucursal
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
