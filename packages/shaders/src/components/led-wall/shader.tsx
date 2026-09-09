'use client';

// The LED wall's GPU half: a post-process effect that screens the rendered
// scene into a grid of square dots, one per cell, each lit with the color
// the scene had at that cell's center. The wrapper (./led-wall.tsx)
// supplies the props. Two overlay hooks do the work: a base-pass uv snap so
// every pixel in a cell samples the same scene color, then a color pass
// that masks each cell down to its dot and scales the gaps by `bleed`.
import { useEffect, useMemo } from 'react';

import {
  abs,
  float,
  floor,
  max,
  mix,
  screenSize,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';

import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useBasePassUv } from '../../react/hooks/use-base-pass-uv/use-base-pass-uv.js';
import { usePostProcessPass } from '../../react/hooks/use-overlay-pass/use-overlay-pass.js';
import { useResize } from '../../react/hooks/use-resize/use-resize.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';

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
}

// ---------------------------------------------
// Constants
// ---------------------------------------------
// Width of the anti-aliasing band across a dot's rim, in device pixels.
// Wider softens every dot into a blur; narrower stair-steps the rim on 1x
// displays. 0.7 is under one pixel, so the band touches only the pixels the
// rim actually crosses.
const RIM_SOFTNESS_PX = 0.7;

export function LedWallShader({ spacing, dotSize, bleed }: LedWallShaderProps) {
  // The dials live in uniforms: values the CPU can update each frame without
  // rebuilding the shader, tracking either a static number or an animation
  // signal.
  const spacingUniform = useAnimatableUniform(spacing);
  const dotSizeUniform = useAnimatableUniform(dotSize);
  const bleedUniform = useAnimatableUniform(bleed);

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
  // Snap the scene sample to the cell center
  // ---------------------------------------------
  // The color pass can only restyle each pixel; giving a whole cell ONE
  // scene color means resampling the scene at one shared point per cell.
  // This warp runs where the scene texture is sampled. The coordinate is
  // uv space, v growing upward, so the y flip anchors the grid to the
  // top-left corner the way the color pass below does. Without matching
  // anchors the sampled cells and the drawn dots drift apart by a fraction
  // of a cell whenever the canvas height is not a multiple of the pitch.
  useBasePassUv(
    (coordinate) => {
      const cellPx = spacingUniform.mul(dprUniform).max(1);
      const pixel = vec2(coordinate.x, coordinate.y.oneMinus()).mul(screenSize);
      const snapped = floor(pixel.div(cellPx)).add(0.5).mul(cellPx);
      const snappedUv = snapped.div(screenSize);

      return vec2(snappedUv.x, snappedUv.y.oneMinus());
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
      // Which cell is this pixel in, and where inside it? Same top-left
      // anchoring as the snap above. cellLocal runs -0.5..0.5 across the
      // cell with 0 at its center.
      const cellPx = spacingUniform.mul(dprUniform).max(1);
      const pixel = vec2(uv().x, uv().y.oneMinus()).mul(screenSize);
      const cellCoord = pixel.div(cellPx);
      const cellIndex = floor(cellCoord);
      const cellLocal = cellCoord.sub(cellIndex).sub(0.5);

      // The dot's half-edge in cell units. dotSize in device pixels over the
      // cell pitch gives the edge as a fraction of the cell; half of it is
      // the distance from the center to the rim. min(0.5) keeps a dot from
      // growing past its own cell when dotSize animates above spacing.
      const halfEdge = dotSizeUniform.mul(dprUniform).div(cellPx).mul(0.5).min(0.5);

      // Signed distance to the square's rim: the larger of the two axis
      // distances from the center, minus the half-edge. Negative inside,
      // positive outside, zero on the rim. max(|x|, |y|) is what makes the
      // shape a square rather than length()'s circle.
      const squareDistance = max(abs(cellLocal.x), abs(cellLocal.y)).sub(halfEdge);

      // smoothstep with its edges REVERSED (high to low) flips the ramp:
      // pixels deeper than one rim-width inside get 1, pixels past it
      // outside get 0, and the band across the rim fades smoothly. The
      // width is in device pixels converted into cell units, so it stays
      // sub-pixel at any pitch.
      const rim = float(RIM_SOFTNESS_PX).div(cellPx);
      const dotMask = smoothstep(rim, rim.negate(), squareDistance);

      // Compose. The scene texture is premultiplied by construction (the
      // scene blends over a transparent clear), so scaling rgb and alpha by
      // the same factor is the correct way to dim it. Inside the dot the
      // factor is 1: the dot is the scene at full strength. In the gaps it
      // is bleed: 0 leaves alpha 0 so the page shows through, 1 leaves the
      // scene untouched.
      const factor = mix(bleedUniform, float(1), dotMask);

      return vec4(vec3(input.rgb).mul(factor), input.a.mul(factor));
    },
    [spacingUniform, dotSizeUniform, bleedUniform, dprUniform],
  );

  return null;
}
