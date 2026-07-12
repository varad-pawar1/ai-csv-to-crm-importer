'use client';

import { ImportResults } from '@/types/crm';
import { formatNumber } from '@/lib/utils';
import { Card } from './ui/Card';
import { Alert } from './ui/Alert';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ImportSummaryProps {
  summary: ImportResults['summary'];
}

export function ImportSummary({ summary }: ImportSummaryProps) {
  const hasFailures = summary.failedBatches.length > 0;

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-4">Import Summary</h3>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
          <p className="text-3xl font-bold">{formatNumber(summary.totalRows)}</p>
          <p className="text-sm text-slate-500">Total Rows</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950">
          <div className="flex items-center justify-center gap-1">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-3xl font-bold text-green-700 dark:text-green-300">
              {formatNumber(summary.importedCount)}
            </p>
          </div>
          <p className="text-sm text-slate-500">Imported</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-950">
          <div className="flex items-center justify-center gap-1">
            <XCircle className="h-5 w-5 text-amber-600" />
            <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
              {formatNumber(summary.skippedCount)}
            </p>
          </div>
          <p className="text-sm text-slate-500">Skipped</p>
        </div>
      </div>

      {hasFailures && (
        <Alert variant="warning">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">{summary.failedBatches.length} batch(es) failed</p>
              <ul className="mt-1 text-xs space-y-1">
                {summary.failedBatches.map((b) => (
                  <li key={b.batchIndex}>
                    Batch {b.batchIndex + 1}: {b.error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Alert>
      )}
    </Card>
  );
}
