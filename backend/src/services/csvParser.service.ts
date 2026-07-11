import Papa from 'papaparse';
import { getEnv } from '../config/env';

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

function sanitizeCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str.replace(/\r\n/g, '\\n').replace(/\n/g, '\\n').replace(/\r/g, '\\n');
}

export function parseCsvContent(content: string): ParsedCsv {
  if (!content || !content.trim()) {
    throw new CsvParseError('CSV file is empty');
  }

  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
    transform: (value) => sanitizeCellValue(value),
  });

  if (result.errors.length > 0) {
    const fatal = result.errors.find((e) => e.type === 'Quotes' || e.type === 'FieldMismatch');
    if (fatal) {
      throw new CsvParseError(`CSV parse error: ${fatal.message}`);
    }
  }

  const headers = result.meta.fields?.filter((h) => h && h.trim()) ?? [];
  if (headers.length === 0) {
    throw new CsvParseError('CSV has no headers');
  }

  const rows = (result.data ?? [])
    .map((row) => {
      const cleaned: Record<string, string> = {};
      for (const header of headers) {
        cleaned[header] = sanitizeCellValue(row[header] ?? '');
      }
      return cleaned;
    })
    .filter((row) => Object.values(row).some((v) => v.trim() !== ''));

  if (rows.length === 0) {
    throw new CsvParseError('CSV contains no data rows');
  }

  const maxRows = getEnv().MAX_CSV_ROWS;
  if (rows.length > maxRows) {
    throw new CsvParseError(`CSV exceeds maximum of ${maxRows} rows`);
  }

  return { headers, rows };
}
