'use client'

import { something } from '@matter-internal/lib'
import type { ReactNode } from 'react'

export interface SyntheticProps {
  children?: ReactNode
}

export function SyntheticComponent({ children }: SyntheticProps) {
  return <div data-something={String(something)}>{children}</div>
}
