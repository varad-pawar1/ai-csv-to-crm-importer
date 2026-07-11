'use client';

import { useMemo, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { CrmRecord, CrmField } from '@/types/crm';
import { cn } from '@/lib/utils';

interface ResultTableProps {
  records: CrmRecord[];
  showSkipped?: boolean;
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

const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 40;

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

export function ResultTable({ records, showSkipped = true }: ResultTableProps) {
  const [filter, setFilter] = useState<'all' | 'imported' | 'skipped' | 'low-confidence'>('all');

  const filtered = useMemo(() => {
    let result = records;
    if (!showSkipped) result = result.filter((r) => !r._skipped);
    if (filter === 'imported') result = result.filter((r) => !r._skipped);
    if (filter === 'skipped') result = result.filter((r) => r._skipped);
    if (filter === 'low-confidence') {
      result = result.filter((r) =>
        DISPLAY_FIELDS.some((f) => {
          const conf = r._confidence?.[f];
          return conf === 'low' || conf === 'medium';
        })
      );
    }
    return result;
  }, [records, filter, showSkipped]);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const record = filtered[index];
    return (
      <div
        style={style}
        className={cn(
          'flex items-center border-b border-slate-100 dark:border-slate-800 text-sm',
          record._skipped && 'opacity-60'
        )}
      >
        <div className="w-10 shrink-0 px-2 text-slate-400 text-xs">{index + 1}</div>
        {DISPLAY_FIELDS.map((field) => (
          <div
            key={field}
            className={cn(
              'flex-1 min-w-[120px] px-2 truncate',
              getConfidenceClass(record, field, record[field])
            )}
            title={String(record[field] ?? record._skip_reason ?? '')}
          >
            {record[field] ?? (field === 'crm_note' && record._skip_reason ? (
              <span className="text-amber-600 text-xs">{record._skip_reason}</span>
            ) : (
              <span className="text-slate-300">—</span>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500">Filter:</span>
        {(['all', 'imported', 'skipped', 'low-confidence'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              filter === f
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            )}
          >
            {f.replace('-', ' ')}
          </button>
        ))}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} records</span>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div
          className="flex items-center bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300"
          style={{ height: HEADER_HEIGHT }}
        >
          <div className="w-10 shrink-0 px-2">#</div>
          {DISPLAY_FIELDS.map((field) => (
            <div key={field} className="flex-1 min-w-[120px] px-2">
              {field}
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No records match this filter</div>
        ) : (
          <List
            height={Math.min(480, filtered.length * ROW_HEIGHT + 2)}
            itemCount={filtered.length}
            itemSize={ROW_HEIGHT}
            width="100%"
            overscanCount={10}
          >
            {Row}
          </List>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Amber highlights indicate low-confidence or unmapped fields needing review.
      </p>
    </div>
  );
}
