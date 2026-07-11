import { describe, it, expect } from 'vitest';
import { parseCsvContent } from '../src/services/csvParser.service';
import { chunkRows } from '../src/services/batcher.service';
import {
  mapToCrmRecord,
  sanitizeForCsvExport,
  recordToExportRow,
  createEmptyCrmRecord,
} from '../src/services/crmMapper.service';

describe('csvParser.service', () => {
  it('parses valid CSV with headers and rows', () => {
    const csv = 'name,email\nJohn,john@test.com\nJane,jane@test.com';
    const result = parseCsvContent(csv);
    expect(result.headers).toEqual(['name', 'email']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].name).toBe('John');
  });

  it('throws on empty CSV', () => {
    expect(() => parseCsvContent('')).toThrow('empty');
  });

  it('throws on CSV with no data rows', () => {
    expect(() => parseCsvContent('name,email')).toThrow('no data rows');
  });

  it('escapes newlines in cell values', () => {
    const csv = 'name,note\nJohn,"line1\nline2"';
    const result = parseCsvContent(csv);
    expect(result.rows[0].note).toContain('\\n');
  });
});

describe('batcher.service', () => {
  it('chunks rows into batches of given size', () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ id: String(i) }));
    const batches = chunkRows(rows, 10);
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(10);
    expect(batches[2]).toHaveLength(5);
  });
});

describe('crmMapper.service', () => {
  it('skips records missing both email and phone', () => {
    const record = mapToCrmRecord({ name: 'Test' });
    expect(record._skipped).toBe(true);
    expect(record._skip_reason).toContain('email and phone');
  });

  it('extracts first email and notes extras', () => {
    const record = mapToCrmRecord({
      email: 'first@test.com, second@test.com',
    });
    expect(record.email).toBe('first@test.com');
    expect(record.crm_note).toContain('second@test.com');
    expect(record._skipped).toBe(false);
  });

  it('rejects invalid crm_status enum values', () => {
    const record = mapToCrmRecord({
      email: 'test@test.com',
      crm_status: 'INVALID_STATUS',
    });
    expect(record.crm_status).toBeNull();
  });

  it('accepts valid crm_status enum values', () => {
    const record = mapToCrmRecord({
      email: 'test@test.com',
      crm_status: 'GOOD_LEAD_FOLLOW_UP',
    });
    expect(record.crm_status).toBe('GOOD_LEAD_FOLLOW_UP');
  });

  it('normalizes valid dates to ISO string', () => {
    const record = mapToCrmRecord({
      email: 'test@test.com',
      created_at: '2024-01-15',
    });
    expect(record.created_at).toMatch(/2024-01-15/);
  });

  it('sets null for invalid dates', () => {
    const record = mapToCrmRecord({
      email: 'test@test.com',
      created_at: 'not-a-date',
    });
    expect(record.created_at).toBeNull();
  });

  it('sanitizes CSV injection characters on export', () => {
    expect(sanitizeForCsvExport('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(sanitizeForCsvExport('+1234')).toBe("'+1234");
    expect(sanitizeForCsvExport('-formula')).toBe("'-formula");
    expect(sanitizeForCsvExport('@mention')).toBe("'@mention");
  });

  it('exports record to flat row', () => {
    const record = createEmptyCrmRecord();
    record.email = 'test@test.com';
    record.name = 'Test';
    const row = recordToExportRow(record);
    expect(row.email).toBe('test@test.com');
    expect(row._skipped).toBe('false');
  });
});
