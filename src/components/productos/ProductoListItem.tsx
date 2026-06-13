import { useState } from 'react';
import { MoreVertical, PackagePlus, Settings2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/StatusPill';
import { TagPill } from '@/components/ui/TagPill';
import { DrawerForm } from '@/components/ui/drawer-form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ProductoConSucursal } from './types';
import { EntityColorBar } from '@/components/ui/EntityColorBar';

interface Props {
  item: ProductoConSucursal;
  onEdit: () => void;
  onToggleActive: (next: boolean) => void;
  onStockInicial: () => void;
  onAgregarStock: () => void;
  onAjustarStock: () => void;
  onVerHistorial: () => void;
  onDelete?: () => void;
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—';
  return `$${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtNumber(n: number) {
  return Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

export function ProductoListItem({
  item, onEdit, onToggleActive, onStockInicial, onAgregarStock, onAjustarStock, onVerHistorial, onDelete,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const ps = item.sucursal;
  const activeInSucursal = ps?.activo === true;
  const sinConfig = !ps;
  const stock = ps?.stock_actual ?? 0;
  const stockMin = ps?.stock_minimo ?? 0;
  const stockBajo = ps && stockMin > 0 && stock <= stockMin;
  const stockNegativo = stock < 0;

  const statusLabel = sinConfig
    ? 'No configurado en sucursal'
    : activeInSucursal
    ? 'Activo en sucursal'
    : 'Inactivo en sucursal';

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-transparent bg-muted/30 p-3 transition-colors hover:border-border hover:bg-muted/50 sm:flex-row sm:items-center">
        <EntityColorBar color={item.marca?.color} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground truncate">{item.producto.nombre}</span>
            {!activeInSucursal && (
              <StatusPill
                status="neutral"
                label={sinConfig ? 'No configurado' : 'Inactivo en sucursal'}
              />
            )}
            {stockNegativo && (
              <StatusPill status="error" label="Stock negativo" />
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

        <div className="flex items-center gap-2 justify-end">
          {item.marca && (
            <TagPill label={item.marca.nombre} />
          )}
          {stockBajo && !stockNegativo && (
            <StatusPill status="warning" label="Stock bajo" />
          )}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-transparent hover:bg-muted transition-colors border-[0.5px] border-border"
            title="Opciones"
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <DrawerForm
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={item.producto.nombre}
        size="sm"
        footer={
          <div className="flex w-full flex-col gap-1.5">
            <Button
              variant="ghost"
              className="w-full justify-start bg-muted/50 border-border text-foreground hover:bg-muted"
              onClick={() => { setDrawerOpen(false); onAgregarStock(); }}
            >
              <PackagePlus className="h-4 w-4 mr-2" /> Agregar stock
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start bg-muted/50 border-border text-foreground hover:bg-muted"
              onClick={() => { setDrawerOpen(false); onAjustarStock(); }}
            >
              <Settings2 className="h-4 w-4 mr-2" /> Ajustar stock
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start border border-border bg-muted/50 hover:bg-muted"
              onClick={() => { setDrawerOpen(false); onVerHistorial(); }}
            >
              <History className="h-4 w-4 mr-2" /> Historial de movimientos
            </Button>

            <div className="border-t border-border my-1" />

            <Button
              variant="ghost"
              className="w-full justify-start border border-border bg-muted/50 hover:bg-muted"
              onClick={() => { setDrawerOpen(false); onEdit(); }}
            >
              Editar producto
            </Button>

            <div className="border-t border-border my-1" />

            {activeInSucursal ? (
              <Button
                variant="ghost"
                className="w-full justify-start bg-status-warning text-white hover:bg-status-warning/90"
                onClick={() => { setDrawerOpen(false); setDeactivateConfirm(true); }}
              >
                Desactivar en sucursal
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="w-full justify-start bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50"
                  onClick={() => { onToggleActive(true); setDrawerOpen(false); }}
                >
                  Activar en sucursal
                </Button>
                {onDelete && ps && (
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    onClick={() => { setDrawerOpen(false); setDeleteConfirm(true); }}
                  >
                    Eliminar
                  </Button>
                )}
              </>
            )}
          </div>
        }
      >
        <div className="space-y-5">
          <p className={`text-sm font-medium ${activeInSucursal ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
            {statusLabel}
          </p>

          <div className="rounded-xl bg-muted/50 p-5 text-center">
            <div className="text-4xl font-bold tabular-nums text-foreground">
              {ps ? fmtNumber(stock) : '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5 uppercase tracking-wide">Stock actual</div>
            {stockBajo && !stockNegativo && (
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium">Bajo el mínimo</div>
            )}
            {stockNegativo && (
              <div className="mt-2 text-xs text-destructive font-medium">Stock negativo</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Precio venta</div>
              <div className="font-medium text-foreground mt-0.5">{fmtMoney(ps?.precio_venta)}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Precio costo</div>
              <div className="font-medium text-foreground mt-0.5">{fmtMoney(ps?.precio_costo)}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Stock mínimo</div>
              <div className="font-medium text-foreground mt-0.5">{ps ? fmtNumber(ps.stock_minimo ?? 0) : '—'}</div>
            </div>
            {item.marca && (
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Marca</div>
                <div className="font-medium text-foreground mt-0.5">{item.marca.nombre}</div>
              </div>
            )}
          </div>
        </div>
      </DrawerForm>

      <AlertDialog open={deactivateConfirm} onOpenChange={setDeactivateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar en sucursal</AlertDialogTitle>
            <AlertDialogDescription>
              "{item.producto.nombre}" dejará de estar disponible en esta sucursal. Podés volver a activarlo cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onToggleActive(false); setDeactivateConfirm(false); }}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {onDelete && ps && (
        <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar configuración de sucursal</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminará la configuración de "{item.producto.nombre}" en esta sucursal (precios y stock). El producto global seguirá existiendo. Esta acción no se puede deshacer desde la interfaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { onDelete(); setDeleteConfirm(false); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
