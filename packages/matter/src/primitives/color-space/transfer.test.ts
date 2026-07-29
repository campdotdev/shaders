import { uv } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { linearToSrgb, srgbToLinear } from './transfer.js';

describe('TSL transfer nodes', () => {
  it('build without throwing', () => {
    expect(srgbToLinear(uv())).toBeDefined();
    expect(linearToSrgb(uv())).toBeDefined();
  });
});
