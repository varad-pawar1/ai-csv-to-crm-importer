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

export const CRM_STATUS_VALUES = [
  'GOOD_LEAD_FOLLOW_UP',
  'DID_NOT_CONNECT',
  'BAD_LEAD',
  'SALE_DONE',
] as const;

export type CrmStatus = (typeof CRM_STATUS_VALUES)[number];

export const DATA_SOURCE_VALUES = [
  'leads_on_demand',
  'meridian_tower',
  'eden_park',
  'varah_swamy',
  'sarjapur_plots',
] as const;

export type DataSource = (typeof DATA_SOURCE_VALUES)[number];

export type FieldConfidence = 'high' | 'medium' | 'low';

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
  crm_status: CrmStatus | null;
  crm_note: string | null;
  data_source: DataSource | null;
  possession_time: string | null;
  description: string | null;
  _skipped: boolean;
  _skip_reason: string | null;
  _confidence?: Partial<Record<CrmField, FieldConfidence>>;
}

export type DedupPolicy = 'keep_both' | 'merge';

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

export interface BatchJobData {
  importJobId: string;
  batchIndex: number;
  startRowIndex: number;
  headers: string[];
  rows: Record<string, string>[];
  dedupPolicy: DedupPolicy;
}
