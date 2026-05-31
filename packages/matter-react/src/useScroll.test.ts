import { describe, expect, it } from 'vitest'

import { useScroll } from './useScroll.js'

describe('useScroll', () => {
  it('exports a function', () => {
    expect(typeof useScroll).toBe('function')
  })
  // The live path requires a real window with a mutable scrollY and a
  // measurable documentElement.scrollHeight. Vitest's happy-dom doesn't model
  // layout, so a meaningful integration test would test our mocks not the
  // hook. Live behavior is exercised on the docs site (no v1 component
  // consumes useScroll, but the hook is exported for users).
})
