'use client';

interface ImportLoadingOverlayProps {
  message?: string;
  detail?: string;
}

export function ImportLoadingOverlay({
  message = 'Starting import...',
  detail = 'Uploading your file and preparing AI mapping',
}: ImportLoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
      <div className="flex flex-col items-center gap-6 text-center px-6 max-w-sm">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-full bg-brand-400/20 animate-ping [animation-duration:2s]" />
          <div className="absolute inset-1 rounded-full bg-brand-300/10 animate-pulse" />
          <div className="absolute inset-0 rounded-full border-4 border-brand-100 dark:border-brand-900" />
          <div className="absolute inset-0 rounded-full border-4 border-brand-600 border-t-transparent animate-spin" />
          <div className="absolute inset-3 rounded-full border-2 border-brand-400/50 border-b-transparent animate-spin [animation-duration:1.2s] [animation-direction:reverse]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-brand-600 animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-semibold text-lg text-slate-800 dark:text-slate-100 animate-fade-in">
            {message}
          </p>
          <p className="text-sm text-slate-500 animate-fade-in [animation-delay:100ms]">{detail}</p>
        </div>

        <div className="w-full space-y-2">
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border border-slate-300/80 dark:border-slate-600">
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700 animate-loading-bar" />
          </div>
          <div className="flex justify-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0ms]" />
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-bounce [animation-delay:150ms]" />
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
