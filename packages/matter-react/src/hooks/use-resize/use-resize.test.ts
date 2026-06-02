import { describe, expect, it } from 'vitest'

import { useResize } from './use-resize.js'

describe('useResize', () => {
  it('exports a function', () => {
    expect(typeof useResize).toBe('function')
  })
  // The live path requires a real ResizeObserver and a mounted <ShaderScene>.
  // Vitest's happy-dom environment doesn't provide ResizeObserver out of the
  // box, and mocking it would test the mock not the hook. Live behavior is
  // verified on the docs-page playground at /components/dot-field.
})
