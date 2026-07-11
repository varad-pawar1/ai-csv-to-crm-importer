'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert } from './ui/Alert';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  error?: string | null;
}

export function FileUpload({ onFileSelect, error }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setSelectedFile(file);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900',
          isDragging
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-950'
            : 'border-slate-300 dark:border-slate-600 hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800'
        )}
        aria-label="Upload CSV file"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <Upload className="h-10 w-10 text-slate-400 mb-4" aria-hidden="true" />
        <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
          Drag & drop your CSV here
        </p>
        <p className="text-sm text-slate-500 mt-1">or click to browse (max 10MB)</p>
      </div>

      {selectedFile && (
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-800 p-4">
          <FileSpreadsheet className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-slate-500">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
