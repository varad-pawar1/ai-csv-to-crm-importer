import {
  ImportProgress,
  ImportResults,
  DedupPolicy,
} from '@/types/crm';

const API_BASE = '/api/import';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || '';

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

export async function getImportResults(jobId: string): Promise<ImportResults> {
  const res = await fetch(`${API_BASE}/${jobId}/results`);
  return handleResponse<ImportResults>(res);
}

export function getExportUrl(jobId: string, format: 'csv' | 'json' = 'csv'): string {
  return `${API_BASE}/${jobId}/export?format=${format}`;
}

export function getStreamUrl(jobId: string): string {
  if (BACKEND_URL) {
    return `${BACKEND_URL}/api/import/${jobId}/stream`;
  }
  return `${API_BASE}/${jobId}/stream`;
}
