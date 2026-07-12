'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PREVIEW_PAGE_SIZE } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Pagination } from './ui/Pagination';

interface CsvPreviewTableProps {
  headers: string[];
  rows: Record<string, string>[];
  pageSize?: number;
}

const ROW_HEIGHT_CLASS = 'h-[40px]';

export function CsvPreviewTable({ headers, rows, pageSize = PREVIEW_PAGE_SIZE }: CsvPreviewTableProps) {
  const [page, setPage] = useState(1);
  const tableRef = useRef<HTMLDivElement>(null);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [rows.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const displayRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const startRow = rows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, rows.length);
  const emptyRows = Math.max(0, pageSize - displayRows.length);

  return (
    <div ref={tableRef} className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <span>
          {rows.length === 0
            ? 'No rows'
            : `Rows ${startRow.toLocaleString()}–${endRow.toLocaleString()} of ${rows.length.toLocaleString()}`}
        </span>
        <span>
          {headers.length} columns · {pageSize} rows per page · {totalPages} page
          {totalPages === 1 ? '' : 's'}
        </span>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden min-w-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" role="table">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300 w-12">
                  #
                </th>
                {headers.map((header) => (
                  <th
                    key={header}
                    className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ minHeight: pageSize * 40 }}>
              {displayRows.map((row, rowIndex) => (
                <tr
                  key={startRow + rowIndex}
                  className={cn('border-b border-slate-100 dark:border-slate-800', ROW_HEIGHT_CLASS)}
                >
                  <td className="px-3 py-2 text-slate-400 text-xs align-middle">{startRow + rowIndex}</td>
                  {headers.map((header) => (
                    <td
                      key={header}
                      className="px-3 py-2 text-slate-700 dark:text-slate-300 align-middle whitespace-nowrap"
                      title={row[header] ?? undefined}
                    >
                      {row[header] || <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
              {emptyRows > 0 &&
                Array.from({ length: emptyRows }).map((_, i) => (
                  <tr
                    key={`empty-${i}`}
                    className={cn('border-b border-slate-100/50 dark:border-slate-800/50', ROW_HEIGHT_CLASS)}
                    aria-hidden="true"
                  >
                    <td colSpan={headers.length + 1} />
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <div className="px-4 pb-3">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={rows.length}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
