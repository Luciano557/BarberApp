import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coverUrl: string | null;
  logoUrl: string | null;
  orgName: string;
  initialX: number;
  initialY: number;
  saving?: boolean;
  onSave: (x: number, y: number) => Promise<void> | void;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function PortalCoverPositionDialog({
  open, onOpenChange, coverUrl, logoUrl, orgName,
  initialX, initialY, saving, onSave,
}: Props) {
  const [x, setX] = useState(initialX);
  const [y, setY] = useState(initialY);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startPx: number; startPy: number;
    startX: number; startY: number;
    overflowX: number; overflowY: number;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setX(initialX);
      setY(initialY);
    }
  }, [open, initialX, initialY]);

  // Reset image size when cover changes
  useEffect(() => {
    setImgSize(null);
  }, [coverUrl]);

  // Measure canvas
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
  }, [open, coverUrl]);

  const initials = orgName
    .split(' ').filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase()).join('') || 'V';

  // Canvas + frame geometry
  const canvasW = canvasSize.w;
  const canvasH = canvasSize.h;
  const frameW = canvasW > 0 && canvasH > 0
    ? Math.round(Math.min(canvasW * 0.85, Math.max(0, canvasH - 24) * 16 / 9))
    : 0;
  const frameH = Math.round(frameW * 9 / 16);
  const frameLeft = Math.round((canvasW - frameW) / 2);
  const frameTop = Math.round((canvasH - frameH) / 2);
  const frameMeasured = frameW > 0 && frameH > 0;
  const frameStyle = frameMeasured
    ? { left: frameLeft, top: frameTop, width: frameW, height: frameH }
    : { left: '7.5%', top: '50%', width: '85%', aspectRatio: '16 / 9', transform: 'translateY(-50%)' };

  // Compute overflow (px) inside the frame in cover mode
  let overflowX = 0;
  let overflowY = 0;
  if (imgSize && frameW > 0 && frameH > 0) {
    const scale = Math.max(frameW / imgSize.w, frameH / imgSize.h);
    overflowX = Math.max(0, imgSize.w * scale - frameW);
    overflowY = Math.max(0, imgSize.h * scale - frameH);
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!coverUrl || !imgSize) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (e.cancelable) e.preventDefault();
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* noop */ }
    setIsDragging(true);
    dragRef.current = {
      pointerId: e.pointerId,
      startPx: e.clientX,
      startPy: e.clientY,
      startX: x,
      startY: y,
      overflowX,
      overflowY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (e.cancelable) e.preventDefault();
    const dx = e.clientX - d.startPx;
    const dy = e.clientY - d.startPy;
    let nx = d.startX;
    let ny = d.startY;
    if (d.overflowX > 0) nx = clamp(d.startX - (dx / d.overflowX) * 100);
    if (d.overflowY > 0) ny = clamp(d.startY - (dy / d.overflowY) * 100);
    setX(nx);
    setY(ny);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d && d.pointerId !== e.pointerId) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
    dragRef.current = null;
    setIsDragging(false);
  };

  const handleSave = async () => {
    await onSave(Math.round(x), Math.round(y));
    onOpenChange(false);
  };

  const dragEnabled = !!coverUrl && !!imgSize;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar encuadre de la portada</DialogTitle>
          <DialogDescription>
            Arrastrá la imagen dentro del marco para elegir qué parte se muestra en el portal.
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
              {/* Background context: same image, dimmed, fills canvas */}
              <img
                src={coverUrl}
                alt=""
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
                }}
                className="absolute inset-0 h-full w-full object-cover opacity-40 pointer-events-none"
                style={{ objectPosition: `${x}% ${y}%` }}
                draggable={false}
              />

              {/* Dark overlays around the frame (4 divs) */}
              <div
                className="absolute left-0 right-0 top-0 bg-foreground/50 pointer-events-none"
                style={{ height: frameMeasured ? Math.max(0, frameTop) : '12%' }}
              />
              <div
                className="absolute left-0 right-0 bottom-0 bg-foreground/50 pointer-events-none"
                style={{ height: frameMeasured ? Math.max(0, canvasH - frameTop - frameH) : '12%' }}
              />
              <div
                className="absolute left-0 bg-foreground/50 pointer-events-none"
                style={{ top: frameMeasured ? frameTop : '12%', height: frameMeasured ? frameH : '76%', width: frameMeasured ? Math.max(0, frameLeft) : '7.5%' }}
              />
              <div
                className="absolute right-0 bg-foreground/50 pointer-events-none"
                style={{ top: frameMeasured ? frameTop : '12%', height: frameMeasured ? frameH : '76%', width: frameMeasured ? Math.max(0, frameLeft) : '7.5%' }}
              />

              {/* Frame: real preview of what will render in portal */}
              <div
                className="absolute overflow-hidden ring-2 ring-card shadow-lg pointer-events-none"
                style={frameStyle}
              >
                  {/* z-0 image cover */}
                  <img
                    src={coverUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ objectPosition: `${x}% ${y}%` }}
                    draggable={false}
                  />
                  {/* z-10 gradient */}
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-b from-transparent to-card" />
                  {/* z-20 avatar */}
                  <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2">
                    <div className="h-14 w-14 rounded-full bg-card overflow-hidden flex items-center justify-center ring-4 ring-card shadow-md">
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

        {/* Sliders — ajuste fino */}
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Posición horizontal</Label>
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
              <Label className="text-xs">Posición vertical</Label>
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

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !coverUrl}>
            {saving ? 'Guardando...' : 'Guardar encuadre'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
