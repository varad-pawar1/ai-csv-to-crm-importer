'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useImportProgress } from '@/hooks/useImportProgress';
import { ImportResults } from '@/types/crm';
import { ProcessingView } from '@/components/ProcessingView';
import { ImportSummary } from '@/components/ImportSummary';
import { ResultTable } from '@/components/ResultTable';
import { ImportLoadingOverlay } from '@/components/ImportLoadingOverlay';
import { Stepper } from '@/components/Stepper';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { IMPORT_PENDING_KEY } from '@/lib/constants';

export default function ImportJobPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const { progress, batchFailures, isConnected, error: connectionError } = useImportProgress(jobId);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  const isDone = progress?.status === 'done' || progress?.status === 'failed';

  const summary = useMemo<ImportResults['summary'] | null>(() => {
    if (!isDone || !progress) return null;
    return {
      totalRows: progress.totalRows,
      importedCount: progress.importedCount,
      skippedCount: progress.skippedCount,
      status: progress.status,
      failedBatches: progress.failedBatches,
    };
  }, [isDone, progress]);

  useEffect(() => {
    const pendingJobId = sessionStorage.getItem(IMPORT_PENDING_KEY);
    setIsBootstrapping(pendingJobId === jobId);
  }, [jobId]);

  useEffect(() => {
    if (!progress && !isConnected) return;
    sessionStorage.removeItem(IMPORT_PENDING_KEY);
    setIsBootstrapping(false);
  }, [progress, isConnected]);

  const step = isDone && summary ? 'result' : 'processing';
  const showBootstrapOverlay = isBootstrapping && !progress;

  return (
    <div>
      {showBootstrapOverlay && (
        <ImportLoadingOverlay
          message="Connecting to import..."
          detail="Your file was uploaded — setting up live progress"
        />
      )}

      <Stepper currentStep={step} />

      {!isDone && (
        <ProcessingView
          progress={progress}
          batchFailures={batchFailures}
          isConnected={isConnected}
          connectionError={connectionError}
        />
      )}

      {isDone && !summary && (
        <Card>
          <div className="flex items-center gap-3 text-slate-500">
            <div className="animate-spin h-5 w-5 border-2 border-brand-600 border-t-transparent rounded-full" />
            Loading results...
          </div>
        </Card>
      )}

      {connectionError && isDone && !summary && (
        <Alert variant="error">{connectionError}</Alert>
      )}

      {isDone && summary && (
        <div className="space-y-6">
          <ImportSummary summary={summary} />

          <Card>
            <h3 className="text-lg font-semibold mb-4">Mapped Records</h3>
            <ResultTable jobId={jobId} />
          </Card>

          <div className="flex justify-center">
            <Button variant="secondary" onClick={() => router.push('/')}>
              Import Another File
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
