'use client'

import type { ReactNode } from 'react'
// matter-internal alias used to exercise the rewriter in Phase 2.6.
// oxlint-disable-next-line typescript/no-require-imports -- intentionally synthetic import for rewriter tests
// @ts-expect-error -- intentional fake module for rewriter fixture
import { something } from '@matter-internal/lib'

export interface SyntheticProps {
  children?: ReactNode
}

export function SyntheticComponent({ children }: SyntheticProps) {
  return <div data-something={String(something)}>{children}</div>
}
