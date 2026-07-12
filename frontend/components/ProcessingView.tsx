'use client';

import { useEffect, useState } from 'react';
import { ImportProgress } from '@/types/crm';
import { formatNumber } from '@/lib/utils';
import { Card } from './ui/Card';
import { Alert } from './ui/Alert';
import { Brain, Layers, Sparkles, Wifi, WifiOff, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProcessingViewProps {
  progress: ImportProgress | null;
  batchFailures: Array<{ batchIndex: number; error: string }>;
  isConnected: boolean;
  connectionError: string | null;
}

type ProcessingPhase = 'queued' | 'batching' | 'ai' | 'finishing';

function getPhase(progress: ImportProgress | null): ProcessingPhase {
  if (!progress || progress.status === 'queued') return 'queued';
  if (progress.batchesDone >= progress.batchesTotal && progress.batchesTotal > 0) return 'finishing';
  if (progress.activeBatchIndex !== undefined) return 'ai';
  if (progress.status === 'processing') return 'batching';
  return 'queued';
}

const PHASES: Array<{ id: ProcessingPhase; label: string; icon: typeof Layers; description: string }> = [
  { id: 'queued', label: 'Queued', icon: Layers, description: 'Waiting to start' },
  { id: 'batching', label: 'Batching', icon: Layers, description: 'Splitting rows into batches' },
  { id: 'ai', label: 'AI Mapping', icon: Brain, description: 'Reading & mapping CSV columns' },
  { id: 'finishing', label: 'Finishing', icon: Sparkles, description: 'Saving mapped records' },
];

const ACTIVITY_MESSAGES = [
  'Detecting column headers…',
  'Mapping name & email fields…',
  'Normalizing phone numbers…',
  'Extracting city & company…',
  'Applying CRM status rules…',
  'Validating lead data…',
  'Writing mapped records…',
];

const PROGRESS_TRACK =
  'bg-slate-200 dark:bg-slate-700/90 border border-slate-300/80 dark:border-slate-600';
const PROGRESS_FILL =
  'bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]';

/** Row progress moves as batches finish; partial credit while a batch is active. */
function computeProgressPercent(progress: ImportProgress | null): number {
  if (!progress) return 0;

  const { batchesDone, batchesTotal, importedCount, skippedCount, totalRows, activeBatchIndex } =
    progress;

  const rowPercent =
    totalRows > 0 ? ((importedCount + skippedCount) / totalRows) * 100 : 0;

  let batchPercent = 0;
  if (batchesTotal > 0) {
    const inFlight =
      activeBatchIndex !== undefined && batchesDone < batchesTotal ? 0.5 / batchesTotal : 0;
    batchPercent = ((batchesDone / batchesTotal) + inFlight) * 100;
  }

  return Math.min(100, Math.round(Math.max(rowPercent, batchPercent)));
}

function AnimatedCounter({ value }: { value: number }) {
  return (
    <span key={value} className="inline-block tabular-nums animate-count-up">
      {formatNumber(value)}
    </span>
  );
}

function PhaseIcon({ phase, isActive }: { phase: ProcessingPhase; isActive: boolean }) {
  const iconClass = cn(
    'h-5 w-5 shrink-0',
    isActive ? 'text-brand-600 dark:text-brand-400' : 'text-current'
  );

  if (phase === 'ai' && isActive) {
    return (
      <div className="relative h-5 w-5 shrink-0">
        <Brain className={cn(iconClass, 'relative z-10 animate-pulse')} />
        <span className="absolute -inset-1 rounded-full bg-brand-400/30 dark:bg-brand-500/20 animate-ping" />
        <Sparkles className="h-2.5 w-2.5 text-brand-500 dark:text-brand-400 absolute -top-0.5 -right-0.5 animate-spin [animation-duration:2s]" />
      </div>
    );
  }

  if (phase === 'batching' && isActive) {
    return (
      <div className="relative h-5 w-5 shrink-0">
        <Layers className={cn(iconClass, 'animate-stack-pulse')} />
      </div>
    );
  }

  const Icon = PHASES.find((p) => p.id === phase)?.icon ?? Layers;
  return <Icon className={cn(iconClass, isActive && 'animate-pulse')} />;
}

function ActivityFeed({ phase, activeBatch }: { phase: ProcessingPhase; activeBatch: number | null }) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (phase !== 'ai' && phase !== 'batching') return;
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % ACTIVITY_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [phase]);

  if (phase !== 'ai' && phase !== 'batching') return null;

  const message = ACTIVITY_MESSAGES[messageIndex]!;

  return (
    <div
      className={cn(
        'mt-4 rounded-xl border p-4 animate-fade-in',
        'border-slate-200 dark:border-slate-700',
        'bg-slate-50 dark:bg-slate-800/80'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0 mt-0.5">
          <div className="h-10 w-10 rounded-full bg-brand-100 dark:bg-slate-700 flex items-center justify-center">
            {phase === 'ai' ? (
              <Brain className="h-5 w-5 text-brand-600 dark:text-brand-400 animate-pulse" />
            ) : (
              <Layers className="h-5 w-5 text-brand-600 dark:text-brand-400 animate-stack-pulse" />
            )}
          </div>
          <div className="absolute -inset-1 rounded-full border border-brand-300/50 dark:border-brand-600/40 animate-spin-slow" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {phase === 'ai'
              ? `AI is mapping your CSV${activeBatch ? ` — batch ${activeBatch}` : ''}`
              : 'Preparing batches for AI processing'}
          </p>
          <p
            key={message}
            className="text-xs text-slate-500 dark:text-slate-400 mt-1 animate-fade-in"
          >
            {message}
          </p>
          {phase === 'ai' && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {['name', 'email', 'phone', 'city', 'status'].map((field, i) => (
                <span
                  key={field}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full animate-field-pop',
                    'bg-white dark:bg-slate-700',
                    'text-brand-700 dark:text-brand-300',
                    'border border-brand-200 dark:border-slate-600'
                  )}
                  style={{ animationDelay: `${i * 180}ms` }}
                >
                  {field}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-1 shrink-0 pt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-brand-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-brand-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-brand-400 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

export function ProcessingView({
  progress,
  batchFailures,
  isConnected,
  connectionError,
}: ProcessingViewProps) {
  const percent = computeProgressPercent(progress);

  const phase = getPhase(progress);
  const activeBatch =
    progress?.activeBatchIndex !== undefined ? progress.activeBatchIndex + 1 : null;

  const rowsProcessed = (progress?.importedCount ?? 0) + (progress?.skippedCount ?? 0);

  const phaseIndex = PHASES.findIndex((p) => p.id === phase);
  const currentPhase = PHASES[phaseIndex]!;

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 processing-glow pointer-events-none" />

        <div className="relative flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Processing Import
              {(phase === 'ai' || phase === 'batching') && (
                <Zap className="h-4 w-4 text-brand-500 dark:text-brand-400 animate-pulse" />
              )}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 transition-all duration-500">
              {phase === 'ai' && activeBatch
                ? `AI is mapping batch ${activeBatch} of ${progress?.batchesTotal ?? 0}`
                : currentPhase.description}
            </p>
          </div>
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-300',
              isConnected
                ? 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300 dark:border dark:border-green-900/50'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:border dark:border-amber-900/50'
            )}
          >
            {isConnected ? (
              <>
                <Wifi className="h-3.5 w-3.5" />
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                Live
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 animate-pulse" />
                Reconnecting
              </>
            )}
          </div>
        </div>

        {connectionError && <Alert variant="warning" className="mb-4">{connectionError}</Alert>}

        <div className="relative flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {PHASES.map((p, i) => {
            const isActive = i === phaseIndex;
            const isDone = i < phaseIndex;
            return (
              <div key={p.id} className="flex items-center gap-2 flex-1 min-w-[120px]">
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-500 w-full border',
                    isActive &&
                      'bg-brand-50 dark:bg-slate-800 text-brand-700 dark:text-brand-300 border-brand-300 dark:border-brand-700/60 ring-2 ring-brand-300/50 dark:ring-brand-600/40 shadow-sm',
                    isDone &&
                      'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/50',
                    !isActive &&
                      !isDone &&
                      'bg-slate-50 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'
                  )}
                >
                  <PhaseIcon phase={p.id} isActive={isActive} />
                  <div className="min-w-0">
                    <span className="truncate block">{p.label}</span>
                    {isActive && (
                      <span className="text-[10px] text-brand-600/80 dark:text-brand-400/80 truncate block">
                        {p.description}
                      </span>
                    )}
                  </div>
                  {isActive && (
                    <span className="ml-auto flex gap-0.5 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-brand-400 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-brand-400 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-brand-400 animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                  {isDone && (
                    <span className="ml-auto text-green-500 dark:text-green-400 text-[10px] shrink-0">
                      ✓
                    </span>
                  )}
                </div>
                {i < PHASES.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 w-4 shrink-0 rounded transition-all duration-700',
                      isDone
                        ? 'bg-green-400 dark:bg-green-600 w-6'
                        : isActive
                          ? 'bg-brand-300 dark:bg-brand-600 animate-pulse w-5'
                          : 'bg-slate-200 dark:bg-slate-700'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="mb-2 flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">
            Batch {progress?.batchesDone ?? 0} of {progress?.batchesTotal ?? 0}
            {progress?.totalRows ? (
              <span className="text-slate-400 dark:text-slate-500">
                {' '}
                · {formatNumber(rowsProcessed)} / {formatNumber(progress.totalRows)} rows
              </span>
            ) : null}
          </span>
          <span className="font-medium tabular-nums text-brand-700 dark:text-brand-400">
            {percent}%
          </span>
        </div>

        <div
          className={cn('h-4 rounded-full overflow-hidden relative', PROGRESS_TRACK)}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn(
              'h-full min-w-[8px] transition-all duration-700 ease-out rounded-full relative overflow-hidden',
              PROGRESS_FILL
            )}
            style={{ width: `${Math.max(percent, percent > 0 ? 4 : 2)}%` }}
          >
            <div className="absolute inset-0 progress-shimmer" />
            {phase !== 'finishing' && <div className="absolute inset-0 progress-wave" />}
          </div>
          {(phase === 'ai' || phase === 'batching') && percent < 100 && (
            <div className="absolute top-0 h-full w-10 bg-white/30 dark:bg-brand-300/20 blur-sm animate-progress-indeterminate pointer-events-none" />
          )}
        </div>

        <ActivityFeed phase={phase} activeBatch={activeBatch} />

        <div className="grid grid-cols-3 gap-4 mt-6 text-center">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 transition-all duration-300">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              <AnimatedCounter value={progress?.totalRows ?? 0} />
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total Rows</p>
          </div>
          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900/50 transition-all duration-300">
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              <AnimatedCounter value={progress?.importedCount ?? 0} />
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Imported</p>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50 transition-all duration-300">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              <AnimatedCounter value={progress?.skippedCount ?? 0} />
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Skipped</p>
          </div>
        </div>
      </Card>

      {batchFailures.length > 0 && (
        <Card>
          <h4 className="font-medium text-red-700 dark:text-red-300 mb-3">
            Batch Failures ({batchFailures.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-auto">
            {batchFailures.map((f) => (
              <Alert key={f.batchIndex} variant="error">
                <span className="font-medium">Batch {f.batchIndex + 1}:</span> {f.error}
              </Alert>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            Failed batches were retried automatically. Other batches continue processing.
          </p>
        </Card>
      )}
    </div>
  );
}
