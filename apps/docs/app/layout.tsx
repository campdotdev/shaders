import './globals.css'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ThemeToggle } from './_components/ThemeToggle'
import { Providers } from './providers'

export const metadata = {
  title: 'Matter — React shader components',
  description: 'WebGPU + TSL shader components for React.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <header
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
              Matter
            </Link>
            <ThemeToggle />
          </header>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  )
}
