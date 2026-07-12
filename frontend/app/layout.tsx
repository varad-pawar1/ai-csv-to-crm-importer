import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppHeader } from '@/components/AppHeader';

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
          <AppHeader />
          <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
