import { uniform, uv, vec3 } from 'three/tsl';
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

  it('accepts a node step count', () => {
    expect(quantize(uv().x, uniform(4))).toBeDefined();
  });

  it('handles a node step count of 1 without throwing', () => {
    expect(() => quantize(uv().x, uniform(1))).not.toThrow();
  });

  it('accepts a threshold node in place of the 0.5 round', () => {
    expect(quantize(uv().x, 4, uv().y)).toBeDefined();
  });

  it('quantizes vec inputs component-wise', () => {
    expect(quantize(vec3(0.1, 0.5, 0.9), uniform(4), 0.25)).toBeDefined();
  });
});
