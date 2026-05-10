import { PreviewRow, validateRow } from './parseImportFile';

const MERGE_FIELDS: Array<keyof PreviewRow> = [
  'nombre', 'apellido', 'telefono', 'email',
  'fecha_nacimiento', 'fecha_cliente_desde',
  'instagram', 'tiktok', 'otra_red_social',
  'alergias', 'nota_interna',
];

function isValidIsoDate(s: string | undefined | null): boolean {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function nonEmptyCount(r: PreviewRow): number {
  let n = 0;
  for (const f of MERGE_FIELDS) {
    const v = (r as any)[f];
    if (typeof v === 'string' ? v.trim() !== '' : v != null) n++;
  }
  return n;
}

/**
 * Picks the "winner" row of a duplicate group using Vittro criteria:
 * 1) Most recent fecha_cliente_desde (YYYY-MM-DD comparable as string)
 * 2) Tie-breaker / no valid date: the row with more non-empty fields
 */
export function pickWinner(group: PreviewRow[]): PreviewRow {
  const active = group.filter(r => !r.discarded);
  if (active.length === 0) return group[0];
  const withDate = active.filter(r => isValidIsoDate(r.fecha_cliente_desde));
  if (withDate.length > 0) {
    const maxDate = withDate.reduce((m, r) =>
      r.fecha_cliente_desde > m ? r.fecha_cliente_desde : m, withDate[0].fecha_cliente_desde);
    const tied = withDate.filter(r => r.fecha_cliente_desde === maxDate);
    if (tied.length === 1) return tied[0];
    return [...tied].sort((a, b) => nonEmptyCount(b) - nonEmptyCount(a))[0];
  }
  return [...active].sort((a, b) => nonEmptyCount(b) - nonEmptyCount(a))[0];
}

/**
 * Merge a duplicate group using Vittro criteria.
 * - Winner row is the base.
 * - Empty fields in the base get filled from other rows in the group (first non-empty).
 * - Conflicts keep the base value.
 * - acepta_marketing = OR of the group.
 * - keepSeparate = true so it doesn't re-trigger duplicate detection.
 */
export function mergeGroupByVittroCriteria(
  group: PreviewRow[]
): { merged: PreviewRow; discardedIds: string[] } {
  const active = group.filter(r => !r.discarded);
  const base = pickWinner(active.length > 0 ? active : group);
  const others = (active.length > 0 ? active : group).filter(r => r.rowId !== base.rowId);

  const merged: PreviewRow = { ...base };

  for (const f of MERGE_FIELDS) {
    const baseVal = (merged as any)[f];
    const isEmpty = typeof baseVal === 'string' ? baseVal.trim() === '' : baseVal == null;
    if (!isEmpty) continue;
    for (const r of others) {
      const v = (r as any)[f];
      const ok = typeof v === 'string' ? v.trim() !== '' : v != null;
      if (ok) { (merged as any)[f] = v; break; }
    }
  }

  merged.acepta_marketing = group.some(r => r.acepta_marketing);
  merged.duplicateGroupId = null;
  merged.discarded = false;
  merged.keepSeparate = true;
  merged.errors = [];
  merged.warnings = [];
  validateRow(merged);

  const discardedIds = others.map(r => r.rowId);
  return { merged, discardedIds };
}
