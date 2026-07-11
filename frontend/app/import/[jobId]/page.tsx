'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useImportProgress } from '@/hooks/useImportProgress';
import { getImportResults } from '@/lib/api';
import { ImportResults } from '@/types/crm';
import { ProcessingView } from '@/components/ProcessingView';
import { ImportSummary } from '@/components/ImportSummary';
import { ResultTable } from '@/components/ResultTable';
import { Stepper } from '@/components/Stepper';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export default function ImportJobPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const { progress, batchFailures, isConnected, error: connectionError } = useImportProgress(jobId);
  const [results, setResults] = useState<ImportResults | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  const isDone = progress?.status === 'done' || progress?.status === 'failed';

  useEffect(() => {
    if (!isDone || results) return;

    setLoadingResults(true);
    getImportResults(jobId)
      .then(setResults)
      .catch((err) => setResultsError(err instanceof Error ? err.message : 'Failed to load results'))
      .finally(() => setLoadingResults(false));
  }, [isDone, jobId, results]);

  const step = isDone && results ? 'result' : 'processing';

  return (
    <div>
      <Stepper currentStep={step} />

      {!isDone && (
        <ProcessingView
          progress={progress}
          batchFailures={batchFailures}
          isConnected={isConnected}
          connectionError={connectionError}
        />
      )}

      {isDone && loadingResults && (
        <Card>
          <div className="flex items-center gap-3 text-slate-500">
            <div className="animate-spin h-5 w-5 border-2 border-brand-600 border-t-transparent rounded-full" />
            Loading results...
          </div>
        </Card>
      )}

      {resultsError && <Alert variant="error">{resultsError}</Alert>}

      {isDone && results && (
        <div className="space-y-6">
          <ImportSummary jobId={jobId} results={results} />

          <Card>
            <h3 className="text-lg font-semibold mb-4">Mapped Records</h3>
            <ResultTable records={[...results.imported, ...results.skipped]} />
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
