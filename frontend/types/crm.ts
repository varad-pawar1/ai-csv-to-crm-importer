export const CRM_FIELDS = [
  'created_at',
  'name',
  'email',
  'country_code',
  'mobile_without_country_code',
  'company',
  'city',
  'state',
  'country',
  'lead_owner',
  'crm_status',
  'crm_note',
  'data_source',
  'possession_time',
  'description',
] as const;

export type CrmField = (typeof CRM_FIELDS)[number];
export type FieldConfidence = 'high' | 'medium' | 'low';
export type DedupPolicy = 'keep_both' | 'merge';

export interface CrmRecord {
  created_at: string | null;
  name: string | null;
  email: string | null;
  country_code: string | null;
  mobile_without_country_code: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lead_owner: string | null;
  crm_status: string | null;
  crm_note: string | null;
  data_source: string | null;
  possession_time: string | null;
  description: string | null;
  _skipped: boolean;
  _skip_reason: string | null;
  _confidence?: Partial<Record<CrmField, FieldConfidence>>;
}

export interface ImportProgress {
  jobId: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  batchesTotal: number;
  batchesDone: number;
  importedCount: number;
  skippedCount: number;
  totalRows: number;
  failedBatches: Array<{ batchIndex: number; error: string }>;
  activeBatchIndex?: number;
}

export type ResultFilter = 'all' | 'imported' | 'skipped' | 'low-confidence';

export interface ImportResults {
  summary: {
    totalRows: number;
    importedCount: number;
    skippedCount: number;
    status: string;
    failedBatches: Array<{ batchIndex: number; error: string }>;
  };
  records: CrmRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    filter: ResultFilter;
  };
}

export type ImportStep = 'upload' | 'preview' | 'confirm' | 'processing' | 'result';

export interface DuplicateGroup {
  key: string;
  type: 'email' | 'phone';
  rowIndices: number[];
}
