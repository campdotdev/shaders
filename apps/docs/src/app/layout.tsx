import { IBM_Plex_Mono } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { SearchBar } from '@/components/SearchBar';

import './globals.css';

/* Exposed as --font-plex-mono, which tokens.css folds into --font-mono. The
   sans face (PP Mori) is licensed and not committed, so it has no loader here;
   its stack in tokens.css falls back to system fonts. */
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-plex-mono',
});

export const metadata = {
  title: 'Shaders — React shader components',
  description: 'WebGPU + TSL shader components for React.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={plexMono.variable} lang="en">
      <body>
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
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
