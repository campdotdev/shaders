'use client'

import type { ReactNode } from 'react'
// matter-internal alias used to exercise the rewriter in Phase 2.6.
import { something } from '@matter-internal/lib'

export interface SyntheticProps {
  children?: ReactNode
}

export function SyntheticComponent({ children }: SyntheticProps) {
  return <div data-something={String(something)}>{children}</div>
}
