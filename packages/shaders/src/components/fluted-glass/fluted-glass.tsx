'use client';

// Public face of the fluted glass: owns the props, their JSDoc, and their
// defaults, then delegates to FlutedGlassShader (./shader.tsx). FlutedGlass
// is an Effect: stack it after a Source inside a <ShaderScene> and it shows
// that Source through a pane of fluted glass, each flute bending the image
// beneath it into a squeezed copy and catching the light along one wall.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';
import { FlutedGlassShader } from './shader.js';

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
   * Where the light comes from, in degrees counterclockwise on screen, the
   * way `angle` turns: 0 from the right, 90 from above, 180 from the left,
   * and 270 from below.
   * The light stays put on screen while `angle` turns the glass beneath it,
   * and the flute wall that faces it catches the highlight. A light that
   * runs along the flutes catches neither wall. Defaults to 135, the upper
   * left. Accepts a static value or an animation signal.
   */
  lightAngle?: AnimatableProp<number>;
  /**
   * How bright the highlight along each lit wall is, from 0 to 1, where 1
   * adds the full `highlightColor` at the brightest point. 0 turns it off.
   * Defaults to 0.45. Accepts a static value or an animation signal.
   */
  highlight?: AnimatableProp<number>;
  /**
   * The highlight's color: hex, `oklch()`, or `oklab()`. Defaults to white,
   * `'oklch(1 0 0)'`.
   */
  highlightColor?: string;
  /**
   * How dark the glass gets at each groove, from 0 to 1, where 1 is black
   * right on the groove. The shadow falls where the glass turns steep, so a
   * `'flat'` cross-section darkens only along its walls. 0 turns it off.
   * Defaults to 0.2. Accepts a static value or an animation signal.
   */
  shadow?: AnimatableProp<number>;
}

/**
 * Shows the image beneath it through repeating flutes of glass, lit from one
 * side with a shadow at each groove. Mount it inside a `<ShaderScene>` after
 * the Sources it should bend. It bends only what Sources drew, never the
 * output of an Effect such as Grain, so mount such Effects after it, where
 * the order you write matches what you see. Mode 1 only, because it needs
 * the scene's output stage; Mode 2 users get the flute math as the
 * `fluteSurface` primitive.
 */
export function FlutedGlass({
  fluteWidth = 40,
  angle = 90,
  refraction = 1,
  crossSection = 'round',
  lightAngle = 135,
  highlight = 0.45,
  highlightColor = 'oklch(1 0 0)',
  shadow = 0.2,
}: FlutedGlassProps) {
  // The idle vote. Still glass draws nothing that changes over time, and
  // every dial repaints through its uniform when it moves, so the glass
  // votes idle and a scene of still Sources under the glass parks.
  useStaticSceneHint(true);

  return (
    <FlutedGlassShader
      angle={angle}
      crossSection={
        typeof crossSection === 'string' ? CROSS_SECTION_DIAL[crossSection] : crossSection
      }
      fluteWidth={fluteWidth}
      highlight={highlight}
      highlightColor={highlightColor}
      lightAngle={lightAngle}
      refraction={refraction}
      shadow={shadow}
    />
  );
}
