'use client';

// The palette map's GPU half: a resample that reads the image beneath it
// once per cell, measures how light it is, and returns one of the palette's
// colors in its place. A blue-noise threshold decides which way each cell
// rounds between two colors, which scatters the colors into each other at
// every band edge. The wrapper (./palette-map.tsx) supplies the props. Being
// a resample rather than a color transform is what lets it nest inside a later UV
// warp: under LedWall, the wall's cell snap hands it each cell's center, so
// a whole cell gets one palette color. ADR 0006 records why.
import { useEffect, useMemo } from 'react';

import { float, floor, screenSize, select, uniform, vec3, vec4 } from 'three/tsl';

import { ditherThreshold } from '../../engine.js';
import { linearToOklab } from '../../primitives/color-space/oklab.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useResample } from '../../react/hooks/use-resample/use-resample.js';
import { useResize } from '../../react/hooks/use-resize/use-resize.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { parseColor } from '../shared/color.js';

export interface PaletteMapShaderProps {
  /**
   * The palette, darkest input first: the image's darkest areas take the
   * first color and its lightest take the last, with the rest spaced evenly
   * between. 2 or more colors as hex, `oklch()`, or `oklab()` strings.
   */
  colors: string[];
  /**
   * Edge of one cell in CSS pixels. Each cell takes one color. Match it to
   * an LED wall's spacing and each dot takes one color. Accepts a static
   * value or an animation signal.
   */
  pixelSize: AnimatableProp<number>;
  /**
   * How far the two colors at a band edge scatter into each other. 0 draws
   * clean edges, 1 mixes them across the whole step between two colors, and
   * above 1 scatters stray cells into flat areas too. Accepts a static value
   * or an animation signal.
   */
  spread: AnimatableProp<number>;
}

// ---------------------------------------------
// Constants
// ---------------------------------------------
// Smallest alpha the image's color is divided by when the premultiplied
// alpha is undone. Only fully transparent pixels get near it, and their
// output is scaled back down by the same alpha, so the value only has to keep
// the divide finite. Raising it would darken faint, soft edges.
const MIN_ALPHA = 1e-4;

export function PaletteMapShader({ colors, pixelSize, spread }: PaletteMapShaderProps) {
  // The dials live in uniforms: values the CPU can update each frame without
  // rebuilding the shader, tracking either a static number or an animation
  // signal.
  const pixelSizeUniform = useAnimatableUniform(pixelSize);
  const spreadUniform = useAnimatableUniform(spread);

  // The colors are baked into the shader as literals, so a palette change
  // rebuilds it, as with every colorRamp consumer (the uniform-stability
  // gotcha in docs/agents/tsl.md). The joined string stands in for the array
  // in the deps, because a new array arrives on every render (the
  // array-props gotcha in the same file).
  const colorsKey = colors.join('|');

  // ---------------------------------------------
  // CSS pixels -> device pixels
  // ---------------------------------------------
  // pixelSize is in CSS pixels so the cells match on 1x and 3x displays, but
  // screenSize below counts device pixels. The renderer's pixel ratio
  // converts between them; useResize re-fires on monitor moves and browser
  // zoom, when that ratio changes. Created once and never replaced, so the
  // resample can depend on it without re-registering.
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
      // A bare uniform write repaints nothing on a static scene, so ask for
      // a frame; requestRender returns at once unless the scene is idle.
      shaderContext?.scheduler.requestRender();
    };

    apply();

    return resize.on('change', apply);
  }, [resize, dprUniform, shaderContext]);

  useResample(
    (sampleBeneath) => (coordinate) => {
      // ---------------------------------------------
      // Which cell?
      // ---------------------------------------------
      // The coordinate runs 0..1 across the canvas. Times screenSize it
      // counts device pixels, and over the cell edge its floor is the cell's
      // column and row. The grid anchors at the top-left, as LedWall's does,
      // so with pixelSize equal to the wall's spacing the two grids line up
      // cell for cell. max(1) keeps the divide finite if pixelSize animates
      // through 0.
      const cellPx = pixelSizeUniform.mul(dprUniform).max(1);
      const cellIndex = floor(coordinate.mul(screenSize).div(cellPx));

      // The cell's center, back in the 0..1 frame. Every pixel in the cell
      // samples here, so the whole cell measures one lightness. Under
      // LedWall with matching cells, the coordinate is already this center,
      // and snapping it again changes nothing.
      const cellCenter = cellIndex.add(0.5).mul(cellPx).div(screenSize);

      // ---------------------------------------------
      // One sample of the image beneath
      // ---------------------------------------------
      const beneath = sampleBeneath(cellCenter);

      // The scene texture is premultiplied: each channel is already scaled
      // by alpha. Dividing by alpha recovers the color itself, so a
      // half-transparent edge measures as light as the opaque area next to
      // it rather than darker. MIN_ALPHA keeps the divide finite at alpha 0.
      const color = vec3(beneath.rgb).div(beneath.a.max(MIN_ALPHA));

      // ---------------------------------------------
      // How light is it?
      // ---------------------------------------------
      // OKLab's L, perceived lightness: 0 is black, 1 is white. For a gray
      // it is the cube root of the gray's linear value, so a black-to-white
      // Source that mixes in OKLab, every component's default, hands over an
      // L that rises evenly with the Source's own value. max(0) first: a
      // wide-gamut color can carry a negative channel, and the cube root of
      // one would pull L below 0. Only L is used. The conversion also builds
      // the a and b axes, which reach no output, so the GPU's own compiler
      // is free to drop them.
      const lightness = linearToOklab(color.max(0)).x;

      // ---------------------------------------------
      // Round up or down? The dither
      // ---------------------------------------------
      // The cell's blue-noise value, 0 to just under 1, read from a 64x64
      // tile of thresholds arranged so that neighbors differ and no clumps
      // form. Indexed by cell, one tile texel per cell, so the scatter keeps
      // that clump-free spacing at any cell size.
      const noise = ditherThreshold('blue-noise', cellIndex);

      // spread pivots the noise around the plain 0.5 round, as Dither's
      // does. At 0 every cell rounds at 0.5, clean bands. At 1 the rounding
      // point runs 0..1, so a cell a third of the way from one color to the
      // next has a one-in-three chance of taking the next: the share of each
      // color follows the lightness, and the edge turns to scattered cells.
      // At 0.5 only lightness within a quarter step of the midpoint
      // scatters, a narrower mixed edge. Above 1 the point overshoots 0..1,
      // so even a cell sitting exactly on a color can flip to a neighbor.
      const rounding = noise.sub(0.5).mul(spreadUniform).add(0.5);

      // ---------------------------------------------
      // Which palette color?
      // ---------------------------------------------
      // The palette splits 0..1 into evenly spaced levels, one per color:
      // with six colors, at 0, 0.2, 0.4, and on to 1. lightness times
      // (count - 1) puts each level on a whole number, and adding the
      // rounding point before the floor picks the level below or above, the
      // same formula quantize() uses. A Source brighter than white, such as
      // an additive glow, or a spread above 1 can land past either end, so
      // the clamp holds it to the first or last color.
      const lastIndex = colors.length - 1;
      const level = lightness.mul(lastIndex).add(rounding).floor().clamp(0, lastIndex);

      // Pick the color for that level. The level is a whole number, so each
      // select tests it against a whole-number threshold and swaps in that
      // color once the level reaches it. Every step names the running
      // result once, which keeps the chain cheap to compile (the
      // running-minimum gotcha in docs/agents/tsl.md is the twice-named
      // case). The output is exactly a palette color, never a blend.
      const palette = colors.map((entry) => vec3(...parseColor(entry)));
      let picked = palette[0] ?? vec3(0, 0, 0);

      for (let index = 1; index < palette.length; index += 1) {
        const next = palette[index];

        if (next !== undefined) {
          picked = select(level.greaterThanEqual(float(index)), next, picked);
        }
      }

      // Back to premultiplied form with the image's own alpha, so the
      // palette covers exactly what the Sources covered and the page still
      // shows where they left it transparent.
      return vec4(picked.mul(beneath.a), beneath.a);
    },
    [colorsKey, pixelSizeUniform, spreadUniform, dprUniform],
  );

  return null;
}
