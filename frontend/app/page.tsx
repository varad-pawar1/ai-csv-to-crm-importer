'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ImportStep, DedupPolicy } from '@/types/crm';
import { parseCsvFile, CsvParseError } from '@/lib/csvParser';
import { useCsvImport } from '@/hooks/useCsvImport';
import { useDuplicates } from '@/hooks/useDuplicates';
import { Stepper } from '@/components/Stepper';
import { FileUpload } from '@/components/FileUpload';
import { CsvPreviewTable } from '@/components/CsvPreviewTable';
import { DedupWarning } from '@/components/DedupWarning';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

export default function HomePage() {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dedupPolicy, setDedupPolicy] = useState<DedupPolicy>('keep_both');

  const { isSubmitting, error: submitError, submitImport } = useCsvImport();
  const duplicates = useDuplicates(rows, headers);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setParseError(null);
    setFile(selectedFile);
    try {
      const parsed = await parseCsvFile(selectedFile);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setStep('preview');
    } catch (err) {
      setParseError(err instanceof CsvParseError ? err.message : 'Failed to parse CSV');
      setFile(null);
    }
  }, []);

  const handleStartImport = useCallback(async () => {
    if (!file) return;
    const jobId = await submitImport(file, dedupPolicy);
    if (jobId) {
      router.push(`/import/${jobId}`);
    }
  }, [file, dedupPolicy, submitImport, router]);

  return (
    <div>
      <Stepper currentStep={step} />

      {step === 'upload' && (
        <Card>
          <h2 className="text-xl font-semibold mb-2">Upload CSV</h2>
          <p className="text-sm text-slate-500 mb-6">
            Upload a leads CSV from Facebook Ads, Google Ads, or any CRM export. The AI will
            intelligently map columns to GrowEasy&apos;s CRM schema.
          </p>
          <FileUpload onFileSelect={handleFileSelect} error={parseError} />
        </Card>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-xl font-semibold mb-4">Preview Data</h2>
            <CsvPreviewTable headers={headers} rows={rows} />
          </Card>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('upload')}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button onClick={() => setStep('confirm')}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-xl font-semibold mb-2">Confirm Import</h2>
            <p className="text-sm text-slate-500 mb-4">
              Review the summary below, then start the import. AI will map all rows to the CRM schema.
            </p>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                <p className="text-2xl font-bold">{formatNumber(rows.length)}</p>
                <p className="text-xs text-slate-500">Total Rows</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                <p className="text-2xl font-bold">{headers.length}</p>
                <p className="text-xs text-slate-500">Columns</p>
              </div>
            </div>
          </Card>

          <DedupWarning
            duplicates={duplicates}
            policy={dedupPolicy}
            onPolicyChange={setDedupPolicy}
          />

          {submitError && <Alert variant="error">{submitError}</Alert>}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('preview')}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleStartImport} isLoading={isSubmitting}>
              Start Import
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
