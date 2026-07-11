import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeToggle } from '@/components/ThemeToggle';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GrowEasy CSV Importer',
  description: 'AI-powered CSV to CRM lead importer for GrowEasy',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="min-h-screen">
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
          <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
