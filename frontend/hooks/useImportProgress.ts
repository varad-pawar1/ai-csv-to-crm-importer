'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ImportProgress } from '@/types/crm';
import { getStreamUrl } from '@/lib/api';

interface UseImportProgressResult {
  progress: ImportProgress | null;
  batchFailures: Array<{ batchIndex: number; error: string }>;
  isConnected: boolean;
  error: string | null;
}

export function useImportProgress(jobId: string | null): UseImportProgressResult {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [batchFailures, setBatchFailures] = useState<Array<{ batchIndex: number; error: string }>>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDoneRef = useRef(false);

  const applySnapshot = useCallback((snapshot: ImportProgress) => {
    setProgress(snapshot);
    if (snapshot.failedBatches.length > 0) {
      setBatchFailures(snapshot.failedBatches);
    }
    if (snapshot.status === 'done' || snapshot.status === 'failed') {
      isDoneRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!jobId) return;

    isDoneRef.current = false;
    const source = new EventSource(getStreamUrl(jobId));

    source.addEventListener('open', () => {
      setIsConnected(true);
      setError(null);
    });

    source.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data) as ImportProgress;
      applySnapshot(data);
    });

    source.addEventListener('batch-failed', (e) => {
      const data = JSON.parse(e.data) as { batchIndex: number; error: string };
      setBatchFailures((prev) => {
        const exists = prev.some((f) => f.batchIndex === data.batchIndex);
        if (exists) return prev;
        return [...prev, data];
      });
    });

    source.addEventListener('done', (e) => {
      const data = JSON.parse(e.data) as ImportProgress;
      applySnapshot(data);
      isDoneRef.current = true;
      source.close();
      setIsConnected(false);
    });

    source.onerror = () => {
      setIsConnected(false);
      if (!isDoneRef.current) {
        setError('Connection lost');
      }
    };

    return () => {
      source.close();
      setIsConnected(false);
    };
  }, [jobId, applySnapshot]);

  return { progress, batchFailures, isConnected, error };
}
