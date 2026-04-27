import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle2, Trash2, Users2 } from 'lucide-react';
import {
  PreviewRow, validateRow, detectInternalDuplicates, HEADER_LABELS,
} from './lib/parseImportFile';
import { MergeDuplicatesDialog } from './MergeDuplicatesDialog';

interface Props {
  rows: PreviewRow[];
  onChange: (rows: PreviewRow[]) => void;
  unknownHeaders: string[];
  truncated: boolean;
  totalParsed: number;
}

type RowStatus = 'listo' | 'error' | 'duplicado';

function getStatus(r: PreviewRow): RowStatus {
  if (r.errors.length > 0) return 'error';
  if (r.duplicateGroupId) return 'duplicado';
  return 'listo';
}

export function ImportPreviewStep({ rows, onChange, unknownHeaders, truncated, totalParsed }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resolveGroupId, setResolveGroupId] = useState<string | null>(null);

  // Run duplicate detection whenever rows change content
  useEffect(() => {
    const next = rows.map(r => ({ ...r }));
    detectInternalDuplicates(next);
    // Only commit if duplicateGroupId actually changed
    let changed = false;
    for (let i = 0; i < next.length; i++) {
      if (next[i].duplicateGroupId !== rows[i].duplicateGroupId) { changed = true; break; }
    }
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map(r => `${r.rowId}:${r.phoneKey}:${r.emailKey}:${r.discarded}`).join('|')]);

  const counts = useMemo(() => {
    const active = rows.filter(r => !r.discarded);
    return {
      total: rows.length,
      activos: active.length,
      listos: active.filter(r => getStatus(r) === 'listo').length,
      errores: active.filter(r => getStatus(r) === 'error').length,
      duplicados: active.filter(r => getStatus(r) === 'duplicado').length,
      descartados: rows.filter(r => r.discarded).length,
    };
  }, [rows]);

  const updateRow = (rowId: string, patch: Partial<PreviewRow>) => {
    const next = rows.map(r => {
      if (r.rowId !== rowId) return r;
      const merged = { ...r, ...patch };
      validateRow(merged);
      return merged;
    });
    onChange(next);
  };

  const discardRow = (rowId: string) => {
    const next = rows.map(r => r.rowId === rowId ? { ...r, discarded: true, duplicateGroupId: null } : r);
    onChange(next);
  };

  const restoreRow = (rowId: string) => {
    const next = rows.map(r => r.rowId === rowId ? { ...r, discarded: false } : r);
    onChange(next);
  };

  const groupRows = useMemo(() => {
    if (!resolveGroupId) return [];
    return rows.filter(r => r.duplicateGroupId === resolveGroupId && !r.discarded);
  }, [rows, resolveGroupId]);

  const handleResolveMerge = (merged: PreviewRow, discardedIds: string[]) => {
    const next = rows.map(r => {
      if (r.rowId === merged.rowId) {
        const updated = { ...merged };
        validateRow(updated);
        return updated;
      }
      if (discardedIds.includes(r.rowId)) {
        return { ...r, discarded: true, duplicateGroupId: null };
      }
      return r;
    });
    onChange(next);
    setResolveGroupId(null);
  };

  const handleDiscardGroup = () => {
    if (!resolveGroupId) return;
    const next = rows.map(r =>
      r.duplicateGroupId === resolveGroupId
        ? { ...r, discarded: true, duplicateGroupId: null }
        : r
    );
    onChange(next);
    setResolveGroupId(null);
  };

  return (
    <div className="space-y-4">
      {(unknownHeaders.length > 0 || truncated) && (
        <Card className="p-3 bg-muted/40 border-muted">
          {unknownHeaders.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Se ignoraron columnas no reconocidas: {unknownHeaders.slice(0, 6).join(', ')}
              {unknownHeaders.length > 6 ? '…' : ''}
            </p>
          )}
          {truncated && (
            <p className="text-xs text-muted-foreground mt-1">
              El archivo tiene {totalParsed} filas. Solo se procesan las primeras 2.000.
            </p>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Activas" value={counts.activos} />
        <Stat label="Listas" value={counts.listos} tone="success" />
        <Stat label="Con errores" value={counts.errores} tone={counts.errores > 0 ? 'warn' : undefined} />
        <Stat label="Duplicados" value={counts.duplicados} tone={counts.duplicados > 0 ? 'warn' : undefined} />
      </div>

      <ScrollArea className="h-[420px] rounded-md border">
        <div className="divide-y">
          {rows.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No hay filas para mostrar.
            </div>
          )}
          {rows.map((r) => {
            const status = getStatus(r);
            const isEditing = editingId === r.rowId;
            return (
              <div
                key={r.rowId}
                className={`px-3 py-2.5 ${r.discarded ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <RowEditor row={r} onChange={(patch) => updateRow(r.rowId, patch)} />
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-medium truncate">
                          {r.nombre || <span className="italic text-muted-foreground">Sin nombre</span>}{' '}
                          {r.apellido}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[r.telefono, r.email].filter(Boolean).join(' · ') || (
                            <span className="italic">Sin contacto</span>
                          )}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {r.discarded ? (
                        <Badge variant="outline" className="text-[10px]">Descartada</Badge>
                      ) : status === 'listo' ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-500">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Listo
                        </Badge>
                      ) : status === 'error' ? (
                        <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Error
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-500">
                          <Users2 className="h-3 w-3 mr-1" /> Posible duplicado
                        </Badge>
                      )}
                      {r.errors.map((e, i) => (
                        <span key={i} className="text-[10px] text-destructive">{e}</span>
                      ))}
                      {r.warnings.map((w, i) => (
                        <span key={i} className="text-[10px] text-muted-foreground">{w}</span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {!r.discarded && status === 'duplicado' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setResolveGroupId(r.duplicateGroupId)}
                      >
                        Resolver
                      </Button>
                    )}
                    {!r.discarded && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setEditingId(isEditing ? null : r.rowId)}
                      >
                        {isEditing ? 'Listo' : 'Editar'}
                      </Button>
                    )}
                    {r.discarded ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => restoreRow(r.rowId)}
                      >
                        Restaurar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => discardRow(r.rowId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <MergeDuplicatesDialog
        open={resolveGroupId !== null}
        onOpenChange={(o) => { if (!o) setResolveGroupId(null); }}
        group={groupRows}
        onResolve={handleResolveMerge}
        onCancelGroup={handleDiscardGroup}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warn' }) {
  const color =
    tone === 'success' ? 'text-emerald-600 dark:text-emerald-500'
    : tone === 'warn' ? 'text-amber-600 dark:text-amber-500'
    : 'text-foreground';
  return (
    <Card className="p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </Card>
  );
}

function RowEditor({ row, onChange }: { row: PreviewRow; onChange: (patch: Partial<PreviewRow>) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <Field label={HEADER_LABELS.nombre} value={row.nombre} maxLength={80}
        onChange={(v) => onChange({ nombre: v })} />
      <Field label={HEADER_LABELS.apellido} value={row.apellido} maxLength={80}
        onChange={(v) => onChange({ apellido: v })} />
      <Field label={HEADER_LABELS.telefono} value={row.telefono} maxLength={40}
        onChange={(v) => onChange({ telefono: v })} />
      <Field label={HEADER_LABELS.email} value={row.email} maxLength={120}
        onChange={(v) => onChange({ email: v })} />
      <Field label={`${HEADER_LABELS.fecha_nacimiento} (YYYY-MM-DD)`} value={row.fecha_nacimiento} maxLength={10}
        onChange={(v) => onChange({ fecha_nacimiento: v })} />
      <Field label={`${HEADER_LABELS.fecha_cliente_desde} (YYYY-MM-DD)`} value={row.fecha_cliente_desde} maxLength={10}
        onChange={(v) => onChange({ fecha_cliente_desde: v })} />
    </div>
  );
}

function Field({
  label, value, onChange, maxLength,
}: { label: string; value: string; onChange: (v: string) => void; maxLength: number }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      <Input
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm"
      />
    </label>
  );
}
