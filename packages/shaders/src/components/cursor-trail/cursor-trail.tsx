'use client';

// Public controls for a cursor effect that heats the image along the
// pointer's recent path, so the pointer leaves a trail that tapers from its
// head and shortens into it when the pointer stops. The shader half records
// the path and reads the scene's shared cursor Input.
// Numeric controls ride uniforms, so animation signals keep the material stable.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { CursorTrailShader } from './shader.js';

export interface CursorTrailProps {
  /**
   * Brush radius in canvas heights, with a soft edge. 0 turns the effect
   * off and clears the trail. Defaults to 0.1. Accepts a static value or an animation signal.
   */
  radius?: AnimatableProp<number>;
  /**
   * Light added at full heat, in linear color. 0 disables the effect.
   * Defaults to 0.5. Accepts a static value or an animation signal.
   */
  intensity?: AnimatableProp<number>;
  /**
   * Seconds a stopped pointer's trail takes to draw in. A moving pointer
   * trails about as far as it travels in this time, so a faster pointer
   * leaves a longer trail. 0 keeps no trail.
   * Defaults to 0.75. Accepts a static value or an animation signal.
   */
  decay?: AnimatableProp<number>;
  /**
   * Keep a steady spot under a still pointer. Off, a pointer that stops
   * leaves nothing: the trail shortens into the pointer as the head fades.
   * On, the trail shortens into a spot that stays while the pointer rests
   * on the canvas, and fades once it leaves. Defaults to false.
   */
  hold?: boolean;
  /**
   * How much a fast pointer widens the trail, as a share of `radius`: 0.5
   * makes it up to half again as wide. The whole trail eases back to
   * `radius` as the pointer slows, so a held spot settles to its base size
   * once the pointer stops. 0 keeps one size at every speed. Defaults to
   * 0.3. Accepts a static value or an animation signal.
   */
  grow?: AnimatableProp<number>;
  /**
   * How far along the path, in canvas heights, the trail averages the
   * pointer's positions, so it follows a smoother curve than the pointer
   * took. The head stays on the pointer; the averaging reaches full
   * strength this far behind it. 0 follows the pointer's path exactly,
   * with only the corners between frames rounded. Defaults to 0.05.
   * Accepts a static value or an animation signal.
   */
  smoothing?: AnimatableProp<number>;
}

export function CursorTrail({
  radius = 0.1,
  intensity = 0.5,
  decay = 0.75,
  hold = false,
  grow = 0.3,
  smoothing = 0.05,
}: CursorTrailProps) {
  return (
    <CursorTrailShader
      decay={decay}
      grow={grow}
      hold={hold}
      intensity={intensity}
      radius={radius}
      smoothing={smoothing}
    />
  );
}
