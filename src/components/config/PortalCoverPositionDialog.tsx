import { useEffect, useState } from 'react';
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

export function PortalCoverPositionDialog({
  open, onOpenChange, coverUrl, logoUrl, orgName,
  initialX, initialY, saving, onSave,
}: Props) {
  const [x, setX] = useState(initialX);
  const [y, setY] = useState(initialY);

  useEffect(() => {
    if (open) {
      setX(initialX);
      setY(initialY);
    }
  }, [open, initialX, initialY]);

  const initials = orgName
    .split(' ').filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase()).join('') || 'V';

  const handleSave = async () => {
    await onSave(x, y);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar encuadre de la portada</DialogTitle>
          <DialogDescription>
            Movés la imagen para elegir qué parte se muestra en el portal público.
          </DialogDescription>
        </DialogHeader>

        {/* Preview frame 16:9 */}
        <div className="relative w-full aspect-[16/9] overflow-hidden rounded-xl border border-border bg-muted/30">
          {coverUrl ? (
            <>
              <div
                className="absolute inset-0 z-0 bg-cover"
                style={{
                  backgroundImage: `url(${coverUrl})`,
                  backgroundPosition: `${x}% ${y}%`,
                }}
              />
              <div className="absolute inset-x-0 bottom-0 z-10 h-2/3 bg-gradient-to-b from-transparent to-card" />
              <div className="absolute left-1/2 bottom-0 z-20 -translate-x-1/2 translate-y-1/2">
                <div className="h-16 w-16 rounded-full bg-card overflow-hidden flex items-center justify-center ring-4 ring-card shadow-md">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-muted flex items-center justify-center">
                      <span className="text-xl font-semibold text-muted-foreground">{initials}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Sin portada
            </div>
          )}
        </div>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Posición horizontal</Label>
              <span className="text-xs text-muted-foreground tabular-nums">{x}%</span>
            </div>
            <Slider value={[x]} min={0} max={100} step={1} onValueChange={(v) => setX(v[0])} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Posición vertical</Label>
              <span className="text-xs text-muted-foreground tabular-nums">{y}%</span>
            </div>
            <Slider value={[y]} min={0} max={100} step={1} onValueChange={(v) => setY(v[0])} />
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
