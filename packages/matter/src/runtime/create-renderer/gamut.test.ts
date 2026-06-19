import { DisplayP3ColorSpace, SRGBColorSpace } from 'three';
import { describe, expect, it } from 'vitest';

import { gamutToColorSpace } from './gamut.js';

describe('gamutToColorSpace', () => {
  it('maps srgb to three SRGBColorSpace', () => {
    expect(gamutToColorSpace('srgb')).toBe(SRGBColorSpace);
  });

  it('maps p3 to three DisplayP3ColorSpace', () => {
    expect(gamutToColorSpace('p3')).toBe(DisplayP3ColorSpace);
  });
});
