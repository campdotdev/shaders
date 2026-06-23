import { vec3, vec4 } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { dither } from './dither.js';

describe('dither', () => {
  it('builds a node from a color without throwing', () => {
    expect(dither(vec3(0.5, 0.2, 0.8))).toBeDefined();
  });

  it('accepts a custom amount', () => {
    expect(dither(vec3(0.5, 0.2, 0.8), 2 / 255)).toBeDefined();
  });

  // Regression guard: dither must accept a vec4 (alpha-bearing) input. The
  // output preserves that alpha rather than collapsing to a vec3, so a
  // transparent input stays transparent instead of flashing opaque black.
  it('accepts an alpha-bearing color', () => {
    expect(dither(vec4(0, 0, 0, 0))).toBeDefined();
  });
});
