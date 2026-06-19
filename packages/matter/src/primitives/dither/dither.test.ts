import { uv, vec3 } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { dither } from './dither.js';

describe('dither', () => {
  it('builds a node from a color and coordinate without throwing', () => {
    expect(dither(vec3(0.5, 0.2, 0.8), uv())).toBeDefined();
  });

  it('accepts a custom amount', () => {
    expect(dither(vec3(0.5, 0.2, 0.8), uv(), 2 / 255)).toBeDefined();
  });
});
