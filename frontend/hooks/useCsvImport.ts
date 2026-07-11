'use client';

import { useState, useCallback } from 'react';
import { startImport } from '@/lib/api';
import { DedupPolicy } from '@/types/crm';
import { ApiError } from '@/lib/api';

interface UseCsvImportResult {
  isSubmitting: boolean;
  error: string | null;
  submitImport: (file: File, dedupPolicy: DedupPolicy) => Promise<string | null>;
  clearError: () => void;
}

export function useCsvImport(): UseCsvImportResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitImport = useCallback(async (file: File, dedupPolicy: DedupPolicy) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await startImport(file, dedupPolicy);
      return result.jobId;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to start import. Please try again.';
      setError(message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { isSubmitting, error, submitImport, clearError };
}
