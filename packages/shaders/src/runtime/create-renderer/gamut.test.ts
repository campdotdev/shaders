import { ColorManagement, SRGBColorSpace } from 'three';
import { DisplayP3ColorSpace } from 'three/examples/jsm/math/ColorSpaces.js';
import { describe, expect, it } from 'vitest';

import { defineDisplayP3ColorSpaces, gamutToColorSpace } from './gamut.js';

describe('gamutToColorSpace', () => {
  it('maps srgb to three SRGBColorSpace', () => {
    expect(gamutToColorSpace('srgb')).toBe(SRGBColorSpace);
  });

  it('maps p3 to three DisplayP3ColorSpace', () => {
    expect(gamutToColorSpace('p3')).toBe(DisplayP3ColorSpace);
  });
});

describe('defineDisplayP3ColorSpaces', () => {
  it('registers the P3 spaces on demand and is safe to call twice', () => {
    defineDisplayP3ColorSpaces();
    defineDisplayP3ColorSpaces();
    // three's getPrimaries reads COLOR_SPACES[name].primaries and throws a
    // TypeError for a name that was never defined, so a value coming back
    // proves the definition took.
    expect(ColorManagement.getPrimaries(DisplayP3ColorSpace)).toBeDefined();
  });
});
