'use client';

import { useMemo } from 'react';

interface CsvPreviewTableProps {
  headers: string[];
  rows: Record<string, string>[];
  maxRows?: number;
}

export function CsvPreviewTable({ headers, rows, maxRows = 50 }: CsvPreviewTableProps) {
  const displayRows = useMemo(() => rows.slice(0, maxRows), [rows, maxRows]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Showing {displayRows.length} of {rows.length} rows
        </span>
        <span>{headers.length} columns</span>
      </div>

      <div className="relative overflow-auto max-h-[480px] rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm" role="table">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 w-12">
                #
              </th>
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800"
              >
                <td className="px-3 py-2 text-slate-400">{rowIndex + 1}</td>
                {headers.map((header) => (
                  <td
                    key={header}
                    className="px-3 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[200px] truncate"
                    title={row[header] ?? ''}
                  >
                    {row[header] || <span className="text-slate-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
