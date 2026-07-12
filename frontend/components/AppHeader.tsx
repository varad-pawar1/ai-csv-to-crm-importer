import dynamic from 'next/dynamic';

const ThemeToggle = dynamic(
  () => import('@/components/ThemeToggle').then((m) => m.ThemeToggle),
  { ssr: false }
);

export function AppHeader() {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
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
