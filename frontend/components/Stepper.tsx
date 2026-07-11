import { cn } from '@/lib/utils';
import { ImportStep } from '@/types/crm';
import { Check } from 'lucide-react';

const STEPS: { id: ImportStep; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'preview', label: 'Preview' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'processing', label: 'Processing' },
  { id: 'result', label: 'Result' },
];

interface StepperProps {
  currentStep: ImportStep;
}

export function Stepper({ currentStep }: StepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <nav aria-label="Import progress" className="mb-8">
      <ol className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <li key={step.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                    isComplete && 'bg-brand-600 text-white',
                    isCurrent && 'bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 ring-2 ring-brand-600',
                    !isComplete && !isCurrent && 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium hidden sm:block',
                    isCurrent ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 flex-1',
                    isComplete ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
