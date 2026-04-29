import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Users2, GitMerge, SplitSquareHorizontal, Trash2, Eye } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PreviewRow } from './lib/parseImportFile';
import { mergeGroupByVittroCriteria, pickWinner } from './lib/mergeDuplicates';

interface Props {
  rows: PreviewRow[];
  onChange: (rows: PreviewRow[]) => void;
  onOpenCompare: (groupId: string) => void;
  query?: string;
}

interface Group {
  groupId: string;
  rows: PreviewRow[];
  matchBy: 'telefono' | 'email' | 'ambos';
}

function buildGroups(rows: PreviewRow[]): Group[] {
  const map = new Map<string, PreviewRow[]>();
  for (const r of rows) {
    if (r.discarded || !r.duplicateGroupId) continue;
    const arr = map.get(r.duplicateGroupId) ?? [];
    arr.push(r);
    map.set(r.duplicateGroupId, arr);
  }
  const result: Group[] = [];
  for (const [groupId, gRows] of map.entries()) {
    if (gRows.length < 2) continue;
    const phones = new Set(gRows.map(r => r.phoneKey).filter(Boolean));
    const emails = new Set(gRows.map(r => r.emailKey).filter(Boolean));
    let matchBy: Group['matchBy'] = 'telefono';
    const phoneShared = [...phones].some(p => gRows.filter(r => r.phoneKey === p).length > 1);
    const emailShared = [...emails].some(e => gRows.filter(r => r.emailKey === e).length > 1);
    if (phoneShared && emailShared) matchBy = 'ambos';
    else if (emailShared) matchBy = 'email';
    else matchBy = 'telefono';
    result.push({ groupId, rows: gRows, matchBy });
  }
  return result;
}

type ConfirmKind =
  | { type: 'merge-all'; count: number }
  | { type: 'keep-all'; count: number }
  | { type: 'discard-all'; count: number }
  | { type: 'merge-one'; groupId: string }
  | { type: 'discard-one'; groupId: string; count: number };

export function DuplicatesGroupView({ rows, onChange, onOpenCompare, query }: Props) {
  const allGroups = useMemo(() => buildGroups(rows), [rows]);
  const groups = useMemo(() => {
    const q = (query ?? '').trim().toLowerCase();
    if (!q) return allGroups;
    return allGroups.filter(g =>
      g.rows.some(r =>
        [r.nombre, r.apellido, r.telefono, r.email]
          .filter(Boolean)
          .some(v => v.toLowerCase().includes(q))
      )
    );
  }, [allGroups, query]);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);

  const totalDuplicateRows = useMemo(
    () => groups.reduce((acc, g) => acc + g.rows.length, 0),
    [groups]
  );
  const totalToDiscardIfKeepOne = useMemo(
    () => groups.reduce((acc, g) => acc + Math.max(0, g.rows.length - 1), 0),
    [groups]
  );

  const applyMergeOne = (groupId: string) => {
    const g = groups.find(x => x.groupId === groupId);
    if (!g) return;
    const { merged, discardedIds } = mergeGroupByVittroCriteria(g.rows);
    const next = rows.map(r => {
      if (r.rowId === merged.rowId) return merged;
      if (discardedIds.includes(r.rowId)) return { ...r, discarded: true, duplicateGroupId: null };
      return r;
    });
    onChange(next);
  };

  const applyKeepSeparateOne = (groupId: string) => {
    const g = groups.find(x => x.groupId === groupId);
    if (!g) return;
    const ids = new Set(g.rows.map(r => r.rowId));
    const next = rows.map(r =>
      ids.has(r.rowId) ? { ...r, keepSeparate: true, duplicateGroupId: null } : r
    );
    onChange(next);
  };

  const applyDiscardOne = (groupId: string) => {
    const g = groups.find(x => x.groupId === groupId);
    if (!g) return;
    const ids = new Set(g.rows.map(r => r.rowId));
    const next = rows.map(r =>
      ids.has(r.rowId) ? { ...r, discarded: true, duplicateGroupId: null } : r
    );
    onChange(next);
  };

  const applyMergeAll = () => {
    let next = [...rows];
    for (const g of groups) {
      const groupRows = next.filter(r => g.rows.some(gr => gr.rowId === r.rowId));
      const { merged, discardedIds } = mergeGroupByVittroCriteria(groupRows);
      next = next.map(r => {
        if (r.rowId === merged.rowId) return merged;
        if (discardedIds.includes(r.rowId)) return { ...r, discarded: true, duplicateGroupId: null };
        return r;
      });
    }
    onChange(next);
  };

  const applyKeepSeparateAll = () => {
    const ids = new Set<string>();
    for (const g of groups) for (const r of g.rows) ids.add(r.rowId);
    const next = rows.map(r =>
      ids.has(r.rowId) ? { ...r, keepSeparate: true, duplicateGroupId: null } : r
    );
    onChange(next);
  };

  const applyDiscardAllExceptWinner = () => {
    let next = [...rows];
    for (const g of groups) {
      const winner = pickWinner(g.rows);
      const losers = new Set(g.rows.filter(r => r.rowId !== winner.rowId).map(r => r.rowId));
      next = next.map(r => {
        if (r.rowId === winner.rowId) return { ...r, keepSeparate: true, duplicateGroupId: null };
        if (losers.has(r.rowId)) return { ...r, discarded: true, duplicateGroupId: null };
        return r;
      });
    }
    onChange(next);
  };

  const handleConfirm = () => {
    if (!confirm) return;
    switch (confirm.type) {
      case 'merge-all': applyMergeAll(); break;
      case 'keep-all': applyKeepSeparateAll(); break;
      case 'discard-all': applyDiscardAllExceptWinner(); break;
      case 'merge-one': applyMergeOne(confirm.groupId); break;
      case 'discard-one': applyDiscardOne(confirm.groupId); break;
    }
    setConfirm(null);
  };

  if (groups.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground border rounded-md">
        No hay duplicados pendientes.
      </div>
    );
  }

  const matchLabel = (m: Group['matchBy']) =>
    m === 'ambos' ? 'teléfono y email' : m === 'email' ? 'email' : 'teléfono';

  return (
    <div className="space-y-3">
      <Card className="p-3 flex flex-wrap items-center gap-2 bg-muted/40">
        <p className="text-xs text-muted-foreground flex-1 min-w-[180px]">
          {groups.length} {groups.length === 1 ? 'grupo duplicado' : 'grupos duplicados'} · {totalDuplicateRows} filas
        </p>
        <Button
          size="sm" variant="outline"
          onClick={() => setConfirm({ type: 'merge-all', count: groups.length })}
        >
          <GitMerge className="h-3.5 w-3.5" />
          Fusionar todos
        </Button>
        <Button
          size="sm" variant="outline"
          onClick={() => setConfirm({ type: 'keep-all', count: groups.length })}
        >
          <SplitSquareHorizontal className="h-3.5 w-3.5" />
          Mantener separados
        </Button>
        <Button
          size="sm" variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => setConfirm({ type: 'discard-all', count: totalToDiscardIfKeepOne })}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Descartar
        </Button>
      </Card>

      <div className="space-y-2">
        {groups.map((g, i) => {
          const winner = pickWinner(g.rows);
          const principalName = [winner.nombre, winner.apellido].filter(Boolean).join(' ').trim()
            || winner.email || winner.telefono || 'Sin nombre';
          return (
            <Card key={g.groupId} className="p-3">
              <div className="flex items-start gap-2">
                <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center shrink-0">
                  <Users2 className="h-4 w-4 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {principalName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {g.rows.length} filas · coincide por {matchLabel(g.matchBy)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3">
                <Button size="sm" variant="default" onClick={() => onOpenCompare(g.groupId)}>
                  <Eye className="h-3.5 w-3.5" />
                  Ver comparación
                </Button>
                <Button
                  size="sm" variant="outline"
                  onClick={() => setConfirm({ type: 'merge-one', groupId: g.groupId })}
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  Fusionar con criterios de Vittro
                </Button>
                <Button
                  size="sm" variant="outline"
                  onClick={() => applyKeepSeparateOne(g.groupId)}
                >
                  <SplitSquareHorizontal className="h-3.5 w-3.5" />
                  Mantener separados
                </Button>
                <Button
                  size="sm" variant="ghost"
                  className="text-muted-foreground hover:text-destructive ml-auto"
                  onClick={() => setConfirm({ type: 'discard-one', groupId: g.groupId, count: g.rows.length })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Descartar
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          {confirm?.type === 'merge-all' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Fusionar todos los grupos</AlertDialogTitle>
                <AlertDialogDescription>
                  Se fusionarán {confirm.count} grupos. Se conserva la fila más reciente y se completan campos vacíos con datos disponibles.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </>
          )}
          {confirm?.type === 'keep-all' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Mantener separados todos</AlertDialogTitle>
                <AlertDialogDescription>
                  Se mantendrán separados {confirm.count} grupos. Se importarán como clientes distintos.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </>
          )}
          {confirm?.type === 'discard-all' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Descartar duplicados</AlertDialogTitle>
                <AlertDialogDescription>
                  Se descartarán {confirm.count} clientes duplicados. No se importarán. Se conserva una fila por grupo.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </>
          )}
          {confirm?.type === 'merge-one' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Fusionar este grupo</AlertDialogTitle>
                <AlertDialogDescription>
                  Se conservará la fila más reciente y se completarán campos vacíos con datos disponibles.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </>
          )}
          {confirm?.type === 'discard-one' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Descartar grupo</AlertDialogTitle>
                <AlertDialogDescription>
                  Se descartarán {confirm.count} clientes de este grupo. No se importarán.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
