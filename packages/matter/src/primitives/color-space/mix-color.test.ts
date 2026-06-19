import { uv, vec3 } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { mixColor } from './mix-color.js';
import type { ColorSpace } from './types.js';

const SPACES: ColorSpace[] = ['linear', 'oklab', 'oklch', 'lch', 'hsl', 'hsv'];

describe('mixColor', () => {
  it('builds a node for every color space without throwing', () => {
    const red = vec3(1, 0, 0);
    const blue = vec3(0, 0, 1);

    for (const space of SPACES) {
      expect(mixColor(red, blue, uv().x, space)).toBeDefined();
    }
  });

  it('defaults to oklab', () => {
    expect(mixColor(vec3(1, 0, 0), vec3(0, 0, 1), uv().x)).toBeDefined();
  });

  // Extended (out-of-sRGB) endpoints must still build — the result is no longer
  // clamped to [0,1], so wide-gamut values survive to the renderer's output encode.
  it('builds for extended (out-of-sRGB) endpoints', () => {
    const extendedRed = vec3(1.2, -0.04, -0.02);
    const extendedGreen = vec3(-0.1, 1.1, -0.05);

    expect(mixColor(extendedRed, extendedGreen, uv().x, 'oklab')).toBeDefined();
  });
});
