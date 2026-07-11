import Papa from 'papaparse';

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

export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      reject(new CsvParseError('Please upload a .csv file'));
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      reject(new CsvParseError('File exceeds 10MB limit'));
      return;
    }

    if (file.size === 0) {
      reject(new CsvParseError('File is empty'));
      return;
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        const headers = results.meta.fields?.filter((h) => h?.trim()) ?? [];
        if (headers.length === 0) {
          reject(new CsvParseError('CSV has no headers'));
          return;
        }

        const rows = (results.data ?? []).filter((row) =>
          Object.values(row).some((v) => v?.trim())
        );

        if (rows.length === 0) {
          reject(new CsvParseError('CSV contains no data rows'));
          return;
        }

        if (results.errors.length > 0) {
          const fatal = results.errors.find((e) => e.type === 'Quotes');
          if (fatal) {
            reject(new CsvParseError(`CSV parse error: ${fatal.message}`));
            return;
          }
        }

        resolve({ headers, rows });
      },
      error: (error) => reject(new CsvParseError(error.message)),
    });
  });
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}
