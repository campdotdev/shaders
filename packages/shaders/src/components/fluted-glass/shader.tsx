'use client';

// The fluted glass's GPU half. Both passes start from one flute coordinate:
// where a pixel sits across its flute, after the angle, the sway, and the
// drift. A base-pass UV warp bends the scene by the flute's surface lean,
// so each flute shows a squeezed copy of the image beneath it. A color pass
// then adds a highlight where the lean faces the light and darkens toward
// each seam. The wrapper (./fluted-glass.tsx) supplies the props.
import type { ShaderNodeObject } from 'three/tsl';
import {
  abs,
  clamp,
  cos,
  dot,
  fract,
  max,
  oneMinus,
  screenSize,
  sign,
  sin,
  smoothstep,
  uv,
  vec2,
  vec4,
} from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableSpeed } from '../../react/hooks/use-animatable-speed/use-animatable-speed.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useColorTransform } from '../../react/hooks/use-color-transform/use-color-transform.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';
import { useUvWarp } from '../../react/hooks/use-uv-warp/use-uv-warp.js';

export interface FlutedGlassShaderProps {
  /**
   * One flute's width in CSS pixels. Accepts a static value or an animation
   * signal.
   */
  width: AnimatableProp<number>;
  /**
   * Flute direction in degrees. 0 runs the flutes vertically, 90
   * horizontally. Accepts a static value or an animation signal.
   */
  angle: AnimatableProp<number>;
  /**
   * How far each flute bends the image beneath it. 0 leaves the image where
   * it is, 1 shifts it up to one flute width at the flute's edges. Accepts a
   * static value or an animation signal.
   */
  refraction: AnimatableProp<number>;
  /**
   * Flute profile. 0 is flat with sharp seams, 1 is a full half-cylinder.
   * Accepts a static value or an animation signal.
   */
  softness: AnimatableProp<number>;
  /**
   * Highlight along each flute, lit from the upper left. 0 adds none, 1
   * adds full white where a flute faces the light. Accepts a static value or
   * an animation signal.
   */
  shine: AnimatableProp<number>;
  /**
   * Darkening toward each seam. 0 adds none, 1 takes the seam to black.
   * Accepts a static value or an animation signal.
   */
  shadow: AnimatableProp<number>;
  /**
   * How far each flute bends side to side, as a fraction of its width. 0
   * keeps the flutes straight. Accepts a static value or an animation
   * signal.
   */
  sway: AnimatableProp<number>;
  /**
   * How many bends fit along a flute that crosses the canvas. Accepts a
   * static value or an animation signal.
   */
  swayFrequency: AnimatableProp<number>;
  /**
   * Drifts the flutes sideways in flute widths per second, and moves the
   * sway along each flute at the same rate. A negative value reverses both,
   * and 0 holds the glass still. Accepts a static value or an animation
   * signal.
   */
  speed: AnimatableProp<number>;
}

// ---------------------------------------------
// Constants
// ---------------------------------------------
// The light, as CursorRipple's shine has it: a compass angle on the screen
// where 225 degrees is the upper left, turned once into a unit vector in the
// pass's frame, y down.
const LIGHT_ANGLE_DEGREES = 225;
const TO_LIGHT = [
  Math.cos((LIGHT_ANGLE_DEGREES * Math.PI) / 180),
  Math.sin((LIGHT_ANGLE_DEGREES * Math.PI) / 180),
] as const;

// The lean toward the light, 0 to 1, at which the highlight reaches full
// strength. CursorRipple's value. Smaller hardens the highlight into a
// stripe; larger keeps it to the flute's steepest edge.
const SHINE_SOFTNESS = 0.6;

// Where the seam shadow starts, as a distance from the flute's center: 0 is
// the center and 1 the seam. The shadow fades in from here to full at the
// seam. Lower spreads it across the flute; higher pinches it into a line.
// Chosen by eye.
const SHADOW_START = 0.4;

// Smallest softness the profile divides by. A softness of 0 would divide
// by zero; this keeps the rounded band under a thousandth of a flute, which
// reads as a sharp seam.
const MIN_SOFTNESS = 1e-3;

const DEGREES_TO_RADIANS = Math.PI / 180;
const TAU = Math.PI * 2;

export function FlutedGlassShader({
  width,
  angle,
  refraction,
  softness,
  shine,
  shadow,
  sway,
  swayFrequency,
  speed,
}: FlutedGlassShaderProps) {
  // The dials live in uniforms: values the CPU can update each frame without
  // rebuilding the shader, tracking either a static number or an animation
  // signal.
  const widthUniform = useAnimatableUniform(width);
  const angleUniform = useAnimatableUniform(angle);
  const refractionUniform = useAnimatableUniform(refraction);
  const softnessUniform = useAnimatableUniform(softness);
  const shineUniform = useAnimatableUniform(shine);
  const shadowUniform = useAnimatableUniform(shadow);
  const swayUniform = useAnimatableUniform(sway);
  const swayFrequencyUniform = useAnimatableUniform(swayFrequency);
  // Speed is integrated rather than multiplied by time: useAnimatableSpeed
  // adds speed x delta to a phase each frame, so a speed change shifts the
  // tempo without jumping the flutes to a new place. The phase counts flute
  // widths of drift.
  const phaseUniform = useAnimatableSpeed(speed);

  // The render-on-demand vote. A literal speed of 0 freezes the phase, and
  // every other dial changes only when its own write repaints the scene, so
  // the scene may go idle. A speed signal might move later and doesn't count.
  useStaticSceneHint(typeof speed === 'number' && speed === 0);

  // width is in CSS pixels, but screenSize below counts device pixels. The
  // scene's pixelRatio uniform holds the renderer's ratio and is never
  // replaced, so the passes depend on it without re-registering. Outside a
  // scene no pass registers, so the 1 fallback never draws.
  const pixelRatio = useShaderContext()?.canvasSize.pixelRatio ?? 1;

  // ---------------------------------------------
  // The flute coordinate
  // ---------------------------------------------
  // Both passes call this with the same screen-oriented coordinate, (0, 0)
  // at the top-left, so the bent image and the light land on the same
  // flutes.
  const fluteAt = (coordinate: ShaderNodeObject<Node>) => {
    const widthPx = widthUniform.mul(pixelRatio).max(1);

    // Rotate the pixel into the flutes' frame. `across` runs perpendicular
    // to the flutes and `along` runs with them. At angle 0, across is x and
    // along is y, so the flutes stand vertical.
    const radians = angleUniform.mul(DEGREES_TO_RADIANS);
    const cosAngle = cos(radians);
    const sinAngle = sin(radians);
    const pixel = coordinate.mul(screenSize);
    const across = pixel.x.mul(cosAngle).add(pixel.y.mul(sinAngle));
    const along = pixel.y.mul(cosAngle).sub(pixel.x.mul(sinAngle));

    // The sway: a sine along each flute that pushes it sideways by up to
    // `sway` flute widths. The canvas's extent along the flutes is the
    // projection of its two edges onto that direction, so swayFrequency
    // counts whole bends across the canvas at any angle. Subtracting the
    // drift from `along` slides the bends down the flute as the phase
    // grows, at one flute width per unit of phase.
    const flutePathLength = abs(cosAngle).mul(screenSize.y).add(abs(sinAngle).mul(screenSize.x));
    const bendPhase = along.sub(phaseUniform.mul(widthPx)).div(flutePathLength);
    const bend = sin(bendPhase.mul(swayFrequencyUniform).mul(TAU)).mul(swayUniform);

    // Position in flute widths, drifting sideways by one flute per unit of
    // phase. fract() keeps the part inside one flute, and the remap to -1..1
    // puts the center at 0 and the seams at -1 and 1.
    const position = across.div(widthPx).add(bend).sub(phaseUniform);
    const offset = fract(position).mul(2).sub(1);

    // The profile: how far the glass surface leans, from 0 where it is flat
    // to 1 at a seam. A flute is flat in its middle and rounds over in a band
    // of width `softness` at each edge, a corner of that radius. Inside the
    // band the lean grows linearly with distance, which is exactly a circle's
    // normal, so softness 1 makes the band the whole flute: a half-cylinder.
    // Softness 0 shrinks the band to a sharp seam and leaves the face flat.
    // sign() gives the lean its side, negative on the left half.
    const band = max(softnessUniform, MIN_SOFTNESS);
    const lean = clamp(abs(offset).sub(oneMinus(band)).div(band), 0, 1).mul(sign(offset));

    return { offset, lean, widthPx, cosAngle, sinAngle };
  };

  // ---------------------------------------------
  // Refraction: bend the scene by the flute's lean
  // ---------------------------------------------
  // A base-pass UV warp: the callback receives the 0..1 coordinate the
  // rendered scene is about to be sampled at and returns a replacement.
  // Each pixel samples the scene from `lean x refraction` flute widths
  // further out across its flute, so the flute shows more of the image than
  // its own width, squeezed. The shift is worked out in device pixels and
  // divided back into 0..1, so refraction 0 adds an exact 0 and the image
  // stays put.
  useUvWarp(
    (coordinate) => {
      const { lean, widthPx, cosAngle, sinAngle } = fluteAt(coordinate);
      const shiftPx = lean.mul(refractionUniform).mul(widthPx);
      // shortcut: the shift and the highlight's normal point straight across
      // the unswayed flute, so a steep sway bends the image a little off its
      // curve; tilt both by the sway's slope if a large sway looks wrong.

      return coordinate.add(vec2(cosAngle, sinAngle).mul(shiftPx).div(screenSize));
    },
    [
      widthUniform,
      angleUniform,
      refractionUniform,
      softnessUniform,
      swayUniform,
      swayFrequencyUniform,
      phaseUniform,
      pixelRatio,
    ],
  );

  // ---------------------------------------------
  // Light and shade: highlight and seam shadow
  // ---------------------------------------------
  // A post-process pass: the callback receives each already-rendered pixel
  // (`input`, rgba) and returns a replacement.
  useColorTransform(
    (input) => {
      const { offset, lean, cosAngle, sinAngle } = fluteAt(uv());

      // The surface normal on the screen is the lean pointed across the
      // flute. Projected onto the direction of the light, it is positive on
      // the half that faces the upper left, and max() drops the other half,
      // so shine only ever adds. The smoothstep shapes that lean into a
      // highlight with a soft start and a soft cap, as in CursorRipple.
      const normal = vec2(cosAngle, sinAngle).mul(lean);
      const facing = max(dot(normal, vec2(...TO_LIGHT)), 0);
      const highlight = smoothstep(0, SHINE_SOFTNESS, facing);

      // Added as white light, scaled by the dial and by the pixel's alpha,
      // so a transparent pixel gets no color it has no coverage for.
      const light = highlight.mul(shineUniform).mul(input.a);

      // The seam shadow fades in from SHADOW_START to full at the seam, on
      // both sides. Multiplying rgb alone darkens a premultiplied pixel
      // without changing its coverage. shadow 0 multiplies by exactly 1.
      const seam = smoothstep(SHADOW_START, 1, abs(offset));
      const shade = oneMinus(seam.mul(shadowUniform));

      return vec4(input.rgb.mul(shade).add(light), input.a);
    },
    [
      widthUniform,
      angleUniform,
      softnessUniform,
      shineUniform,
      shadowUniform,
      swayUniform,
      swayFrequencyUniform,
      phaseUniform,
      pixelRatio,
    ],
  );

  return null;
}
