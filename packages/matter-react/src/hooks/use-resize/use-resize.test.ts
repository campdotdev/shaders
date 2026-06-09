import { describe, expect, it } from 'vitest';

import { useResize } from './use-resize.js';

describe('useResize', () => {
  it('exports a function', () => {
    expect(typeof useResize).toBe('function');
  });
});
