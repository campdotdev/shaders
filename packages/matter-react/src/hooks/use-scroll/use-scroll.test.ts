import { describe, expect, it } from 'vitest'

import { useScroll } from './use-scroll.js'

describe('useScroll', () => {
  it('exports a function', () => {
    expect(typeof useScroll).toBe('function')
  })
})
