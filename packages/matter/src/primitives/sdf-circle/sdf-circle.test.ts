import { uv, vec2 } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { sdfCircle } from './sdf-circle.js';

describe('sdfCircle', () => {
  it('returns a TSL node with a numeric radius', () => {
    const p = (uv() as unknown as { sub(v: unknown): unknown }).sub(vec2(0.5, 0.5));

    expect(sdfCircle(p as never, 0.25)).toBeDefined();
  });
});
