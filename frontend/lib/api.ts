import {
  ImportProgress,
  ImportResults,
  DedupPolicy,
  ResultFilter,
} from '@/types/crm';

const API_BASE = '/api/import';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || res.statusText, res.status, body.requestId);
  }
  return res.json() as Promise<T>;
}

export async function startImport(
  file: File,
  dedupPolicy: DedupPolicy
): Promise<{
  jobId: string;
  totalRows: number;
  batchesTotal: number;
}> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('dedupPolicy', dedupPolicy);

  const res = await fetch(`${API_BASE}`, {
    method: 'POST',
    body: formData,
  });

  return handleResponse(res);
}

export async function getImportResults(
  jobId: string,
  options: { page?: number; limit?: number; filter?: ResultFilter } = {}
): Promise<ImportResults> {
  const params = new URLSearchParams();
  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));
  if (options.filter) params.set('filter', options.filter);

  const query = params.toString();
  const res = await fetch(`${API_BASE}/${jobId}/results${query ? `?${query}` : ''}`);
  return handleResponse<ImportResults>(res);
}

export function getExportUrl(
  jobId: string,
  format: 'csv' | 'json' = 'csv',
  filter: ResultFilter = 'all'
): string {
  const params = new URLSearchParams({ format });
  if (filter !== 'all') params.set('filter', filter);
  return `${API_BASE}/${jobId}/export?${params.toString()}`;
}

export async function downloadExport(
  jobId: string,
  format: 'csv' | 'json',
  filter: ResultFilter = 'all'
): Promise<void> {
  const res = await fetch(getExportUrl(jobId, format, filter));
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || res.statusText, res.status, body.requestId);
  }

  const blob = await res.blob();
  const filterSuffix = filter === 'all' ? '' : `-${filter}`;
  const extension = format === 'json' ? 'json' : 'csv';
  const filename = `import-${jobId}${filterSuffix}.${extension}`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function getStreamUrl(jobId: string): string {
  return `${API_BASE}/${jobId}/stream`;
}
