import { IBM_Plex_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/site-header/site-header';

import './globals.css';

/* Each face is exposed as a CSS variable that tokens.css folds into its font
   stack: --font-plex-mono into --font-mono, --font-pp-mori into --font-sans.
   PP Mori is a licensed Pangram Pangram face served from src/app/fonts in the
   two weights the site uses. */
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-plex-mono',
});

const ppMori = localFont({
  src: [
    { path: './fonts/PPMori-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/PPMori-Semibold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-pp-mori',
});

export const metadata = {
  title: 'Shaders — React shader components',
  description: 'WebGPU + TSL shader components for React.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={`${plexMono.variable} ${ppMori.variable}`} lang="en">
      <body>
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
