import type { DitherPattern } from '@shaders/registry/dither';

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
  spread: 0.5,
  threshold: 1,
  pattern: 'bayer-8x8',
};
