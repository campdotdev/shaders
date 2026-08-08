import type { DitherPattern } from '@matter/registry/dither';

export interface DitherParams {
  pixelSize: number;
  levels: number;
  spread: number;
  threshold: number;
  pattern: DitherPattern;
}

export const INITIAL: DitherParams = {
  pixelSize: 2,
  levels: 4,
  spread: 1,
  threshold: 1,
  pattern: 'bayer-8x8',
};
