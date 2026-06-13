import { uv } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { quantize } from './quantize.js';

describe('quantize', () => {
  it('returns a TSL node for steps > 1', () => {
    const quantizedValue = quantize(uv().x, 4);

    expect(quantizedValue).toBeDefined();
  });

  it('handles steps=1 without throwing', () => {
    expect(() => quantize(uv().x, 1)).not.toThrow();
  });

  it('handles steps=2', () => {
    const quantizedValue = quantize(uv().x, 2);

    expect(quantizedValue).toBeDefined();
  });
});
