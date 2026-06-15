import { Fragment } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { User, Clock } from 'lucide-react';
import { DrawerForm } from '@/components/ui/drawer-form';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/StatusPill';
import { Transaction, TransactionPayment, getMethodLabel, isDigitalMethod } from '@/types/barbershop';

interface TransactionDetailDrawerProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canVoid: boolean;
  onVoidRequest: () => void;
}

export function TransactionDetailDrawer({
  transaction,
  open,
  onOpenChange,
  canVoid,
  onVoidRequest,
}: TransactionDetailDrawerProps) {
  const isVoided = transaction?.estado === 'anulado';

  const txPayments: TransactionPayment[] =
    transaction?.payments && transaction.payments.length > 0
      ? transaction.payments
      : transaction
      ? [{ method: transaction.paymentMethod, amount: transaction.total, basePago: transaction.total }]
      : [];

  const totalCobrado = transaction?.totalCobrado ?? transaction?.total ?? 0;
  const discountAmount =
    transaction && transaction.discount > 0
      ? transaction.subtotal - transaction.total
      : 0;

  const footer = (
    <div className="w-full">
      {isVoided ? (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      ) : (
        <>
          <div className="flex w-full justify-between">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!canVoid}
              onClick={onVoidRequest}
            >
              Anular transacción
            </Button>
          </div>
          {!canVoid && (
            <p className="mt-2 text-right text-xs text-muted-foreground">
              No podés anular: la caja de este barbero está cerrada.
            </p>
          )}
        </>
      )}
    </div>
  );

  return (
    <DrawerForm
      open={open}
      onOpenChange={onOpenChange}
      title="Detalle de transacción"
      size="md"
      footer={footer}
    >
      {/* min-h-full + flex col permite que el total se ancle al fondo con mt-auto */}
      <div className="flex min-h-full flex-col">
        {transaction && (
          <>
            <div className="space-y-4">
              {/* Estado + barbero + fecha */}
              <div className="space-y-3">
                {isVoided && <StatusPill status="error" label="Anulado" />}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>{transaction.barberName ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {format(
                        new Date(transaction.createdAt),
                        "d 'de' MMMM yyyy · HH:mm 'hs'",
                        { locale: es },
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Servicio */}
              {transaction.serviceName && (
                <div className="space-y-1.5 border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted-foreground">Servicio</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{transaction.serviceName}</span>
                    <span className="text-sm font-medium text-foreground">
                      ${transaction.servicePrice.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Extras */}
              {transaction.extras.length > 0 && (
                <div className="space-y-1.5 border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted-foreground">Extras</p>
                  <div className="space-y-1.5">
                    {transaction.extras.map((extra) => (
                      <div key={extra.uid} className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{extra.name}</span>
                        <span className="text-sm font-medium text-foreground">
                          ${extra.price.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Productos */}
              {transaction.productos && transaction.productos.length > 0 && (
                <div className="space-y-1.5 border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted-foreground">Productos</p>
                  <div className="space-y-1.5">
                    {transaction.productos.map((p) => (
                      <div key={p.producto_id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm text-foreground">{p.producto_nombre}</span>
                          {p.marca_nombre && (
                            <span className="text-xs text-muted-foreground"> · {p.marca_nombre}</span>
                          )}
                          <span className="text-xs text-muted-foreground"> × {p.cantidad}</span>
                        </div>
                        <span className="shrink-0 text-sm font-medium text-foreground">
                          ${p.subtotal.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Descuento */}
              {transaction.discount > 0 && (
                <div className="space-y-1.5 border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted-foreground">Descuento</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">
                      {transaction.discountType === 'percentage'
                        ? `${transaction.discount}%`
                        : 'Descuento fijo'}
                    </span>
                    {discountAmount > 0 && (
                      <span className="text-sm font-medium text-foreground">
                        −${discountAmount.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Pago */}
              <div className="space-y-1.5 border-t border-border pt-4">
                <p className="text-xs font-semibold text-muted-foreground">Pago</p>
                <div className="space-y-1.5">
                  {txPayments.map((p, i) => {
                    const digital = isDigitalMethod(p.method);
                    const base = p.basePago ?? p.amount;
                    return (
                      <Fragment key={i}>
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm ${
                              digital ? 'text-status-info-foreground' : 'text-success'
                            }`}
                          >
                            {getMethodLabel(p.method)}
                          </span>
                          <span
                            className={`text-sm font-medium ${
                              digital ? 'text-status-info-foreground' : 'text-success'
                            }`}
                          >
                            ${base.toLocaleString()}
                          </span>
                        </div>
                        {(p.recargoMonto ?? 0) > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              Recargo ({p.recargoPct}%)
                            </span>
                            <span className="text-xs text-muted-foreground">
                              +${(p.recargoMonto ?? 0).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Anulación */}
              {isVoided && (
                <div className="space-y-1.5 border-t border-destructive/20 pt-4">
                  <p className="text-xs font-semibold text-destructive/70">Anulación</p>
                  <div className="space-y-1.5">
                    {transaction.anuladoPor && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span>Anulado por {transaction.anuladoPor}</span>
                      </div>
                    )}
                    {transaction.anuladoAt && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {format(
                            new Date(transaction.anuladoAt),
                            "d 'de' MMMM yyyy · HH:mm 'hs'",
                            { locale: es },
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Total — anclado al fondo del body scrolleable */}
            <div className="mt-auto border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Total cobrado</span>
                <span
                  className={`text-base font-bold ${
                    isVoided ? 'text-muted-foreground line-through' : 'text-foreground'
                  }`}
                >
                  ${totalCobrado.toLocaleString()}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </DrawerForm>
  );
}
