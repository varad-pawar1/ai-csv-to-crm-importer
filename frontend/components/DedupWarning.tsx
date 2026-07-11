'use client';

import { DedupPolicy, DuplicateGroup } from '@/types/crm';
import { Alert } from './ui/Alert';
import { Card } from './ui/Card';
import { cn } from '@/lib/utils';

interface DedupWarningProps {
  duplicates: DuplicateGroup[];
  policy: DedupPolicy;
  onPolicyChange: (policy: DedupPolicy) => void;
}

export function DedupWarning({ duplicates, policy, onPolicyChange }: DedupWarningProps) {
  if (duplicates.length === 0) return null;

  return (
    <Card>
      <Alert variant="warning" className="mb-4">
        Found {duplicates.length} duplicate group(s) by email or phone in this CSV.
      </Alert>

      <div className="space-y-3 mb-4 max-h-40 overflow-auto">
        {duplicates.slice(0, 10).map((dup, i) => (
          <div
            key={`${dup.type}-${dup.key}-${i}`}
            className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
          >
            <span className="font-medium capitalize">{dup.type}:</span>
            <span className="font-mono">{dup.key}</span>
            <span className="text-slate-400">→ rows {dup.rowIndices.map((r) => r + 1).join(', ')}</span>
          </div>
        ))}
        {duplicates.length > 10 && (
          <p className="text-xs text-slate-400">...and {duplicates.length - 10} more</p>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-medium mb-2">How should duplicates be handled?</legend>
        <div className="flex flex-col sm:flex-row gap-3">
          {(
            [
              { value: 'keep_both', label: 'Keep both', desc: 'Import all rows as separate records' },
              { value: 'merge', label: 'Merge', desc: 'Combine duplicate rows, keep first as primary' },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex-1 flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                policy === option.value
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
              )}
            >
              <input
                type="radio"
                name="dedupPolicy"
                value={option.value}
                checked={policy === option.value}
                onChange={() => onPolicyChange(option.value)}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium">{option.label}</p>
                <p className="text-xs text-slate-500">{option.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>
    </Card>
  );
}
