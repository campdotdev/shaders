import { DisplayP3ColorSpace, SRGBColorSpace } from 'three';

/** The output color gamut the renderer encodes its framebuffer for. */
export type OutputGamut = 'srgb' | 'p3';

/**
 * Map a resolved output gamut to the three color-space constant for
 * `renderer.outputColorSpace`. `'p3'` selects Display P3; `'srgb'` the default.
 */
export function gamutToColorSpace(gamut: OutputGamut): string {
  return gamut === 'p3' ? DisplayP3ColorSpace : SRGBColorSpace;
}
