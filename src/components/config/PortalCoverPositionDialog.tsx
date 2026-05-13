import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { RotateCcw } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coverUrl: string | null;
  logoUrl: string | null;
  orgName: string;
  initialX: number;
  initialY: number;
  initialZoom?: number;
  saving?: boolean;
  onSave: (x: number, y: number, zoom: number) => Promise<void> | void;
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const clampPct = (n: number) => clamp(n, 0, 100);
const clampZoom = (n: number) => clamp(n, ZOOM_MIN, ZOOM_MAX);

type Pointer = { id: number; x: number; y: number };

export function PortalCoverPositionDialog({
  open, onOpenChange, coverUrl, logoUrl, orgName,
  initialX, initialY, initialZoom = 1, saving, onSave,
}: Props) {
  const [x, setX] = useState(initialX);
  const [y, setY] = useState(initialY);
  const [zoom, setZoom] = useState(clampZoom(initialZoom));
  const [imgLoaded, setImgLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef<Map<number, Pointer>>(new Map());
  const dragRef = useRef<{ startX: number; startY: number; px: number; py: number; zoom: number } | null>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);

  useEffect(() => {
    if (open) {
      setX(clampPct(initialX));
      setY(clampPct(initialY));
      setZoom(clampZoom(initialZoom));
    }
  }, [open, initialX, initialY, initialZoom]);

  useEffect(() => { setImgLoaded(false); }, [coverUrl]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = canvasRef.current;
    if (!el) return;
    setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setCanvasSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const initials = orgName.split(' ').filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase()).join('') || 'V';

  // Frame 16:9 centered
  const canvasW = canvasSize.w;
  const canvasH = canvasSize.h;
  const frameW = canvasW > 0 && canvasH > 0
    ? Math.round(Math.min(canvasW * 0.9, Math.max(0, canvasH - 24) * 16 / 9))
    : 0;
  const frameH = Math.round(frameW * 9 / 16);
  const frameLeft = Math.round((canvasW - frameW) / 2);
  const frameTop = Math.round((canvasH - frameH) / 2);
  const frameMeasured = frameW > 0 && frameH > 0;
  const frameStyle = frameMeasured
    ? { left: frameLeft, top: frameTop, width: frameW, height: frameH }
    : { left: '5%', top: '50%', width: '90%', aspectRatio: '16 / 9', transform: 'translateY(-50%)' };

  // Pointer helpers
  const pointerDist = () => {
    const pts = Array.from(pointersRef.current.values());
    if (pts.length < 2) return 0;
    const [a, b] = pts;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const dragEnabled = !!coverUrl && imgLoaded;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragEnabled) return;
    if (e.cancelable) e.preventDefault();
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* noop */ }
    pointersRef.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      pinchRef.current = { startDist: pointerDist(), startZoom: zoom };
      dragRef.current = null;
      setIsDragging(false);
    } else if (pointersRef.current.size === 1) {
      dragRef.current = { startX: x, startY: y, px: e.clientX, py: e.clientY, zoom };
      pinchRef.current = null;
      setIsDragging(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    if (e.cancelable) e.preventDefault();
    pointersRef.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const dist = pointerDist();
      if (dist > 0 && pinchRef.current.startDist > 0) {
        const next = clampZoom(pinchRef.current.startZoom * (dist / pinchRef.current.startDist));
        setZoom(next);
      }
      return;
    }

    if (dragRef.current && pointersRef.current.size === 1) {
      const refW = frameW > 0 ? frameW : canvasW;
      const refH = frameH > 0 ? frameH : canvasH;
      if (refW <= 0 || refH <= 0) return;
      const dx = e.clientX - dragRef.current.px;
      const dy = e.clientY - dragRef.current.py;
      const z = Math.max(1, dragRef.current.zoom);
      // Sensibilidad: a más zoom, mover menos
      const dxPct = -(dx / refW) * 100 / z;
      const dyPct = -(dy / refH) * 100 / z;
      setX(clampPct(dragRef.current.startX + dxPct));
      setY(clampPct(dragRef.current.startY + dyPct));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) {
      dragRef.current = null;
      setIsDragging(false);
    } else if (pointersRef.current.size === 1) {
      // Reanudar drag desde el dedo restante
      const remaining = Array.from(pointersRef.current.values())[0];
      dragRef.current = { startX: x, startY: y, px: remaining.x, py: remaining.y, zoom };
    }
  };

  // Wheel zoom (desktop)
  useEffect(() => {
    if (!open) return;
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!dragEnabled) return;
      e.preventDefault();
      setZoom((z) => clampZoom(z + (-e.deltaY) * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [open, dragEnabled]);

  const handleReset = () => {
    setX(50);
    setY(50);
    setZoom(1);
  };

  const handleSave = async () => {
    await onSave(Math.round(x), Math.round(y), Math.round(zoom * 100) / 100);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar encuadre de la portada</DialogTitle>
          <DialogDescription>
            Arrastrá la imagen y usá el zoom para elegir qué parte se muestra en el portal.
          </DialogDescription>
        </DialogHeader>

        {/* Editor */}
        <div
          ref={canvasRef}
          className="relative w-full h-64 sm:h-72 overflow-hidden rounded-xl border border-border bg-muted/30 select-none"
          style={{
            touchAction: 'none',
            cursor: dragEnabled ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {coverUrl ? (
            <>
              {/* Fondo contextual: misma imagen, atenuada */}
              <img
                src={coverUrl}
                alt=""
                onLoad={() => setImgLoaded(true)}
                className="absolute inset-0 h-full w-full object-cover opacity-30 pointer-events-none"
                style={{
                  transform: `translate(${50 - x}%, ${50 - y}%) scale(${zoom})`,
                  transformOrigin: 'center',
                }}
                draggable={false}
              />

              {/* Overlays oscuros fuera del marco */}
              <div className="absolute left-0 right-0 top-0 bg-foreground/55 pointer-events-none"
                style={{ height: frameMeasured ? Math.max(0, frameTop) : '8%' }} />
              <div className="absolute left-0 right-0 bottom-0 bg-foreground/55 pointer-events-none"
                style={{ height: frameMeasured ? Math.max(0, canvasH - frameTop - frameH) : '8%' }} />
              <div className="absolute left-0 bg-foreground/55 pointer-events-none"
                style={{ top: frameMeasured ? frameTop : '8%', height: frameMeasured ? frameH : '84%', width: frameMeasured ? Math.max(0, frameLeft) : '5%' }} />
              <div className="absolute right-0 bg-foreground/55 pointer-events-none"
                style={{ top: frameMeasured ? frameTop : '8%', height: frameMeasured ? frameH : '84%', width: frameMeasured ? Math.max(0, frameLeft) : '5%' }} />

              {/* Marco: preview fiel del portal */}
              <div
                className="absolute overflow-hidden ring-2 ring-card shadow-lg pointer-events-none"
                style={frameStyle}
              >
                <img
                  src={coverUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{
                    objectPosition: `${x}% ${y}%`,
                    transform: `scale(${zoom})`,
                    transformOrigin: `${x}% ${y}%`,
                  }}
                  draggable={false}
                />
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-b from-transparent to-card" />
                <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 z-10">
                  <div className="h-14 w-14 rounded-full bg-card overflow-hidden flex items-center justify-center ring-4 ring-card border border-border/50 shadow-xl">
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                    ) : (
                      <div className="h-full w-full bg-muted flex items-center justify-center">
                        <span className="text-base font-semibold text-muted-foreground">{initials}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Sin portada
            </div>
          )}
        </div>

        {/* Controles */}
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Zoom</Label>
              <span className="text-xs text-muted-foreground tabular-nums">{zoom.toFixed(2)}×</span>
            </div>
            <Slider
              value={[zoom]}
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={0.01}
              onValueChange={(v) => setZoom(clampZoom(v[0]))}
              disabled={!coverUrl}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Horizontal</Label>
                <span className="text-xs text-muted-foreground tabular-nums">{Math.round(x)}%</span>
              </div>
              <Slider
                value={[Math.round(x)]}
                min={0}
                max={100}
                step={1}
                onValueChange={(v) => setX(v[0])}
                disabled={!coverUrl}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Vertical</Label>
                <span className="text-xs text-muted-foreground tabular-nums">{Math.round(y)}%</span>
              </div>
              <Slider
                value={[Math.round(y)]}
                min={0}
                max={100}
                step={1}
                onValueChange={(v) => setY(v[0])}
                disabled={!coverUrl}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving || !coverUrl}>
            <RotateCcw className="h-4 w-4 mr-1" /> Restablecer
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !coverUrl}>
              {saving ? 'Guardando...' : 'Guardar encuadre'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
