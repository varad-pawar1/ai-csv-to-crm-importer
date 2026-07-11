'use client';

import { ImportProgress } from '@/types/crm';
import { formatNumber } from '@/lib/utils';
import { Card } from './ui/Card';
import { Alert } from './ui/Alert';

interface ProcessingViewProps {
  progress: ImportProgress | null;
  batchFailures: Array<{ batchIndex: number; error: string }>;
  isConnected: boolean;
  connectionError: string | null;
}

export function ProcessingView({
  progress,
  batchFailures,
  isConnected,
  connectionError,
}: ProcessingViewProps) {
  const percent =
    progress && progress.batchesTotal > 0
      ? Math.round((progress.batchesDone / progress.batchesTotal) * 100)
      : 0;

  const isActivelyProcessing =
    progress?.status === 'processing' && progress.batchesDone < progress.batchesTotal;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Processing Import</h3>
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}
              aria-hidden="true"
            />
            <span className="text-slate-500">{isConnected ? 'Live' : 'Polling'}</span>
          </div>
        </div>

        {connectionError && <Alert variant="warning" className="mb-4">{connectionError}</Alert>}

        {isActivelyProcessing && (
          <Alert variant="info" className="mb-4">
            {progress.activeBatchIndex !== undefined
              ? `AI is mapping batch ${progress.activeBatchIndex + 1} of ${progress.batchesTotal}...`
              : progress.status === 'queued'
                ? 'Waiting to start...'
                : 'AI is processing your CSV rows...'}
          </Alert>
        )}

        <div className="mb-2 flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">
            Batch {progress?.batchesDone ?? 0} of {progress?.batchesTotal ?? 0}
          </span>
          <span className="font-medium">{percent}%</span>
        </div>

        <div
          className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-brand-600 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 text-center">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatNumber(progress?.totalRows ?? 0)}
            </p>
            <p className="text-xs text-slate-500">Total Rows</p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950">
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              {formatNumber(progress?.importedCount ?? 0)}
            </p>
            <p className="text-xs text-slate-500">Imported</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {formatNumber(progress?.skippedCount ?? 0)}
            </p>
            <p className="text-xs text-slate-500">Skipped</p>
          </div>
        </div>
      </Card>

      {batchFailures.length > 0 && (
        <Card>
          <h4 className="font-medium text-red-700 dark:text-red-300 mb-3">
            Batch Failures ({batchFailures.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-auto">
            {batchFailures.map((f) => (
              <Alert key={f.batchIndex} variant="error">
                <span className="font-medium">Batch {f.batchIndex + 1}:</span> {f.error}
              </Alert>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Failed batches were retried automatically. Other batches continue processing.
          </p>
        </Card>
      )}
    </div>
  );
}
