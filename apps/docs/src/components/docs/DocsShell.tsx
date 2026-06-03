import type { ReactNode } from 'react'

import { getDocsNavTree } from '@/content/nav'

import { DocsSidebar } from './DocsSidebar'

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
