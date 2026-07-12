import {
  CRM_FIELDS,
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
  CrmRecord,
  CrmField,
  FieldConfidence,
} from '../types/crm.types';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /\+?[\d\s().-]{7,}/g;

function extractFirstEmail(value: string | null): { primary: string | null; extras: string[] } {
  if (!value) return { primary: null, extras: [] };
  const matches = value.match(EMAIL_REGEX) ?? [];
  if (matches.length === 0) return { primary: null, extras: [] };
  return { primary: matches[0]!.toLowerCase(), extras: matches.slice(1) };
}

function extractFirstPhone(value: string | null): { primary: string | null; extras: string[] } {
  if (!value) return { primary: null, extras: [] };
  const matches = value.match(PHONE_REGEX) ?? [];
  const cleaned = matches.map((m) => m.replace(/\s+/g, '').trim()).filter(Boolean);
  if (cleaned.length === 0) return { primary: null, extras: [] };
  return { primary: cleaned[0], extras: cleaned.slice(1) };
}

function normalizeDate(value: string | null): string | null {
  if (!value || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isValidEnum<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function appendNote(existing: string | null, addition: string): string {
  if (!existing) return addition;
  return `${existing}; ${addition}`;
}

export function createEmptyCrmRecord(): CrmRecord {
  return {
    created_at: null,
    name: null,
    email: null,
    country_code: null,
    mobile_without_country_code: null,
    company: null,
    city: null,
    state: null,
    country: null,
    lead_owner: null,
    crm_status: null,
    crm_note: null,
    data_source: null,
    possession_time: null,
    description: null,
    _skipped: false,
    _skip_reason: null,
    _confidence: {},
  };
}

export interface RawLlmRow {
  created_at?: string | null;
  name?: string | null;
  email?: string | null;
  country_code?: string | null;
  mobile_without_country_code?: string | null;
  company?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  lead_owner?: string | null;
  crm_status?: string | null;
  crm_note?: string | null;
  data_source?: string | null;
  possession_time?: string | null;
  description?: string | null;
  _confidence?: Partial<Record<CrmField, FieldConfidence>>;
}

export function mapToCrmRecord(raw: RawLlmRow): CrmRecord {
  const record = createEmptyCrmRecord();
  record._confidence = raw._confidence ?? {};

  const emailResult = extractFirstEmail(raw.email ?? null);
  record.email = emailResult.primary;
  if (emailResult.extras.length > 0) {
    record.crm_note = appendNote(record.crm_note, `Extra emails: ${emailResult.extras.join(', ')}`);
  }

  const phoneResult = extractFirstPhone(raw.mobile_without_country_code ?? null);
  record.mobile_without_country_code = phoneResult.primary;
  if (phoneResult.extras.length > 0) {
    record.crm_note = appendNote(record.crm_note, `Extra phones: ${phoneResult.extras.join(', ')}`);
  }

  record.created_at = normalizeDate(raw.created_at ?? null);
  record.name = raw.name?.trim() || null;
  record.country_code = raw.country_code?.trim() || null;
  record.company = raw.company?.trim() || null;
  record.city = raw.city?.trim() || null;
  record.state = raw.state?.trim() || null;
  record.country = raw.country?.trim() || null;
  record.lead_owner = raw.lead_owner?.trim() || null;
  record.possession_time = raw.possession_time?.trim() || null;
  record.description = raw.description?.trim() || null;

  if (isValidEnum(raw.crm_status, CRM_STATUS_VALUES)) {
    record.crm_status = raw.crm_status;
  }

  if (isValidEnum(raw.data_source, DATA_SOURCE_VALUES)) {
    record.data_source = raw.data_source;
  }

  if (raw.crm_note?.trim()) {
    record.crm_note = appendNote(record.crm_note, raw.crm_note.trim());
  }

  if (!record.email && !record.mobile_without_country_code) {
    record._skipped = true;
    record._skip_reason = 'Missing both email and phone number';
  }

  return record;
}

export function getLeadDedupKey(record: Pick<CrmRecord, 'email' | 'mobile_without_country_code'>): string | null {
  const email = record.email?.trim().toLowerCase();
  if (email) return `email:${email}`;
  const phone = record.mobile_without_country_code?.replace(/\D/g, '');
  if (phone && phone.length >= 7) return `phone:${phone}`;
  return null;
}

export function mergeCrmRecords(primary: CrmRecord, secondary: CrmRecord): CrmRecord {
  const merged = { ...primary };
  for (const field of CRM_FIELDS) {
    if (!merged[field] && secondary[field]) {
      (merged as Record<string, unknown>)[field] = secondary[field];
    }
  }
  if (secondary.crm_note) {
    merged.crm_note = appendNote(merged.crm_note, secondary.crm_note);
  }
  merged._confidence = { ...secondary._confidence, ...merged._confidence };
  return merged;
}

export interface MappedLeadDoc {
  mappedData: CrmRecord;
  skipped: boolean;
  skipReason: string | null;
  rowIndex: number;
}

/** Merge duplicate contacts within one batch when dedupPolicy is "merge". */
export function deduplicateBatchLeads(
  leadDocs: MappedLeadDoc[],
  dedupPolicy: 'keep_both' | 'merge'
): MappedLeadDoc[] {
  if (dedupPolicy !== 'merge') return leadDocs;

  const seen = new Map<string, number>();

  for (let i = 0; i < leadDocs.length; i++) {
    const doc = leadDocs[i]!;
    const key = getLeadDedupKey(doc.mappedData);
    if (!key) continue;

    if (seen.has(key)) {
      const prevIdx = seen.get(key)!;
      const prev = leadDocs[prevIdx]!;

      prev.mappedData = mergeCrmRecords(prev.mappedData, doc.mappedData);
      if (!prev.mappedData._skipped && doc.mappedData._skipped) {
        prev.skipped = false;
        prev.skipReason = null;
        prev.mappedData._skipped = false;
        prev.mappedData._skip_reason = null;
      }

      doc.skipped = true;
      doc.skipReason = 'Merged duplicate into earlier row in batch';
      doc.mappedData = {
        ...doc.mappedData,
        _skipped: true,
        _skip_reason: doc.skipReason,
      };
    } else {
      seen.set(key, i);
    }
  }

  return leadDocs;
}

export function sanitizeForCsvExport(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function getExportHeaders(): string[] {
  return [...CRM_FIELDS, '_skipped', '_skip_reason'];
}

export function recordToExportRow(record: CrmRecord): Record<string, string> {
  const row: Record<string, string> = {};
  for (const field of CRM_FIELDS) {
    row[field] = sanitizeForCsvExport(record[field]);
  }
  row._skipped = String(record._skipped);
  row._skip_reason = sanitizeForCsvExport(record._skip_reason);
  return row;
}
