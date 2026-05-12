import { describe, expect, it, beforeEach } from 'vite-plus/test'
import { time } from './tsl-reexports.js'
import { setReducedMotionPolicy, __resetReducedMotionForTests } from '../runtime/reducedMotion.js'

describe('gated time', () => {
  beforeEach(() => {
    __resetReducedMotionForTests()
    setReducedMotionPolicy('auto')
  })

  it('is a TSL node', () => {
    expect(time).toBeDefined()
    expect((time as unknown as { isNode?: boolean }).isNode).toBe(true)
  })

  // Note: We can't assert the actual scaled value without running on the GPU.
  // The gating is verified end-to-end via the docs-site demo in Task 5 and the
  // Playwright reduced-motion test in Phase 5.10.
})
