/**
 * The Reactive card's LiquidGradient settings (SHA-216). The bands run from
 * a deep violet in the upper right, where the arrow sits on a dark ground as
 * it does in the mock, through violet and purple to a pale magenta in the
 * lower left. The held smudge drags the bright corner up toward the arrow.
 * The flow never drifts, so reactive-scene.tsx holds `speed` at a literal 0
 * and these settings leave it out.
 */
import { paletteOklch } from '@/lib/palette';
import type { PositionedStop } from '@/lib/stops';

interface ReactiveGradient {
  angle: number;
  repeat: number;
  softness: number;
  swirl: number;
  scale: number;
  seed: number;
  stops: PositionedStop[];
}

// 50 degrees of hue across the stops, with 0.14 to 0.26 of lightness
// between each pair. The darkest stop sits at the window's own lightness.
export const REACTIVE_GRADIENT: ReactiveGradient = {
  // 225 runs the stops from the upper right to the lower left.
  angle: 225,
  repeat: 1,
  softness: 1,
  swirl: 0.9,
  scale: 1.5,
  seed: 0,
  stops: [
    { color: paletteOklch.violet[2], position: 0 },
    { color: paletteOklch.violet[6], position: 0.55 },
    { color: paletteOklch.purple[9], position: 0.8 },
    { color: paletteOklch.magenta[10], position: 1 },
  ],
};
