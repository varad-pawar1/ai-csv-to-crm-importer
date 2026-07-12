import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppHeader } from '@/components/AppHeader';
import { CONTENT_MAX_WIDTH } from '@/lib/constants';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GrowEasy CSV Importer',
  description: 'AI-powered CSV to CRM lead importer for GrowEasy',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="min-h-screen overflow-x-hidden">
          <AppHeader />
          <main className={cn(CONTENT_MAX_WIDTH, 'max-w-6xl mx-auto w-full min-w-0 px-4 sm:px-6 py-8')}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
