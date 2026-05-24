import type { ReactNode } from 'react'

/**
 * Minimal docs-content layout. M8.3 replaces this with the full
 * DocsShell (sidebar, breadcrumbs, TOC, prev/next). For now this just
 * gives MDX prose pages a reasonable line width.
 */
export default function DocsContentLayout({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '2.5rem 1.5rem 6rem',
        lineHeight: 1.65,
      }}
    >
      {children}
    </main>
  )
}
