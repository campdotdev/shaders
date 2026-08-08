import type { DitherPattern } from '@matter/registry/dither';

export interface DitherParams {
  pixelSize: number;
  levels: number;
  pattern: DitherPattern;
}

export const INITIAL: DitherParams = {
  pixelSize: 4,
  levels: 4,
  pattern: 'bayer-8x8',
};
