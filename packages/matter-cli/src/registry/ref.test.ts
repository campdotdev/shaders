import { describe, expect, it } from 'vitest'

import { resolveRef } from './ref.js'

describe('resolveRef', () => {
  it('returns the explicit ref when supplied', () => {
    expect(resolveRef('v1.2.3', '0.0.0')).toBe('v1.2.3')
    expect(resolveRef('main', '0.5.0')).toBe('main')
  })

  it('falls back to "main" when no ref and CLI version is 0.0.0 (dev build)', () => {
    expect(resolveRef(undefined, '0.0.0')).toBe('main')
  })

  it('uses v<version> as ref when no explicit ref and CLI is a real release', () => {
    expect(resolveRef(undefined, '0.1.0')).toBe('v0.1.0')
    expect(resolveRef(undefined, '1.2.3')).toBe('v1.2.3')
  })
})
