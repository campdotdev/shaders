import type { ReactNode } from 'react'
import { DocsShell } from '@/components/docs/DocsShell'

export default function ComponentsLayout({ children }: { children: ReactNode }) {
  return <DocsShell>{children}</DocsShell>
}
