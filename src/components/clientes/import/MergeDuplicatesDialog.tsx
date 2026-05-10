import { useMemo, useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PreviewRow, HEADER_LABELS } from './lib/parseImportFile';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: PreviewRow[];
  onResolve: (mergedRow: PreviewRow, discardedRowIds: string[]) => void;
  onCancelGroup: () => void;
  onKeepSeparate?: () => void;
}

const FIELDS: Array<keyof PreviewRow> = [
  'nombre', 'apellido', 'telefono', 'email',
  'fecha_nacimiento', 'fecha_cliente_desde',
  'instagram', 'tiktok', 'otra_red_social',
  'alergias', 'nota_interna',
];

export function MergeDuplicatesDialog({ open, onOpenChange, group, onResolve, onCancelGroup, onKeepSeparate }: Props) {
  // For each field: which rowId provides the value (or '__empty')
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [marketing, setMarketing] = useState<boolean>(true);

  useEffect(() => {
    if (!open || group.length === 0) return;
    const init: Record<string, string> = {};
    for (const f of FIELDS) {
      // pick first non-empty
      const winner = group.find(r => String((r as any)[f] ?? '').trim() !== '');
      init[f as string] = winner ? winner.rowId : group[0].rowId;
    }
    setChoices(init);
    setMarketing(group.some(r => r.acepta_marketing));
  }, [open, group]);

  const conflicts = useMemo(() => {
    const map: Record<string, Array<{ rowId: string; value: string }>> = {};
    for (const f of FIELDS) {
      const seen = new Map<string, string>(); // value -> rowId
      const opts: Array<{ rowId: string; value: string }> = [];
      for (const r of group) {
        const v = String((r as any)[f] ?? '').trim();
        if (!v) continue;
        if (!seen.has(v)) {
          seen.set(v, r.rowId);
          opts.push({ rowId: r.rowId, value: v });
        }
      }
      map[f as string] = opts;
    }
    return map;
  }, [group]);

  const handleConfirm = () => {
    if (group.length === 0) return;
    const base: PreviewRow = { ...group[0] };
    for (const f of FIELDS) {
      const opts = conflicts[f as string];
      if (opts.length === 0) {
        (base as any)[f] = '';
        continue;
      }
      const chosenRowId = choices[f as string];
      const chosen = opts.find(o => o.rowId === chosenRowId) ?? opts[0];
      (base as any)[f] = chosen.value;
    }
    base.acepta_marketing = marketing;
    base.duplicateGroupId = null;
    base.discarded = false;
    base.errors = [];
    base.warnings = [];
    const discardedIds = group.filter(r => r.rowId !== base.rowId).map(r => r.rowId);
    onResolve(base, discardedIds);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resolver duplicado interno</DialogTitle>
          <DialogDescription>
            Encontramos {group.length} filas que parecen ser el mismo cliente.
            Elegí qué valor conservar para cada campo. Las otras filas se descartan.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-5">
            {FIELDS.map((f) => {
              const opts = conflicts[f as string];
              if (opts.length <= 1) {
                return (
                  <div key={f as string} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {HEADER_LABELS[f as string] ?? (f as string)}
                    </Label>
                    <p className="text-sm">
                      {opts[0]?.value || <span className="italic text-muted-foreground">Sin dato</span>}
                    </p>
                  </div>
                );
              }
              return (
                <div key={f as string} className="space-y-2">
                  <Label className="text-xs font-medium">
                    {HEADER_LABELS[f as string] ?? (f as string)}
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-500">
                      Conflicto
                    </span>
                  </Label>
                  <RadioGroup
                    value={choices[f as string] ?? opts[0].rowId}
                    onValueChange={(v) => setChoices(prev => ({ ...prev, [f as string]: v }))}
                    className="space-y-1.5"
                  >
                    {opts.map(o => (
                      <div key={o.rowId} className="flex items-start gap-2">
                        <RadioGroupItem value={o.rowId} id={`${f as string}-${o.rowId}`} className="mt-0.5" />
                        <Label htmlFor={`${f as string}-${o.rowId}`} className="text-sm font-normal cursor-pointer">
                          {o.value}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              );
            })}

            <div className="space-y-2">
              <Label className="text-xs font-medium">{HEADER_LABELS['acepta_marketing']}</Label>
              <RadioGroup
                value={marketing ? 'si' : 'no'}
                onValueChange={(v) => setMarketing(v === 'si')}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="si" id="mk-si" />
                  <Label htmlFor="mk-si" className="text-sm font-normal cursor-pointer">Sí</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="mk-no" />
                  <Label htmlFor="mk-no" className="text-sm font-normal cursor-pointer">No</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="ghost" onClick={onCancelGroup}>
            Descartar todas
          </Button>
          {onKeepSeparate && (
            <Button variant="outline" onClick={onKeepSeparate}>
              Mantener separados
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm}>Fusionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
