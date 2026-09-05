import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProductoConSucursal, MovimientoStock } from './types';
import { SkeletonRow } from '@/components/ui/SkeletonRow';
import { useDelayedVisible } from '@/hooks/useDelayedVisible';

interface Props {
  open: boolean;
  item: ProductoConSucursal;
  onClose: () => void;
}

const TIPO_LABEL: Record<MovimientoStock['tipo'], { label: string; className: string }> = {
  stock_inicial: { label: 'Stock inicial', className: 'bg-muted text-foreground' },
  reposicion: { label: 'Reposición', className: 'bg-success/15 text-success border border-success/30' },
  ajuste_manual: { label: 'Ajuste manual', className: 'bg-status-warning/15 text-status-warning-foreground border border-status-warning/30' },
  venta: { label: 'Venta', className: 'bg-primary/15 text-primary border border-primary/30' },
};

function fmtFecha(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export function StockHistoryDialog({ open, item, onClose }: Props) {
  const [movs, setMovs] = useState<MovimientoStock[]>([]);
  const [loading, setLoading] = useState(false);
  const showSkeleton = useDelayedVisible(loading);

  useEffect(() => {
    if (!open || !item.sucursal) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('movimientos_stock')
        .select('*')
        .eq('producto_sucursal_id', item.sucursal!.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (cancel) return;
      if (error) {
        toast.error('No se pudo cargar el historial');
      } else {
        setMovs((data || []) as MovimientoStock[]);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [open, item.sucursal?.id]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Historial de movimientos
          </DialogTitle>
          <DialogDescription>
            {item.producto.nombre}{item.marca ? ` · ${item.marca.nombre}` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          showSkeleton ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/30">
                  <SkeletonRow leading={false} />
                </div>
              ))}
            </div>
          ) : null
        ) : movs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aún no hay movimientos para este producto en esta sucursal.
          </p>
        ) : (
          <div className="space-y-2">
            {movs.map(m => {
              const cfg = TIPO_LABEL[m.tipo];
              const positivo = m.cantidad >= 0;
              return (
                <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-transparent hover:border-border">
                  <Badge className={`text-xs ${cfg.className}`} variant="outline">{cfg.label}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${positivo ? 'text-success' : 'text-destructive'}`}>
                        {positivo ? '+' : ''}{m.cantidad}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {m.stock_previo} → <span className="text-foreground font-medium">{m.stock_resultante}</span>
                      </span>
                    </div>
                    {m.motivo && (
                      <p className="text-xs text-muted-foreground mt-1 break-words">{m.motivo}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtFecha(m.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
