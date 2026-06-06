import { hash, mul, screenCoordinate } from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

export function filmGrain(
  intensity: ShaderNodeObject<Node> | number,
  timeOffset: ShaderNodeObject<Node> | number = 0,
): ShaderNodeObject<Node> {
  const pixel = screenCoordinate.xy.floor();
  // Convert to uint before multiplying so the seed arithmetic stays in exact
  // integer space. Float32 loses integer precision above 2^24 (~16.7M), and
  // pixel.y * 9277 exceeds that on 4K+ screens, corrupting the seed.
  const seed = pixel.x
    .toUint()
    .mul(1973)
    .add(pixel.y.toUint().mul(9277))
    .add(mul(timeOffset, 26699).toUint());

  return hash(seed).sub(0.5).mul(intensity);
}
