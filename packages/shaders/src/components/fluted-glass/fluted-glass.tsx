'use client';

// Public face of the fluted glass: owns the props, their JSDoc, and their
// defaults, then delegates to FlutedGlassShader (./shader.tsx). FlutedGlass
// is an Effect: stack it after a Source inside a <ShaderScene> and it shows
// that Source through a pane of ribbed glass, each flute bending the image
// beneath it and catching a highlight.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { FlutedGlassShader } from './shader.js';

export interface FlutedGlassProps {
  /**
   * One flute's width in CSS pixels. Defaults to 40. Accepts a static value
   * or an animation signal.
   */
  width?: AnimatableProp<number>;
  /**
   * Flute direction in degrees. 0 runs the flutes vertically, 90
   * horizontally. Defaults to 0. Accepts a static value or an animation
   * signal.
   */
  angle?: AnimatableProp<number>;
  /**
   * How far each flute bends the image beneath it. 0 leaves the image where
   * it is, 1 shifts it up to one flute width at the flute's edges. Defaults
   * to 0.5. Accepts a static value or an animation signal.
   */
  refraction?: AnimatableProp<number>;
  /**
   * Flute profile. 0 is flat with sharp seams, 1 is a full half-cylinder.
   * Defaults to 0.5. Accepts a static value or an animation signal.
   */
  softness?: AnimatableProp<number>;
  /**
   * Highlight along each flute, lit from the upper left. 0 adds none, 1
   * adds full white where a flute faces the light. Defaults to 0.2. Accepts
   * a static value or an animation signal.
   */
  shine?: AnimatableProp<number>;
  /**
   * Darkening toward each seam. 0 adds none, 1 takes the seam to black.
   * Defaults to 0.25. Accepts a static value or an animation signal.
   */
  shadow?: AnimatableProp<number>;
  /**
   * How far each flute bends side to side, as a fraction of its width. 0
   * keeps the flutes straight. Defaults to 0. Accepts a static value or an
   * animation signal.
   */
  sway?: AnimatableProp<number>;
  /**
   * How many bends fit along a flute that crosses the canvas. Defaults to
   * 1.5. Accepts a static value or an animation signal.
   */
  swayFrequency?: AnimatableProp<number>;
  /**
   * Drifts the flutes sideways in flute widths per second, and moves the
   * sway along each flute at the same rate. A negative value reverses both,
   * and 0 holds the glass still. Defaults to 0. Accepts a static value or an
   * animation signal.
   */
  speed?: AnimatableProp<number>;
}

export function FlutedGlass({
  width = 40,
  angle = 0,
  refraction = 0.5,
  softness = 0.5,
  shine = 0.2,
  shadow = 0.25,
  sway = 0,
  swayFrequency = 1.5,
  speed = 0,
}: FlutedGlassProps) {
  return (
    <FlutedGlassShader
      angle={angle}
      refraction={refraction}
      shadow={shadow}
      shine={shine}
      softness={softness}
      speed={speed}
      sway={sway}
      swayFrequency={swayFrequency}
      width={width}
    />
  );
}
