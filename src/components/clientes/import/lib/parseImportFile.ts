import * as XLSX from 'xlsx';
import {
  normalizeName,
  normalizeText,
  normalizePhone,
  normalizeEmail,
  normalizeDate,
  normalizeBoolean,
  isValidEmail,
} from './normalize';

export interface RawImportRow {
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  fecha_nacimiento: string;
  fecha_cliente_desde: string;
  instagram: string;
  tiktok: string;
  otra_red_social: string;
  alergias: string;
  nota_interna: string;
  acepta_marketing: string;
}

export interface PreviewRow {
  rowId: string;
  // editable normalized fields
  nombre: string;
  apellido: string;
  telefono: string; // display
  email: string;
  fecha_nacimiento: string; // YYYY-MM-DD or ''
  fecha_cliente_desde: string; // YYYY-MM-DD or ''
  instagram: string;
  tiktok: string;
  otra_red_social: string;
  alergias: string;
  nota_interna: string;
  acepta_marketing: boolean;
  // optional metadata (used for Fresha and future external sources)
  bloqueado?: boolean;
  motivo_bloqueo?: string;
  external_source?: string | null;
  external_customer_id?: string | null;
  // computed
  errors: string[];
  warnings: string[];
  // normalized keys (for duplicate detection)
  phoneKey: string | null;
  emailKey: string | null;
  // group of internal duplicates (set after detection)
  duplicateGroupId: string | null;
  // user actions
  discarded: boolean;
  // when true, this row is excluded from internal duplicate detection
  // for the rest of the import session (until a new file is uploaded)
  keepSeparate?: boolean;
  // sticky flag: true once the row had blocking errors at any point in the session.
  // never goes back to false within the same session, so corrected rows remain visible
  // inside the "Con errores" filter as "Corregido".
  wasErrored?: boolean;
}

export const TEMPLATE_HEADERS = [
  'nombre',
  'apellido',
  'telefono',
  'email',
  'fecha_nacimiento',
  'fecha_cliente_desde',
  'instagram',
  'tiktok',
  'otra_red_social',
  'alergias',
  'nota_interna',
  'acepta_marketing',
] as const;

export const HEADER_LABELS: Record<string, string> = {
  nombre: 'Nombre',
  apellido: 'Apellido',
  telefono: 'Teléfono',
  email: 'Email',
  fecha_nacimiento: 'Fecha de nacimiento',
  fecha_cliente_desde: 'Cliente desde',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  otra_red_social: 'Otra red social',
  alergias: 'Alergias',
  nota_interna: 'Nota interna',
  acepta_marketing: 'Acepta marketing',
};

const HEADER_ALIASES: Record<string, string> = {
  nombre: 'nombre',
  nombres: 'nombre',
  name: 'nombre',
  'first name': 'nombre',
  apellido: 'apellido',
  apellidos: 'apellido',
  'last name': 'apellido',
  surname: 'apellido',
  telefono: 'telefono',
  teléfono: 'telefono',
  celular: 'telefono',
  movil: 'telefono',
  móvil: 'telefono',
  phone: 'telefono',
  mobile: 'telefono',
  email: 'email',
  mail: 'email',
  'correo': 'email',
  'correo electronico': 'email',
  'correo electrónico': 'email',
  fecha_nacimiento: 'fecha_nacimiento',
  'fecha nacimiento': 'fecha_nacimiento',
  'fecha de nacimiento': 'fecha_nacimiento',
  cumpleanos: 'fecha_nacimiento',
  cumpleaños: 'fecha_nacimiento',
  birthday: 'fecha_nacimiento',
  fecha_cliente_desde: 'fecha_cliente_desde',
  'cliente desde': 'fecha_cliente_desde',
  'fecha cliente desde': 'fecha_cliente_desde',
  'desde': 'fecha_cliente_desde',
  instagram: 'instagram',
  ig: 'instagram',
  tiktok: 'tiktok',
  otra_red_social: 'otra_red_social',
  'otra red social': 'otra_red_social',
  'red social': 'otra_red_social',
  alergias: 'alergias',
  alergia: 'alergias',
  nota_interna: 'nota_interna',
  'nota interna': 'nota_interna',
  notas: 'nota_interna',
  observaciones: 'nota_interna',
  acepta_marketing: 'acepta_marketing',
  'acepta marketing': 'acepta_marketing',
  marketing: 'acepta_marketing',
};

function normalizeHeader(h: string): string | null {
  const k = String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return HEADER_ALIASES[k] ?? null;
}

export function generateTemplate(): Blob {
  const wb = XLSX.utils.book_new();
  const headers = TEMPLATE_HEADERS.map(h => HEADER_LABELS[h] ?? h);
  const example = [
    'Juan', 'Pérez', '+54 9 11 1234 5678', 'juan@example.com',
    '15/03/1990', '01/06/2024',
    '@juanperez', '', '', 'Ninguna', 'Cliente VIP', 'Sí',
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  // column widths
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

const MAX_ROWS = 2000;

export interface ParseResult {
  rows: PreviewRow[];
  totalParsed: number;
  truncated: boolean;
  unknownHeaders: string[];
}

export async function parseImportFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) {
    return { rows: [], totalParsed: 0, truncated: false, unknownHeaders: [] };
  }
  const ws = wb.Sheets[firstSheet];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: true,
  });

  // Map headers
  const headerMap = new Map<string, string>();
  const unknown: string[] = [];
  if (json.length > 0) {
    for (const h of Object.keys(json[0])) {
      const mapped = normalizeHeader(h);
      if (mapped) headerMap.set(h, mapped);
      else if (String(h).trim()) unknown.push(String(h));
    }
  }

  const truncated = json.length > MAX_ROWS;
  const slice = json.slice(0, MAX_ROWS);

  const rows: PreviewRow[] = slice.map((raw, i) => {
    const get = (field: string): unknown => {
      for (const [origHeader, mapped] of headerMap.entries()) {
        if (mapped === field) return raw[origHeader];
      }
      return '';
    };

    const nombre = normalizeName(get('nombre')) ?? '';
    const apellido = normalizeName(get('apellido')) ?? '';
    const telRaw = String(get('telefono') ?? '').trim();
    const emailRaw = String(get('email') ?? '').trim();
    const phoneKey = normalizePhone(telRaw);
    const emailKey = normalizeEmail(emailRaw);

    const fechaNac = normalizeDate(get('fecha_nacimiento')) ?? '';
    const fechaDesde = normalizeDate(get('fecha_cliente_desde')) ?? '';

    const row: PreviewRow = {
      rowId: `r-${i}-${Math.random().toString(36).slice(2, 8)}`,
      nombre,
      apellido,
      telefono: telRaw,
      email: emailRaw,
      fecha_nacimiento: fechaNac,
      fecha_cliente_desde: fechaDesde,
      instagram: normalizeText(get('instagram'), 80) ?? '',
      tiktok: normalizeText(get('tiktok'), 80) ?? '',
      otra_red_social: normalizeText(get('otra_red_social'), 80) ?? '',
      alergias: normalizeText(get('alergias'), 240) ?? '',
      nota_interna: normalizeText(get('nota_interna'), 1500) ?? '',
      acepta_marketing: normalizeBoolean(get('acepta_marketing'), true),
      errors: [],
      warnings: [],
      phoneKey,
      emailKey,
      duplicateGroupId: null,
      discarded: false,
    };

    validateRow(row, get);
    return row;
  });

  return { rows, totalParsed: json.length, truncated, unknownHeaders: unknown };
}

export function validateRow(row: PreviewRow, originalGet?: (f: string) => unknown): void {
  row.errors = [];
  row.warnings = [];
  if (!row.nombre.trim()) row.errors.push('Nombre requerido');
  if (row.nombre.length > 80) row.errors.push('Nombre supera 80 caracteres');
  if (row.apellido.length > 80) row.warnings.push('Apellido supera 80 caracteres');
  if (!row.apellido.trim()) row.warnings.push('Apellido faltante');

  if (row.email) {
    if (!isValidEmail(row.email)) row.errors.push('Email inválido');
  }
  if (row.fecha_nacimiento) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.fecha_nacimiento)) {
      row.errors.push('Fecha de nacimiento inválida');
    }
  } else if (originalGet && String(originalGet('fecha_nacimiento') ?? '').trim()) {
    row.errors.push('Fecha de nacimiento no reconocida');
  }
  if (row.fecha_cliente_desde) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.fecha_cliente_desde)) {
      row.errors.push('"Cliente desde" inválida');
    }
  } else if (originalGet && String(originalGet('fecha_cliente_desde') ?? '').trim()) {
    row.errors.push('"Cliente desde" no reconocida');
  }

  if (!row.telefono.trim() && !row.email.trim()) {
    row.errors.push('Falta teléfono o email');
  }

  // Recompute duplicate keys after edits
  row.phoneKey = normalizePhone(row.telefono);
  row.emailKey = normalizeEmail(row.email);

  // Sticky: once a row had errors, mark it for the session.
  if (row.errors.length > 0) row.wasErrored = true;
}

export interface DuplicateGroup {
  groupId: string;
  key: string; // e.g. "phone:549..." or "email:foo@bar.com"
  rowIds: string[];
}

export function detectInternalDuplicates(rows: PreviewRow[]): DuplicateGroup[] {
  const phoneMap = new Map<string, string[]>();
  const emailMap = new Map<string, string[]>();
  for (const r of rows) {
    if (r.discarded || r.keepSeparate) continue;
    if (r.phoneKey) {
      const arr = phoneMap.get(r.phoneKey) ?? [];
      arr.push(r.rowId);
      phoneMap.set(r.phoneKey, arr);
    }
    if (r.emailKey) {
      const arr = emailMap.get(r.emailKey) ?? [];
      arr.push(r.rowId);
      emailMap.set(r.emailKey, arr);
    }
  }
  // Union-find by row
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let p = parent.get(x) ?? x;
    if (p !== x) {
      p = find(p);
      parent.set(x, p);
    }
    return p;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const r of rows) parent.set(r.rowId, r.rowId);
  const groupAll = (ids: string[]) => {
    for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);
  };
  for (const ids of phoneMap.values()) if (ids.length > 1) groupAll(ids);
  for (const ids of emailMap.values()) if (ids.length > 1) groupAll(ids);

  const groups = new Map<string, string[]>();
  for (const r of rows) {
    if (r.discarded || r.keepSeparate) continue;
    const root = find(r.rowId);
    const arr = groups.get(root) ?? [];
    arr.push(r.rowId);
    groups.set(root, arr);
  }
  const result: DuplicateGroup[] = [];
  let i = 0;
  for (const [root, ids] of groups.entries()) {
    if (ids.length > 1) {
      result.push({ groupId: `g-${i++}-${root.slice(0, 6)}`, key: root, rowIds: ids });
    }
  }
  // Tag rows
  const idToGroup = new Map<string, string>();
  for (const g of result) for (const id of g.rowIds) idToGroup.set(id, g.groupId);
  for (const r of rows) {
    if (r.keepSeparate) { r.duplicateGroupId = null; continue; }
    r.duplicateGroupId = idToGroup.get(r.rowId) ?? null;
  }
  return result;
}

export function rowToPayload(r: PreviewRow) {
  return {
    nombre: r.nombre.trim(),
    apellido: r.apellido.trim(),
    telefono: r.telefono.trim() || null,
    email: r.email.trim() ? r.email.trim().toLowerCase() : null,
    fecha_nacimiento: r.fecha_nacimiento || null,
    fecha_cliente_desde: r.fecha_cliente_desde || null,
    instagram: r.instagram.trim() || null,
    tiktok: r.tiktok.trim() || null,
    otra_red_social: r.otra_red_social.trim() || null,
    alergias: r.alergias.trim() || null,
    nota_interna: r.nota_interna.trim() || null,
    acepta_marketing: r.acepta_marketing,
    bloqueado: r.bloqueado ?? false,
    motivo_bloqueo: (r.motivo_bloqueo ?? '').trim() || null,
    external_source: r.external_source ?? null,
    external_customer_id: (r.external_customer_id ?? '') ? r.external_customer_id : null,
  };
}
