import * as XLSX from 'xlsx';
import {
  normalizeName,
  normalizeText,
  normalizePhone,
  normalizeEmail,
  normalizeDate,
  normalizeBoolean,
} from './normalize';
import { PreviewRow, ParseResult, validateRow } from './parseImportFile';

// Headers required (case-insensitive, trimmed) to recognize a Fresha export.
const REQUIRED_HEADERS = [
  'first name',
  'last name',
  'mobile number',
  'email',
  'added',
];

const MAX_ROWS = 2000;

function normHeader(h: string): string {
  return String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export class FreshaFormatError extends Error {
  constructor() {
    super(
      'No pudimos reconocer este archivo como exportación de Fresha. Revisá que sea el archivo de clientes exportado desde Fresha.'
    );
    this.name = 'FreshaFormatError';
  }
}

export async function parseFreshaFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) throw new FreshaFormatError();
  const ws = wb.Sheets[firstSheet];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: true,
  });

  if (json.length === 0) throw new FreshaFormatError();

  // Build a normalized header -> original header map for the first row.
  const headerMap = new Map<string, string>();
  for (const h of Object.keys(json[0])) {
    headerMap.set(normHeader(h), h);
  }

  // Verify required headers exist
  for (const req of REQUIRED_HEADERS) {
    if (!headerMap.has(req)) throw new FreshaFormatError();
  }

  const get = (row: Record<string, unknown>, header: string): unknown => {
    const orig = headerMap.get(header);
    if (!orig) return '';
    return row[orig];
  };

  const truncated = json.length > MAX_ROWS;
  const slice = json.slice(0, MAX_ROWS);

  const rows: PreviewRow[] = slice.map((raw, i) => {
    const nombre = normalizeName(get(raw, 'first name')) ?? '';
    const apellido = normalizeName(get(raw, 'last name')) ?? '';

    // Phone: Mobile Number primary, Telephone fallback. Telephone is NOT stored separately.
    const mobileRaw = String(get(raw, 'mobile number') ?? '').trim();
    const telephoneRaw = String(get(raw, 'telephone') ?? '').trim();
    const telRaw = mobileRaw || telephoneRaw;

    const emailRaw = String(get(raw, 'email') ?? '').trim();

    const fechaNac = normalizeDate(get(raw, 'date of birth')) ?? '';
    const fechaDesde = normalizeDate(get(raw, 'added')) ?? '';

    const acepta = normalizeBoolean(get(raw, 'accepts marketing'), true);
    const bloqueado = normalizeBoolean(get(raw, 'blocked'), false);
    const motivoBloqueo = normalizeText(get(raw, 'block reason'), 240) ?? '';
    const nota = normalizeText(get(raw, 'comentario'), 1500) ?? '';
    const clientId = normalizeText(get(raw, 'client id'), 80) ?? '';

    const row: PreviewRow = {
      rowId: `fr-${i}-${Math.random().toString(36).slice(2, 8)}`,
      nombre,
      apellido,
      telefono: telRaw,
      email: emailRaw,
      fecha_nacimiento: fechaNac,
      fecha_cliente_desde: fechaDesde,
      instagram: '',
      tiktok: '',
      otra_red_social: '',
      alergias: '',
      nota_interna: nota,
      acepta_marketing: acepta,
      bloqueado,
      motivo_bloqueo: motivoBloqueo,
      external_source: 'fresha',
      external_customer_id: clientId || null,
      errors: [],
      warnings: [],
      phoneKey: normalizePhone(telRaw),
      emailKey: normalizeEmail(emailRaw),
      duplicateGroupId: null,
      discarded: false,
    };

    // Custom validation: name required + phone OR email required.
    validateRow(row);
    // For Fresha, "no contact" must be a blocking error, not just a warning.
    if (!row.telefono.trim() && !row.email.trim()) {
      if (!row.errors.includes('Falta teléfono o email')) {
        row.errors.push('Falta teléfono o email');
      }
      row.warnings = row.warnings.filter(w => w !== 'Sin teléfono ni email');
    }
    // Apellido faltante = warning, no bloqueante
    if (!row.apellido.trim() && !row.warnings.includes('Apellido faltante')) {
      row.warnings.push('Apellido faltante');
    }
    if (row.errors.length > 0) row.wasErrored = true;

    return row;
  });

  return { rows, totalParsed: json.length, truncated, unknownHeaders: [] };
}
