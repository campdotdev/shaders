import { describe, expect, it } from 'vitest';

// Import through the barrel deliberately: this test pins the PUBLIC surface,
// via a relative path so it runs against src without a build.
import * as shaders from '../../index.js';

describe('color-space public surface', () => {
  it('keeps the colorSpaces registry internal', () => {
    expect(shaders).not.toHaveProperty('colorSpaces');
  });

  it('still exports the primitives that blend through it', () => {
    expect(shaders.colorRamp).toBeTypeOf('function');
    expect(shaders.mixColor).toBeTypeOf('function');
  });
});
