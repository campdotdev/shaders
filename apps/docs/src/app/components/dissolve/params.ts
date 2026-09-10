import type { DissolveTuning } from '@camp-dev/shaders';

export interface DissolveParams {
  progress: number;
  pixelSize: number;
  tuning: DissolveTuning;
}

export const INITIAL: DissolveParams = {
  progress: 0.5,
  pixelSize: 4,
  tuning: { fadeWidth: 0.08, grain: 0.3, noiseFrequency: 2.5 },
};
