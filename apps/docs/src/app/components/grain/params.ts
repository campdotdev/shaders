import type { GrainBlend } from '@camp-dev/shaders';

export interface GrainParams {
  intensity: number;
  speed: number;
  blend: GrainBlend;
}

export const INITIAL: GrainParams = {
  intensity: 0.15,
  speed: 0.3,
  blend: 'additive',
};
