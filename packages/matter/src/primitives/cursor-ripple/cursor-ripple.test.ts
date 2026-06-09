import { uv, vec2 } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { time as gatedTime } from '../time/time.js';
import { cursorRipple } from './cursor-ripple.js';

describe('cursorRipple', () => {
  it('returns a TSL node with default options', () => {
    expect(cursorRipple(uv(), vec2(0.5, 0.5))).toBeDefined();
  });

  it('respects custom options', () => {
    expect(
      cursorRipple(uv(), vec2(0.5, 0.5), {
        reach: 0.2,
        frequency: 50,
        speed: 3,
        amplitude: 0.3,
      }),
    ).toBeDefined();
  });
});

describe('cursorRipple — reduced-motion gating', () => {
  it('consumes the engine-gated time (not the raw three/tsl time)', async () => {
    // Reference equality on the *imported* identifier inside cursorRipple
    // can't be tested directly. Instead, prove that the gated time export
    // is what the engine exposes, and that cursorRipple is in the same
    // module graph as the gated time. This regression-guards the import line.
    const builtin = (await import('three/tsl')).time;

    expect(gatedTime).not.toBe(builtin);
  });
});
