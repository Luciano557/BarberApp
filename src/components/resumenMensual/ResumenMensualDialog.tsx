import { useCallback, useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowRight, DollarSign, Loader2, Percent, Scissors } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

import { ResumenMetricaCard } from './ResumenMetricaCard';
import { ResumenMetodosCard } from './ResumenMetodosCard';
import {
  calcVarPct,
  calcVarPuntos,
  formatEntero,
  formatMesLargo,
  formatMesNombre,
  formatMoneda,
  formatMonedaCorta,
  formatPorcentaje,
  restarMeses,
  type ResumenMensual,
} from './resumenHelpers';

const TOTAL_TARJETAS = 4;

/** Debajo de esta diferencia absoluta se considera que el valor no se movió. */
const UMBRAL_IGUAL = 0.5;

const decimalFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function narrativaMonto(actual: number, anterior: number | null, mesAnterior: string): string {
  if (anterior === null) return 'Es el primer mes con datos para comparar.';
  const diferencia = actual - anterior;
  if (Math.abs(diferencia) < UMBRAL_IGUAL) return `Cobraste prácticamente lo mismo que en ${mesAnterior}.`;
  const verbo = diferencia > 0 ? 'más' : 'menos';
  return `Cobraste ${formatMoneda(Math.abs(diferencia))} ${verbo} que en ${mesAnterior}.`;
}

function narrativaServicios(actual: number, anterior: number | null, mesAnterior: string): string {
  if (anterior === null) return 'Es el primer mes con datos para comparar.';
  const diferencia = actual - anterior;
  if (diferencia === 0) return `La misma cantidad de servicios que en ${mesAnterior}.`;
  const cantidad = Math.abs(diferencia);
  const verbo = diferencia > 0 ? 'más' : 'menos';
  return `${formatEntero(cantidad)} ${cantidad === 1 ? 'servicio' : 'servicios'} ${verbo} que en ${mesAnterior}.`;
}

function narrativaRentabilidad(actual: number, anterior: number | null, mesAnterior: string): string {
  if (anterior === null) return 'Es el primer mes con datos para comparar.';
  const diferencia = actual - anterior;
  if (Math.abs(diferencia) < 0.05) return `Se mantuvo igual que en ${mesAnterior}.`;
  const verbo = diferencia > 0 ? 'Subió' : 'Bajó';
  const puntos = decimalFormatter.format(Math.abs(diferencia));
  return `${verbo} ${puntos} puntos respecto de ${mesAnterior}.`;
}

interface ResumenMensualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pendientes, del mes más viejo al más nuevo. Se recorren en secuencia. */
  resumenes: ResumenMensual[];
  onMarcarLeido: (resumenId: string) => Promise<void>;
  onPosponerTodos: () => Promise<void>;
  onDescartarTodos: () => Promise<void>;
}

export function ResumenMensualDialog({
  open,
  onOpenChange,
  resumenes,
  onMarcarLeido,
  onPosponerTodos,
  onDescartarTodos,
}: ResumenMensualDialogProps) {
  const [indice, setIndice] = useState(0);
  const [paso, setPaso] = useState(0);
  const [direccion, setDireccion] = useState<'adelante' | 'atras'>('adelante');
  const [enProceso, setEnProceso] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const siguienteRef = useRef<HTMLButtonElement>(null);

  const resumen = resumenes[indice];
  const esUltimaTarjeta = paso === TOTAL_TARJETAS - 1;
  const hayMasResumenes = indice < resumenes.length - 1;

  const irAtras = useCallback(() => {
    setDireccion('atras');
    setPaso(p => Math.max(0, p - 1));
  }, []);

  /** Solo se puede volver a una tarjeta ya vista; la historia no se saltea hacia adelante. */
  const irAPaso = useCallback(
    (destino: number) => {
      if (destino >= paso) return;
      setDireccion('atras');
      setPaso(destino);
    },
    [paso],
  );

  /**
   * Ninguna acción bloquea la salida: si el guardado falla se avisa por toast y
   * se sigue igual — el resumen simplemente volverá a aparecer.
   */
  const ejecutar = useCallback(async (accion: () => Promise<void>, despues: () => void) => {
    setEnProceso(true);
    try {
      await accion();
    } catch {
      toast.error('No pudimos guardar tu preferencia', {
        description: 'Es posible que el resumen vuelva a aparecer la próxima vez.',
      });
    } finally {
      setEnProceso(false);
      despues();
    }
  }, []);

  const avanzarResumen = useCallback(() => {
    if (hayMasResumenes) {
      setDireccion('adelante');
      setIndice(i => i + 1);
      setPaso(0);
      return;
    }
    onOpenChange(false);
  }, [hayMasResumenes, onOpenChange]);

  const handleSiguiente = useCallback(() => {
    if (!esUltimaTarjeta) {
      setDireccion('adelante');
      setPaso(p => p + 1);
      return;
    }
    if (!resumen) return;
    void ejecutar(() => onMarcarLeido(resumen.id), avanzarResumen);
  }, [esUltimaTarjeta, resumen, ejecutar, onMarcarLeido, avanzarResumen]);

  const handleVerMasTarde = useCallback(() => {
    setConfirmarSalida(false);
    void ejecutar(onPosponerTodos, () => onOpenChange(false));
  }, [ejecutar, onPosponerTodos, onOpenChange]);

  const handleDescartar = useCallback(() => {
    setConfirmarSalida(false);
    void ejecutar(onDescartarTodos, () => onOpenChange(false));
  }, [ejecutar, onDescartarTodos, onOpenChange]);

  // Flechas del teclado para recorrer la historia. La flecha derecha nunca
  // dispara "Entendido": esa acción escribe en la base y debe ser deliberada.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && paso > 0) {
        event.preventDefault();
        irAtras();
      }
      if (event.key === 'ArrowRight' && !esUltimaTarjeta) {
        event.preventDefault();
        setDireccion('adelante');
        setPaso(p => p + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, paso, esUltimaTarjeta, irAtras]);

  if (!resumen) return null;

  const mesLargo = formatMesLargo(resumen.mes);
  const mesAnterior = formatMesNombre(restarMeses(resumen.mes, 1));

  const tarjetas = [
    <ResumenMetricaCard
      key="facturacion"
      icono={DollarSign}
      titulo="Facturación"
      descripcion={`Cuánto dinero entró en ${formatMesNombre(resumen.mes)}.`}
      valorNumerico={resumen.facturacion.actual}
      formatValor={formatMoneda}
      variacion={calcVarPct(resumen.facturacion.actual, resumen.facturacion.mesAnterior)}
      serie={resumen.facturacion}
      mes={resumen.mes}
      color="hsl(var(--chart-cash))"
      colorSuave="hsl(var(--chart-cash) / 0.12)"
      formatEtiqueta={formatMonedaCorta}
      narrativa={narrativaMonto(resumen.facturacion.actual, resumen.facturacion.mesAnterior, mesAnterior)}
    />,
    <ResumenMetricaCard
      key="servicios"
      icono={Scissors}
      titulo="Servicios"
      descripcion={`Servicios realizados en ${formatMesNombre(resumen.mes)}.`}
      valorNumerico={resumen.servicios.actual}
      formatValor={formatEntero}
      variacion={calcVarPct(resumen.servicios.actual, resumen.servicios.mesAnterior)}
      serie={resumen.servicios}
      mes={resumen.mes}
      color="hsl(var(--primary))"
      colorSuave="hsl(var(--primary) / 0.1)"
      formatEtiqueta={formatEntero}
      narrativa={narrativaServicios(resumen.servicios.actual, resumen.servicios.mesAnterior, mesAnterior)}
    />,
    <ResumenMetricaCard
      key="rentabilidad"
      icono={Percent}
      titulo="Rentabilidad"
      descripcion="Porcentaje de lo facturado que quedó como ganancia."
      valorNumerico={resumen.rentabilidad.actual}
      formatValor={formatPorcentaje}
      variacion={calcVarPuntos(resumen.rentabilidad.actual, resumen.rentabilidad.mesAnterior)}
      unidadVariacion="pts"
      serie={resumen.rentabilidad}
      mes={resumen.mes}
      color="hsl(var(--chart-purple))"
      colorSuave="hsl(var(--chart-purple) / 0.12)"
      formatEtiqueta={v => `${Math.round(v)}%`}
      narrativa={narrativaRentabilidad(
        resumen.rentabilidad.actual,
        resumen.rentabilidad.mesAnterior,
        mesAnterior,
      )}
    />,
    <ResumenMetodosCard key="metodos" metodos={resumen.metodos} mesLabel={formatMesNombre(resumen.mes)} />,
  ];

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={next => {
          // Escape o clic afuera se leen como "ver más tarde": nunca descartan.
          if (!next && !enProceso) handleVerMasTarde();
        }}
      >
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            className="resumen-sheet flex flex-col overflow-clip border bg-card shadow-lg"
            onOpenAutoFocus={event => {
              event.preventDefault();
              siguienteRef.current?.focus();
            }}
          >
            <div className="shrink-0 px-5 pb-4 pt-5 sm:px-6">
              <div role="group" aria-label="Progreso del resumen" className="flex gap-1.5">
                {Array.from({ length: TOTAL_TARJETAS }, (_, i) => {
                  const visitada = i <= paso;
                  const puedeVolver = i < paso;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!puedeVolver}
                      onClick={() => irAPaso(i)}
                      aria-label={`Tarjeta ${i + 1} de ${TOTAL_TARJETAS}`}
                      aria-current={i === paso ? 'step' : undefined}
                      className="-my-3 flex flex-1 items-center py-3 focus-visible:outline-none disabled:cursor-default"
                    >
                      <span
                        className={cn(
                          'h-1 w-full rounded-full transition-colors duration-200',
                          visitada ? 'bg-primary' : 'bg-border',
                        )}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DialogPrimitive.Title className="text-base font-semibold text-foreground">
                    Resumen de {mesLargo}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="truncate text-sm text-muted-foreground">
                    {resumen.sucursalNombre}
                  </DialogPrimitive.Description>
                </div>
                {resumenes.length > 1 && (
                  <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                    Sucursal {indice + 1} de {resumenes.length}
                  </span>
                )}
              </div>
            </div>

            {/* aria-live vive en el contenedor estable: si estuviera en el div con `key`,
                el lector de pantalla no anunciaría el cambio porque la región se reemplaza. */}
            <div
              aria-live="polite"
              className="min-h-0 flex-1 overflow-y-auto border-t px-5 py-6 sm:px-6"
            >
              <div
                key={`${resumen.id}-${paso}`}
                className={direccion === 'adelante' ? 'animate-step-in-forward' : 'animate-step-in-back'}
              >
                {tarjetas[paso]}
              </div>
            </div>

            <div className="shrink-0 border-t px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={handleVerMasTarde} disabled={enProceso}>
                  Ver más tarde
                </Button>
                <Button ref={siguienteRef} onClick={handleSiguiente} disabled={enProceso}>
                  {enProceso && <Loader2 className="animate-spin" />}
                  {esUltimaTarjeta ? 'Entendido' : 'Siguiente'}
                  {!esUltimaTarjeta && <ArrowRight />}
                </Button>
              </div>

              {paso === 0 && (
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={() => setConfirmarSalida(true)}
                    disabled={enProceso}
                    className="rounded-sm text-xs text-muted-foreground underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    Salir sin ver el resumen
                  </button>
                </div>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      <AlertDialog open={confirmarSalida} onOpenChange={setConfirmarSalida}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir sin ver el resumen?</AlertDialogTitle>
            <AlertDialogDescription>
              Podés verlo la próxima vez que entres. Si elegís no mostrarlo más, no vamos a volver a
              ofrecerte este resumen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleVerMasTarde}>Ver más tarde</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDescartar}
            >
              Sí, no mostrar más
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
