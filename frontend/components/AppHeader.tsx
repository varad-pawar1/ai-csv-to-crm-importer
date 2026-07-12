import dynamic from 'next/dynamic';
import { CONTENT_MAX_WIDTH } from '@/lib/constants';
import { cn } from '@/lib/utils';

const ThemeToggle = dynamic(
  () => import('@/components/ThemeToggle').then((m) => m.ThemeToggle),
  { ssr: false }
);

export function AppHeader() {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className={cn(CONTENT_MAX_WIDTH, 'max-w-6xl mx-auto w-full min-w-0 px-4 sm:px-6 py-4 flex items-center justify-between')}>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">
            G
          </div>
          <div>
            <h1 className="text-lg font-semibold">GrowEasy CSV Importer</h1>
            <p className="text-xs text-slate-500">AI-powered lead mapping</p>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
