import { vec3 } from 'three/tsl';
import { describe, expect, it } from 'vitest';

// Import through the barrel deliberately: this test pins the PUBLIC export,
// via a relative path so it runs against src without a build.
import { colorSpaces } from '../../index.js';

describe('colorSpaces export', () => {
  it('exposes oklab round-trip converters', () => {
    const coords = colorSpaces.oklab.fromLinear(vec3(0.5, 0.2, 0.8));

    expect(coords).toBeDefined();
    expect(colorSpaces.oklab.toLinear(coords)).toBeDefined();
  });
});
