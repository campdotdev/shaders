import Link from 'next/link';
import type { ReactNode } from 'react';

import { SearchBar } from '@/components/SearchBar';
import { ThemeToggle } from '@/components/ThemeToggle';

import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'Shaders — React shader components',
  description: 'WebGPU + TSL shader components for React.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <header
            data-pagefind-ignore="all"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1.5rem',
              background: 'var(--bg)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <Link href="/" style={{ fontWeight: 600, color: 'var(--fg)' }}>
              Shaders
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <SearchBar />
              <ThemeToggle />
            </div>
          </header>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
