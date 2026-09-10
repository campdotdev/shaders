'use client';

// The LED wall's GPU half: a post-process effect that screens the rendered
// scene into a grid of square dots, one per cell, each lit with the color
// the scene had at that cell's center. The wrapper (./led-wall.tsx)
// supplies the props. Two overlay hooks do the work: a base-pass uv snap so
// every pixel in a cell samples the same scene color, then a color pass
// that masks each cell down to its dot, breathes its brightness with a
// per-dot flicker, swells it toward `focus`, and scales the gaps by
// `bleed`.
import { useEffect, useMemo } from 'react';

import {
  abs,
  float,
  floor,
  length,
  max,
  mix,
  screenSize,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';

import { stableHash, stableHashUint } from '../../engine.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatablePoint } from '../../react/hooks/use-animatable-point/use-animatable-point.js';
import { useAnimatableSpeed } from '../../react/hooks/use-animatable-speed/use-animatable-speed.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useBasePassUv } from '../../react/hooks/use-base-pass-uv/use-base-pass-uv.js';
import { usePostProcessPass } from '../../react/hooks/use-overlay-pass/use-overlay-pass.js';
import { useResize } from '../../react/hooks/use-resize/use-resize.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';
import { isLedWallStatic } from './static.js';

export interface LedWallShaderProps {
  /** Cell pitch in CSS pixels. Accepts a static value or an animation signal. */
  spacing: AnimatableProp<number>;
  /**
   * Edge of the square dot in CSS pixels. Accepts a static value or an
   * animation signal.
   */
  dotSize: AnimatableProp<number>;
  /**
   * How much of the scene shows between the dots. 0 leaves the gaps
   * transparent, 1 leaves the scene untouched there. Accepts a static value
   * or an animation signal.
   */
  bleed: AnimatableProp<number>;
  /**
   * How deep each dot's brightness breathes over time, on its own phase and
   * tempo. 0 holds every dot still, 1 takes each dot all the way to dark at
   * the bottom of every breath. Accepts a static value or an animation
   * signal.
   */
  flicker: AnimatableProp<number>;
  /**
   * Tempo of the flicker. Each dot breathes between 0.8 and 1.2 times this
   * rate, and 1 is roughly one breath every six seconds. Accepts a static
   * value or an animation signal.
   */
  speed: AnimatableProp<number>;
  /**
   * The point the dots swell toward, 0..1 across the canvas with `[0, 0]`
   * at the top-left corner. Feed it a cursor signal to follow the pointer.
   * Accepts a static value or an animation signal.
   */
  focus: AnimatableProp<readonly [number, number]>;
  /**
   * Reach of the swell from the focus, in canvas units where 1 is the
   * canvas height. Accepts a static value or an animation signal.
   */
  focusRadius: AnimatableProp<number>;
  /**
   * How much a dot grows at the focus, as a fraction of its edge. 0 turns
   * the swell off, 1 doubles the edge at the focus, and the cell caps it so
   * a dot never touches its neighbour. Accepts a static value or an
   * animation signal.
   */
  swell: AnimatableProp<number>;
}

// ---------------------------------------------
// Constants
// ---------------------------------------------
// Width of the anti-aliasing band across a dot's rim, in device pixels.
// Wider softens every dot into a blur; narrower stair-steps the rim on 1x
// displays. 0.7 is under one pixel, so the band touches only the pixels the
// rim actually crosses.
const RIM_SOFTNESS_PX = 0.7;

// How far a dot's permanent brightness can fall below full, as a fraction.
// Each dot draws its own share of this from its hash, so the grid never
// reads as a flat print. 0 makes every dot equal; higher spreads them
// further apart and reads as a wall with dead pixels.
// Chosen by eye.
const VARIANCE = 0.5;

// The brightness dials are applied in a gamma-encoded approximation of
// display space rather than in the linear light the pass composes in. In
// linear light a factor of 0.7 reads as about 0.85 on screen, so the
// flicker dial did nothing visible until 0.7. Raising the factor to this
// power before it multiplies the pixel makes the flicker and the variance
// read evenly to the eye. Dither quantizes with the same constant for the
// same reason.
const GAMMA = 2.2;

export function LedWallShader({
  spacing,
  dotSize,
  bleed,
  flicker,
  speed,
  focus,
  focusRadius,
  swell,
}: LedWallShaderProps) {
  // The dials live in uniforms: values the CPU can update each frame without
  // rebuilding the shader, tracking either a static number or an animation
  // signal.
  const spacingUniform = useAnimatableUniform(spacing);
  const dotSizeUniform = useAnimatableUniform(dotSize);
  const bleedUniform = useAnimatableUniform(bleed);
  const flickerUniform = useAnimatableUniform(flicker);
  // Speed is the exception to the uniform-per-dial pattern: useAnimatableSpeed
  // integrates it into a phase (speed x delta summed on the CPU each frame,
  // already scaled for reduced motion), so a speed change shifts the tempo
  // without snapping every dot to a new point in its breath.
  const phaseUniform = useAnimatableSpeed(speed);
  // focus is already a screen-style pair, [0, 0] at the top-left, the same
  // frame the pass's uv() reads, so it needs no conversion.
  const focusUniform = useAnimatablePoint(focus);
  const focusRadiusUniform = useAnimatableUniform(focusRadius);
  const swellUniform = useAnimatableUniform(swell);

  // The render-on-demand vote: the scene may stop drawing only when nothing
  // on the wall can change between frames.
  useStaticSceneHint(isLedWallStatic({ flicker, focus, swell }));

  // ---------------------------------------------
  // CSS pixels -> device pixels
  // ---------------------------------------------
  // spacing and dotSize are in CSS pixels so the look matches on 1x and 3x
  // displays, but screenSize below counts device pixels. The renderer's
  // pixel ratio converts between them; useResize re-fires on monitor moves
  // and browser zoom, when that ratio changes. Created once and never
  // replaced, so the passes can depend on it without re-registering.
  const shaderContext = useShaderContext();
  const resize = useResize();
  const dprUniform = useMemo(
    () => uniform(resize.get()[2] || 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const apply = () => {
      const rendererRatio = shaderContext?.renderer.three.getPixelRatio();

      dprUniform.value =
        rendererRatio !== undefined && rendererRatio > 0 ? rendererRatio : resize.get()[2] || 1;
    };

    apply();

    return resize.on('change', apply);
  }, [resize, dprUniform, shaderContext]);

  // ---------------------------------------------
  // Track the canvas aspect ratio
  // ---------------------------------------------
  // The distance math below multiplies the horizontal offset by
  // width/height so the focus's reach stays a circle on a wide canvas. The
  // uniform starts from the current canvas size (16:9 when the canvas has
  // no layout yet and reports 0), then follows every resize.
  const [initialWidth, initialHeight] = resize.get();
  const aspectUniform = useMemo(
    () => uniform(initialHeight > 0 ? initialWidth / initialHeight : 16 / 9),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const [canvasWidth, canvasHeight] = resize.get();

    if (canvasWidth > 0 && canvasHeight > 0) aspectUniform.value = canvasWidth / canvasHeight;

    return resize.on('change', ([updatedWidth, updatedHeight]) => {
      if (updatedWidth > 0 && updatedHeight > 0) {
        aspectUniform.value = updatedWidth / updatedHeight;
      }
    });
  }, [resize, aspectUniform]);

  // ---------------------------------------------
  // Snap the scene sample to the cell center
  // ---------------------------------------------
  // The color pass can only restyle each pixel; giving a whole cell ONE
  // scene color means resampling the scene at one shared point per cell.
  // This warp runs where the scene texture is sampled. The coordinate is
  // the same screen-oriented uv the color pass reads, (0, 0) at the
  // top-left, so the grid anchors there in both passes and the sampled
  // cells and the drawn dots never drift apart.
  useBasePassUv(
    (coordinate) => {
      const cellPx = spacingUniform.mul(dprUniform).max(1);
      const pixel = coordinate.mul(screenSize);
      const snapped = floor(pixel.div(cellPx)).add(0.5).mul(cellPx);

      return snapped.div(screenSize);
    },
    [spacingUniform, dprUniform],
  );

  // ---------------------------------------------
  // The pass: cell -> dot mask -> compose
  // ---------------------------------------------
  // A post-process pass: the callback receives each already-rendered pixel
  // (`input`, rgba, already snapped to its cell's color) and returns a
  // replacement.
  usePostProcessPass(
    (input) => {
      // Which cell is this pixel in, and where inside it? uv() in a
      // post-process pass is screen-oriented: (0, 0) is the top-left corner
      // and y grows downward, the same frame as CSS and as the cursor
      // input. That is the opposite of a mesh's uv(), where v grows upward,
      // which is why this file never flips y and never passes screenOrigin
      // to useAnimatablePoint, unlike DotField. Vignette is the model.
      // cellLocal runs -0.5..0.5 across the cell with 0 at its center.
      const cellPx = spacingUniform.mul(dprUniform).max(1);
      const pixel = uv().mul(screenSize);
      const cellCoord = pixel.div(cellPx);
      const cellIndex = floor(cellCoord);
      const cellLocal = cellCoord.sub(cellIndex).sub(0.5);

      // ---------------------------------------------
      // Per-cell randomness
      // ---------------------------------------------
      // One u32 seed per cell: hash the integer y index, add it to the x
      // index, and hash the sum. Every stream below chains forward from that
      // seed with another stableHashUint, staying in u32 the whole way, and
      // only takes a float (stableHash) at the point it is actually used, per
      // the seeded-randomness gotcha. That gives three decorrelated streams
      // off one cell: levelRandom sets the dot's permanent brightness, and
      // phaseRandom and tempoRandom offset and retune its flicker.
      const cellSeed = stableHashUint(
        cellIndex.x.toUint().add(stableHashUint(cellIndex.y.toUint())),
      );
      const levelSeed = stableHashUint(cellSeed);
      const levelRandom = stableHash(levelSeed);
      const phaseSeed = stableHashUint(levelSeed);
      const phaseRandom = stableHash(phaseSeed);
      const tempoRandom = stableHash(stableHashUint(phaseSeed));

      // ---------------------------------------------
      // Brightness: static variance times flicker
      // ---------------------------------------------
      // Each dot sits at its own permanent level, 1 minus a random share of
      // the variance, so the grid never reads as a flat print. Then it
      // breathes: a sine on the accumulated phase at a per-dot tempo between
      // 0.8 and 1.2, offset by a per-dot phase so the dots never breathe in
      // step. The wave is pushed into 0..1, scaled by the flicker dial, and
      // subtracted from 1: flicker 0 leaves the level untouched, flicker 1
      // takes the dot all the way to dark at the bottom of each breath.
      const staticLevel = levelRandom.mul(VARIANCE).oneMinus();
      const tempo = tempoRandom.mul(0.4).add(0.8);
      const breath = sin(phaseUniform.mul(tempo).add(phaseRandom.mul(Math.PI * 2)))
        .mul(0.5)
        .add(0.5);
      const flickerTerm = breath.mul(flickerUniform).oneMinus();
      const brightness = staticLevel.mul(flickerTerm);

      // max(0) first: a wide-gamut input can carry a negative channel and
      // pow() of a negative breaks WGSL const-eval. brightness itself is a
      // product of 0..1 terms, so the guard is for safety, not for a case
      // that occurs.
      const displayBrightness = brightness.max(0).pow(GAMMA);

      // ---------------------------------------------
      // The swell: dots grow toward a point
      // ---------------------------------------------
      // The cell's center in the pass's screen frame, so it compares with
      // the focus uniform directly. Evaluated per CELL, not per pixel, so a
      // dot grows as one piece. Then the aspect-corrected distance from the
      // focus, and a reversed smoothstep so the term is 1 at the focus and
      // 0 past the radius. The dot's half-edge below grows by swell times
      // that term.
      const cellCenterPx = cellIndex.add(0.5).mul(cellPx);
      const cellCenterUv = cellCenterPx.div(screenSize);
      const toFocus = cellCenterUv.sub(focusUniform);
      const focusDistance = length(vec2(toFocus.x.mul(aspectUniform), toFocus.y));
      const nearFocus = smoothstep(focusRadiusUniform, float(0), focusDistance);

      // The dot's half-edge in cell units. dotSize in device pixels over the
      // cell pitch gives the edge as a fraction of the cell; half of it is
      // the distance from the center to the rim. The focus then grows that
      // by up to swell's fraction, at the focus. min(0.5) comes last so a
      // dot never crosses into the next cell, whether it got there from a
      // large dotSize or from a strong swell.
      const halfEdge = dotSizeUniform
        .mul(dprUniform)
        .div(cellPx)
        .mul(0.5)
        .mul(nearFocus.mul(swellUniform).add(1))
        .min(0.5);

      // Signed distance to the square's rim: the larger of the two axis
      // distances from the center, minus the half-edge. Negative inside,
      // positive outside, zero on the rim. max(|x|, |y|) is what makes the
      // shape a square rather than length()'s circle.
      const squareDistance = max(abs(cellLocal.x), abs(cellLocal.y)).sub(halfEdge);

      // Reversed smoothstep again, as at the swell above: pixels deeper
      // than one rim-width inside get 1, pixels past it outside get 0, and
      // the band across the rim fades smoothly. The width is in device
      // pixels converted into cell units, so it stays sub-pixel at any
      // pitch.
      const rim = float(RIM_SOFTNESS_PX).div(cellPx);
      const dotMask = smoothstep(rim, rim.negate(), squareDistance);

      // Compose. The scene texture is premultiplied by construction (the
      // scene blends over a transparent clear), so scaling rgb and alpha by
      // the same factor is the correct way to dim it. Inside the dot the
      // factor is the dot's brightness in display space, so the static
      // level and the flicker only ever apply to lit dots. In the gaps it
      // is bleed: 0 leaves alpha 0 so the page shows through, 1 leaves the
      // scene untouched.
      const factor = mix(bleedUniform, displayBrightness, dotMask);

      return vec4(vec3(input.rgb).mul(factor), input.a.mul(factor));
    },
    [
      spacingUniform,
      dotSizeUniform,
      bleedUniform,
      flickerUniform,
      phaseUniform,
      focusUniform,
      focusRadiusUniform,
      swellUniform,
      aspectUniform,
      dprUniform,
    ],
  );

  return null;
}
