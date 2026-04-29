import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle2, Trash2, Users2, Search, Sparkles } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  PreviewRow, validateRow, detectInternalDuplicates, HEADER_LABELS,
} from './lib/parseImportFile';
import { MergeDuplicatesDialog } from './MergeDuplicatesDialog';
import { DuplicatesGroupView } from './DuplicatesGroupView';

export type PreviewFilter = 'all' | 'ready' | 'errors' | 'duplicates' | 'discarded';

interface Props {
  rows: PreviewRow[];
  onChange: (rows: PreviewRow[]) => void;
  unknownHeaders: string[];
  truncated: boolean;
  totalParsed: number;
  filter: PreviewFilter;
  onFilterChange: (f: PreviewFilter) => void;
}

type RowStatus = 'listo' | 'error' | 'duplicado' | 'corregido';

function getStatus(r: PreviewRow): RowStatus {
  if (r.errors.length > 0) return 'error';
  if (r.duplicateGroupId) return 'duplicado';
  if (r.wasErrored) return 'corregido';
  return 'listo';
}

export function ImportPreviewStep({
  rows, onChange, unknownHeaders, truncated, totalParsed, filter, onFilterChange,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resolveGroupId, setResolveGroupId] = useState<string | null>(null);
  const [confirmDiscardErrors, setConfirmDiscardErrors] = useState(false);
  const [query, setQuery] = useState('');

  // Run duplicate detection whenever rows content changes
  useEffect(() => {
    const next = rows.map(r => ({ ...r }));
    detectInternalDuplicates(next);
    let changed = false;
    for (let i = 0; i < next.length; i++) {
      if (next[i].duplicateGroupId !== rows[i].duplicateGroupId) { changed = true; break; }
    }
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map(r => `${r.rowId}:${r.phoneKey}:${r.emailKey}:${r.discarded}:${r.keepSeparate ? 1 : 0}`).join('|')]);

  const counts = useMemo(() => {
    const active = rows.filter(r => !r.discarded);
    return {
      total: rows.length,
      activos: active.length,
      listos: active.filter(r => getStatus(r) === 'listo' || getStatus(r) === 'corregido').length,
      errores: active.filter(r => r.errors.length > 0).length,
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

  const handleDiscardAllErrors = () => {
    const next = rows.map(r =>
      !r.discarded && r.errors.length > 0
        ? { ...r, discarded: true, duplicateGroupId: null }
        : r
    );
    onChange(next);
    setConfirmDiscardErrors(false);
  };

  const handleKeepWithContact = () => {
    const next = rows.map(r => {
      if (r.discarded || r.errors.length === 0) return r;
      const hasName = r.nombre.trim().length > 0;
      const hasContact = r.telefono.trim().length > 0 || r.email.trim().length > 0;
      if (!hasName || !hasContact) return r;
      const merged = { ...r };
      validateRow(merged);
      // wasErrored is sticky and stays true; errors should be empty now.
      return merged;
    });
    onChange(next);
  };

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      // base filter
      let pass = false;
      if (filter === 'all') pass = true;
      else if (filter === 'discarded') pass = r.discarded;
      else if (r.discarded) pass = false;
      else if (filter === 'errors') {
        // sticky: include rows that had errors at any point in the session
        pass = r.errors.length > 0 || r.wasErrored === true;
      } else if (filter === 'ready') {
        pass = r.errors.length === 0 && !r.duplicateGroupId;
      } else if (filter === 'duplicates') {
        pass = !!r.duplicateGroupId;
      } else {
        pass = true;
      }
      if (!pass) return false;
      if (!q) return true;
      const hay = [r.nombre, r.apellido, r.telefono, r.email]
        .filter(Boolean)
        .some(v => v.toLowerCase().includes(q));
      return hay;
    });
  }, [rows, filter, query]);

  const groupRows = useMemo(() => {
    if (!resolveGroupId) return [];
    return rows.filter(r => r.duplicateGroupId === resolveGroupId && !r.discarded);
  }, [rows, resolveGroupId]);

  const handleResolveMerge = (merged: PreviewRow, discardedIds: string[]) => {
    const next = rows.map(r => {
      if (r.rowId === merged.rowId) {
        const updated = { ...merged, keepSeparate: true };
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

  const handleKeepSeparateGroup = () => {
    if (!resolveGroupId) return;
    const next = rows.map(r =>
      r.duplicateGroupId === resolveGroupId
        ? { ...r, keepSeparate: true, duplicateGroupId: null }
        : r
    );
    onChange(next);
    setResolveGroupId(null);
  };

  const chips: Array<{ id: PreviewFilter; label: string; count: number }> = [
    { id: 'all', label: 'Todas', count: counts.total },
    { id: 'ready', label: 'Listas', count: counts.listos },
    { id: 'errors', label: 'Con errores', count: counts.errores },
    { id: 'duplicates', label: 'Duplicados', count: counts.duplicados },
    { id: 'discarded', label: 'Descartadas', count: counts.descartados },
  ];

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

      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map(c => (
          <Button
            key={c.id}
            size="sm"
            variant={filter === c.id ? 'default' : 'outline'}
            className="h-8 text-xs"
            onClick={() => onFilterChange(c.id)}
          >
            {c.label}
            <span className={`ml-1.5 text-[10px] ${filter === c.id ? 'opacity-80' : 'text-muted-foreground'}`}>
              {c.count}
            </span>
          </Button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, teléfono o email…"
            maxLength={80}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {counts.errores > 0 && (
        <Card className="p-3 bg-muted/40 border-muted flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground flex-1 min-w-[180px]">
            {counts.errores} {counts.errores === 1 ? 'fila con error' : 'filas con errores'}.
          </p>
          <Button size="sm" variant="outline" onClick={() => onFilterChange('errors')}>
            Ver errores
          </Button>
          <Button size="sm" variant="outline" onClick={handleKeepWithContact}>
            <Sparkles className="h-3.5 w-3.5" />
            Conservar con contacto
          </Button>
          <Button
            size="sm" variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmDiscardErrors(true)}
          >
            Descartar errores
          </Button>
        </Card>
      )}

      {filter === 'duplicates' ? (
        <div className="h-[420px] overflow-y-auto rounded-md border p-2">
          <DuplicatesGroupView
            rows={rows}
            onChange={onChange}
            onOpenCompare={(groupId) => setResolveGroupId(groupId)}
            query={query}
          />
        </div>
      ) : (
        <ScrollArea className="h-[420px] rounded-md border">
          <div className="divide-y">
            {filteredRows.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No hay filas para este filtro.
              </div>
            )}
            {filteredRows.map((r) => {
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
                            {r.nombre
                              ? [r.nombre, r.apellido].filter(Boolean).join(' ')
                              : <span className="italic text-muted-foreground">Sin nombre</span>}
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
                        ) : status === 'corregido' ? (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Corregido
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
      )}

      <MergeDuplicatesDialog
        open={resolveGroupId !== null}
        onOpenChange={(o) => { if (!o) setResolveGroupId(null); }}
        group={groupRows}
        onResolve={handleResolveMerge}
        onCancelGroup={handleDiscardGroup}
        onKeepSeparate={handleKeepSeparateGroup}
      />

      <AlertDialog open={confirmDiscardErrors} onOpenChange={setConfirmDiscardErrors}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar errores</AlertDialogTitle>
            <AlertDialogDescription>
              Se descartarán {counts.errores} {counts.errores === 1 ? 'fila con error' : 'filas con errores'}. No se importarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardAllErrors}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
