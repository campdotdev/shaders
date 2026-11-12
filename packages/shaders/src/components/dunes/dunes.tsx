'use client';

// Public face of Dunes: owns the props, their JSDoc, and their defaults,
// then delegates to DunesShader (./shader.tsx), which draws terrain through
// a camera of its own by marching each pixel's ray over a height map. Dunes
// draws only the ground and is transparent where the ray misses it, so
// mount a sky Source beneath it inside a <ShaderScene>.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { DunesShader, type DunesTuning } from './shader.js';

export type { DunesTuning } from './shader.js';

export interface DunesProps {
  /**
   * How high the camera sits above the ground, in terrain units. The
   * terrain's crests reach about 0.8 units, so a camera below that can end
   * up inside a hill. Defaults to 1.5. Accepts a static value or an
   * animation signal.
   */
  altitude?: AnimatableProp<number>;
  /**
   * How far the camera looks down from the horizon, in degrees. 0 puts the
   * horizon across the middle of the canvas, and higher values lower the
   * camera's gaze, so the ground fills more of the frame and the sky less.
   * Defaults to 12. Accepts a static value or an animation signal.
   */
  tilt?: AnimatableProp<number>;
  /**
   * How much the camera sees from the bottom of the canvas to the top, in
   * degrees. Lower values zoom in and flatten the terrain's depth; higher
   * values widen the view and stretch near ground toward the viewer.
   * Defaults to 50. Accepts a static value or an animation signal.
   */
  fieldOfView?: AnimatableProp<number>;
  /**
   * TEMPORARY (build-phase tuning only): dev overrides for the feel
   * constants. Stripped at the defaults gate, so don't use it.
   */
  tuning?: DunesTuning;
}

// Provisional until the defaults gate (SHA-327) tunes them by eye.
export function Dunes({ altitude = 1.5, tilt = 12, fieldOfView = 50, tuning }: DunesProps) {
  return <DunesShader altitude={altitude} fieldOfView={fieldOfView} tilt={tilt} tuning={tuning} />;
}
