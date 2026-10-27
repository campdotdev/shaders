'use client';

// Public face of the fluted glass: owns the props, their JSDoc, and their
// defaults, then delegates to FlutedGlassShader (./shader.tsx). FlutedGlass
// is an Effect: stack it after a Source inside a <ShaderScene> and it shows
// that Source through a pane of fluted glass, each flute bending the image
// beneath it into a squeezed copy.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';
import { FlutedGlassShader, type FlutedGlassTuning } from './shader.js';

export type { FlutedGlassTuning } from './shader.js';

/** The names for three points on the `crossSection` dial. */
export type CrossSectionName = 'prism' | 'round' | 'flat';

// Where each name sits on the dial. A name is only a point on the dial, so
// it rides the same uniform as a number and animates like one.
const CROSS_SECTION_DIAL: Record<CrossSectionName, number> = {
  prism: 0,
  round: 0.5,
  flat: 1,
};

export interface FlutedGlassProps {
  /**
   * The width of one flute, in CSS pixels. Defaults to 40. Accepts a static
   * value or an animation signal.
   */
  fluteWidth?: AnimatableProp<number>;
  /**
   * The direction the flutes run, in degrees on screen: 0 runs them left to
   * right and 90 runs them bottom to top. These are the degrees
   * LinearGradient's `angle` uses, though a gradient's bands run across its
   * angle and the flutes run along theirs. Defaults to 90, vertical flutes.
   * Accepts a static value or an animation signal.
   */
  angle?: AnimatableProp<number>;
  /**
   * How far each flute bends the image beneath it, in half flute widths at
   * the steepest part of the glass. 0 leaves the image unchanged. At 1, each
   * flute shows a squeezed copy of twice its width of image. Defaults to 1.
   * Accepts a static value or an animation signal.
   */
  refraction?: AnimatableProp<number>;
  /**
   * The shape of each flute seen from its end, from 0 to 1. `'prism'` (0) is
   * two flat faces meeting at a ridge, `'round'` (0.5) is a lens, and
   * `'flat'` (1) is a flat top with steep walls. Numbers between give the
   * shapes between, so a signal can morph one shape into another. Defaults
   * to `'round'`. Accepts a static value or an animation signal.
   */
  crossSection?: AnimatableProp<number> | CrossSectionName;
  /**
   * TEMPORARY (build-phase tuning only): dev overrides for the feel
   * constants. Stripped at the defaults-tuning gate, so do not use.
   */
  tuning?: FlutedGlassTuning;
}

/**
 * Shows the image beneath it through repeating flutes of glass. Mount it
 * inside a `<ShaderScene>` after the Sources it should bend. It bends only
 * what Sources drew, never the output of an Effect such as Grain, so mount
 * such Effects after it, where the order you write matches what you see.
 * Mode 1 only, because it needs the scene's output stage; Mode 2 users get
 * the flute math as the `fluteSurface` primitive.
 */
export function FlutedGlass({
  fluteWidth = 40,
  angle = 90,
  refraction = 1,
  crossSection = 'round',
  tuning,
}: FlutedGlassProps) {
  // The render-on-demand vote. Still glass draws nothing that changes over
  // time, and every dial repaints through its uniform when it moves, so the
  // vote is static and a scene of still Sources under the glass parks.
  useStaticSceneHint(true);

  return (
    <FlutedGlassShader
      angle={angle}
      crossSection={
        typeof crossSection === 'string' ? CROSS_SECTION_DIAL[crossSection] : crossSection
      }
      fluteWidth={fluteWidth}
      refraction={refraction}
      tuning={tuning}
    />
  );
}
