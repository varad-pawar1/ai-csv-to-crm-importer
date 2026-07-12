'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

function getPageNumbers(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];
  if (page > 3) pages.push('ellipsis');

  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (page < totalPages - 2) pages.push('ellipsis');
  pages.push(totalPages);
  return pages;
}

export function Pagination({ page, totalPages, total, onPageChange, isLoading }: PaginationProps) {
  const pages = getPageNumbers(page, totalPages);
  const atStart = page <= 1 || isLoading;
  const atEnd = page >= totalPages || isLoading;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
      <p className="text-sm text-slate-500">
        Page <span className="font-medium text-slate-700 dark:text-slate-300">{page}</span> of{' '}
        <span className="font-medium text-slate-700 dark:text-slate-300">{totalPages}</span>
        <span className="text-slate-400"> · </span>
        {total.toLocaleString()} total
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          disabled={atStart}
          onClick={() => onPageChange(1)}
          aria-label="First page"
          className="px-2"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="secondary"
          size="sm"
          disabled={atStart}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Prev</span>
        </Button>

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-slate-400 select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              disabled={isLoading}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'min-w-[2rem] h-8 rounded-md text-sm font-medium transition-colors',
                p === page
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50'
              )}
            >
              {p}
            </button>
          )
        )}

        <Button
          variant="secondary"
          size="sm"
          disabled={atEnd}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          variant="secondary"
          size="sm"
          disabled={atEnd}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
          className="px-2"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
