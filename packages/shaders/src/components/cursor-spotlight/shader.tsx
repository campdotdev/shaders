'use client';

// The spotlight's GPU half: a post-process pass that measures each pixel's
// distance from a point and scales the already-rendered image up near it.
// It reads nothing from the components beneath, only the composed pixel, so
// it works over any scene. The wrapper (./cursor-spotlight.tsx) feeds it the
// scene's shared pointer and presence; this file takes both as plain
// animatable props, so it knows nothing about where the point comes from.
import { length, max, smoothstep, uv, vec2, vec4 } from 'three/tsl';

import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatablePoint } from '../../react/hooks/use-animatable-point/use-animatable-point.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useAspectUniform } from '../../react/hooks/use-aspect-uniform/use-aspect-uniform.js';
import { usePostProcessPass } from '../../react/hooks/use-overlay-pass/use-overlay-pass.js';

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/**
 * How much of `radius` the light spends fading out, 0..1. At 1 the fade
 * starts at the pointer itself, so the light peaks there and eases to
 * nothing at `radius`, with no flat core. Lower values hold full strength
 * out to `radius * (1 - SOFTNESS)` before the fade begins, which reads as
 * a stage spotlight with a visible disc. 0.9 keeps a small full-strength
 * core, a tenth of the radius, so the light has a center without a
 * visible edge. Chosen by feel at the defaults gate.
 */
const SOFTNESS = 0.9;

/**
 * Smallest reach the falloff's smoothstep may use, in canvas units. Both
 * GLSL ES and WGSL need a smoothstep's upper edge strictly above its lower
 * one (WGSL divides by their difference), so a `radius` of 0 or below
 * clamps to this. It reaches less than a pixel, so it reads as the light
 * switched off.
 */
const MIN_RADIUS = 1e-4;

export interface CursorSpotlightShaderProps {
  /**
   * Where the light sits, 0..1 across the canvas with `[0, 0]` at the
   * top-left. Accepts a static value or an animation signal.
   */
  center: AnimatableProp<readonly [number, number]>;
  /**
   * How much of the light is on, 0..1. It multiplies the whole brighten, so
   * 0 leaves every pixel exactly as it was. Accepts a static value or an
   * animation signal.
   */
  presence: AnimatableProp<number>;
  /**
   * Reach of the light from `center`, in canvas units where 1 is the canvas
   * height. Accepts a static value or an animation signal.
   */
  radius: AnimatableProp<number>;
  /**
   * How much brighter the image gets at `center`. 0 is off and 1 doubles
   * it. Accepts a static value or an animation signal.
   */
  intensity: AnimatableProp<number>;
}

export function CursorSpotlightShader({
  center,
  presence,
  radius,
  intensity,
}: CursorSpotlightShaderProps) {
  // Every input lives in a uniform, a value the CPU writes and the GPU
  // reads at each draw, so moving the pointer or dragging a dial is a write
  // and a repaint, never a rebuild of the output chain.
  const presenceUniform = useAnimatableUniform<number>(presence);
  const radiusUniform = useAnimatableUniform<number>(radius);
  const intensityUniform = useAnimatableUniform<number>(intensity);
  // The pair is already in the pass's frame, [0, 0] at the top-left with y
  // growing downward, which is the frame uv() has in a post-process pass.
  // So it needs no conversion, as in radial-wipe's shader.
  const centerUniform = useAnimatablePoint(center);
  const aspectUniform = useAspectUniform();

  // A post-process pass: the callback receives each already-rendered pixel
  // (`input`, rgba) and returns a replacement.
  usePostProcessPass(
    (input) => {
      // ---------------------------------------------
      // Distance from the light, in canvas heights
      // ---------------------------------------------
      // uv() is the pixel's 0..1 position on the canvas. Subtracting the
      // center gives the offset to the light. uv x spans the canvas width
      // and uv y its height, so on a wide canvas one unit of x is longer on
      // screen than one unit of y. Multiplying x by the aspect (width over
      // height) puts both in canvas heights, so the light is a circle and
      // `radius` means the same distance in every direction.
      const offset = uv().sub(centerUniform);
      const distance = length(vec2(offset.x.mul(aspectUniform), offset.y));

      // ---------------------------------------------
      // Falloff: 1 at the light, 0 at the radius
      // ---------------------------------------------
      // smoothstep(edge0, edge1, x) is 0 below edge0, 1 above edge1, and
      // an S-curve between, with a flat start and a flat finish so the edge
      // of the light has no visible ring. It rises with distance, so
      // oneMinus() flips it to fall instead: full light inside the fade
      // start, none past the radius. With SOFTNESS at 0.9 the fade starts a
      // tenth of the way out, so a small core holds full strength and the
      // rest of the reach is one long soft falloff.
      const reach = max(radiusUniform, MIN_RADIUS);
      const fadeStart = reach.mul(1 - SOFTNESS);
      const falloff = smoothstep(fadeStart, reach, distance).oneMinus();

      // ---------------------------------------------
      // The brighten
      // ---------------------------------------------
      // A gain on the pixel: 1 leaves it alone, 2 doubles it. The pass runs
      // in linear light, where doubling the numbers doubles the light that
      // leaves the screen. Presence multiplies the whole lift, so before
      // the first pointer move (presence 0) the gain is exactly 1 and the
      // scene looks as if the spotlight were not mounted, and when the
      // pointer leaves the canvas the light fades rather than freezing.
      // Multiplying rather than adding means black stays black: the light
      // only lifts color that is already there, so it never tints.
      const lift = intensityUniform.mul(falloff).mul(presenceUniform);
      const gain = lift.add(1);

      // Alpha passes through: a transparent gap gets no more coverage.
      return vec4(input.rgb.mul(gain), input.a);
    },
    [presenceUniform, radiusUniform, intensityUniform, centerUniform, aspectUniform],
  );

  return null;
}
