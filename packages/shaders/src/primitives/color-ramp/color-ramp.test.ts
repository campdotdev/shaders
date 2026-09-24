import { uv, vec3 } from 'three/tsl';
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { ColorRampStop } from './color-ramp.js';
import { colorRamp } from './color-ramp.js';

const stops = [
  { color: vec3(1, 0, 0), position: 0 },
  { color: vec3(0, 0, 1), position: 1 },
];

describe('colorRamp colorSpace', () => {
  it('builds with the default (linear) space', () => {
    expect(colorRamp(uv().x, stops)).toBeDefined();
  });

  it('builds for oklab and oklch', () => {
    expect(colorRamp(uv().x, stops, 'oklab')).toBeDefined();
    expect(colorRamp(uv().x, stops, 'oklch')).toBeDefined();
  });
});

describe('colorRamp stop positions', () => {
  // Compile-time check: tsc fails this file if a position widens past a
  // literal number. Positions are baked into the shader at build time.
  it('takes literal numbers only', () => {
    expectTypeOf<ColorRampStop['position']>().toEqualTypeOf<number>();
  });
});
