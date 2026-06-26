import type { GrainBlend } from '@matter/registry/grain';

export interface GrainParams {
  intensity: number;
  speed: number;
  grainBlend: GrainBlend;
}

export const INITIAL: GrainParams = {
  intensity: 0.15,
  speed: 0.3,
  grainBlend: 'additive',
};
