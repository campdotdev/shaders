import type { ReactNode } from 'react'
import { getDocsNavTree } from '@/content/nav'
import { DocsSidebar } from './DocsSidebar'

/**
 * Docs shell — 2-column desktop layout (sidebar + content).
 * Mobile/responsive treatment intentionally deferred; the user's Figma
 * design pass will refine. For now, narrow viewports just get cramped.
 */
export async function DocsShell({ children }: { children: ReactNode }) {
  const tree = await getDocsNavTree()
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '240px minmax(0, 1fr)',
        gap: '2.5rem',
        maxWidth: 1280,
        margin: '0 auto',
        padding: '2rem 1.5rem 6rem',
      }}
    >
      <DocsSidebar tree={tree} />
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  )
}
