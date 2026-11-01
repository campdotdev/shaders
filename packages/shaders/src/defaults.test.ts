// @vitest-environment node
//
// The subpath's contract is that it never reaches three. With no DOM
// environment `self` is undefined, and three/webgpu reads `self` at module
// load, so if anything below ./defaults.js drags three back in, this file
// throws while importing and the suite fails here.
import { describe, expect, it } from 'vitest';

import { STYLE_DIAL_DEFAULTS } from './defaults.js';

describe('@camp-dev/shaders/defaults', () => {
  it('runs with no DOM globals present', () => {
    // Guards the guard, as color.test.ts does.
    expect(typeof self).toBe('undefined');
  });

  it("exposes FractalNoise's style dial defaults", () => {
    expect(STYLE_DIAL_DEFAULTS.veins).toEqual({ contrast: 1, balance: 0.8 });
  });
});
