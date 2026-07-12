'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CrmRecord, CrmField, ResultFilter } from '@/types/crm';
import { getImportResults, downloadExport } from '@/lib/api';
import { FILTER_LABELS, TABLE_PAGE_SIZE } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Pagination } from './ui/Pagination';
import { Button } from './ui/Button';
import { Download } from 'lucide-react';

interface ResultTableProps {
  jobId: string;
}

const DISPLAY_FIELDS: CrmField[] = [
  'name',
  'email',
  'mobile_without_country_code',
  'city',
  'company',
  'crm_status',
  'crm_note',
];

function getConfidenceClass(
  record: CrmRecord,
  field: CrmField,
  value: string | null
): string {
  const confidence = record._confidence?.[field];
  if (confidence === 'low' || (!value && confidence !== 'high')) {
    return 'bg-amber-50 dark:bg-amber-950/30';
  }
  if (confidence === 'medium') {
    return 'bg-yellow-50/50 dark:bg-yellow-950/20';
  }
  return '';
}

export function ResultTable({ jobId }: ResultTableProps) {
  const [filter, setFilter] = useState<ResultFilter>('all');
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: TABLE_PAGE_SIZE,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(
    async (nextPage: number, nextFilter: ResultFilter) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getImportResults(jobId, {
          page: nextPage,
          limit: TABLE_PAGE_SIZE,
          filter: nextFilter,
        });
        setRecords(result.records);
        setPagination({
          page: result.pagination.page,
          totalPages: result.pagination.totalPages,
          total: result.pagination.total,
          limit: result.pagination.limit,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load records');
      } finally {
        setIsLoading(false);
      }
    },
    [jobId]
  );

  useEffect(() => {
    fetchPage(page, filter);
  }, [page, filter, fetchPage]);

  const handleFilterChange = (next: ResultFilter) => {
    setFilter(next);
    setPage(1);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(format);
    try {
      await downloadExport(jobId, format, filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const filterLabel = FILTER_LABELS[filter];
  const canExport = !isLoading && pagination.total > 0;
  const skeletonRows = Math.min(5, TABLE_PAGE_SIZE);

  return (
    <div ref={tableRef} className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500">View:</span>
        {(['all', 'imported', 'skipped', 'low-confidence'] as const).map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            disabled={isLoading}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              filter === f
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            )}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <span className="text-xs text-slate-400 hidden sm:inline">
            Export includes only{' '}
            <strong className="text-slate-600 dark:text-slate-300">{filterLabel.toLowerCase()}</strong>{' '}
            ({pagination.total.toLocaleString()} records)
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            isLoading={exporting === 'csv'}
            disabled={!canExport || exporting !== null}
            onClick={() => handleExport('csv')}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isLoading={exporting === 'json'}
            disabled={!canExport || exporting !== null}
            onClick={() => handleExport('json')}
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden min-w-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-600 dark:text-slate-300 w-12">
                  #
                </th>
                {DISPLAY_FIELDS.map((field) => (
                  <th
                    key={field}
                    className="px-3 py-2.5 text-left text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
                  >
                    {field}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: skeletonRows }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                    {Array.from({ length: DISPLAY_FIELDS.length + 1 }).map((__, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={DISPLAY_FIELDS.length + 1} className="p-8 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={DISPLAY_FIELDS.length + 1} className="p-8 text-center text-slate-500">
                    No records match this filter
                  </td>
                </tr>
              ) : (
                records.map((record, index) => {
                  const rowNum = (pagination.page - 1) * pagination.limit + index + 1;
                  return (
                    <tr
                      key={`${pagination.page}-${rowNum}`}
                      className={cn(
                        'border-b border-slate-100 dark:border-slate-800',
                        record._skipped && 'opacity-60'
                      )}
                    >
                      <td className="px-3 py-2.5 text-slate-400 text-xs align-middle">{rowNum}</td>
                      {DISPLAY_FIELDS.map((field) => {
                        const cellValue =
                          record[field] ??
                          (field === 'crm_note' && record._skip_reason ? record._skip_reason : null);
                        const displayText = cellValue != null ? String(cellValue) : null;

                        return (
                          <td
                            key={field}
                            className={cn(
                              'px-3 py-2.5 align-middle whitespace-nowrap',
                              getConfidenceClass(record, field, record[field])
                            )}
                            title={displayText ?? undefined}
                          >
                            {displayText ? (
                              field === 'crm_note' && record._skip_reason && !record[field] ? (
                                <span className="text-amber-600 text-xs">{displayText}</span>
                              ) : (
                                displayText
                              )
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!error && pagination.total > 0 && (
          <div className="px-4 pb-3">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={handlePageChange}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        {TABLE_PAGE_SIZE} records per page from the server — use Prev/Next to browse. Amber highlights
        indicate low-confidence fields.
      </p>
    </div>
  );
}
