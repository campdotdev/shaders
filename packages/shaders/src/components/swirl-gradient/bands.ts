// How SwirlGradient colors each band coordinate along the trace:
// the stops eased in with smoothstep, the seams smoothed across one pixel,
// and the bands' average color, which threads thinner than a pixel fade to.
// A cached palette keeps color-space conversion out of the tracing loop.
// The shader (./shader.tsx) measures how much of the ramp one pixel spans
// with fwidth() and hands that footprint to each of these.
import type { ShaderNodeObject } from 'three/tsl';
import {
  clamp,
  float,
  Fn,
  Loop,
  max,
  mix,
  smoothstep,
  texture,
  type uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { HalfFloatType, LinearFilter, NearestFilter, type Node } from 'three/webgpu';

import {
  colorRamp,
  type ColorRampStop,
  type ColorSpace,
  createTexturePass,
  type HueInterpolation,
  type TSLNode,
} from '../../engine.js';
import type { ShaderContextValue } from '../../react/context/shader-context.js';

// The narrowest a stop's blend may get, as a fraction of its segment. It
// keeps smoothstep's two edges apart, because smoothstep(a, a, x) divides
// by zero. Far below a pixel at any canvas size.
const MIN_BLEND_WIDTH = 1e-4;

// How many points along the ramp the average pass reads. Hard bands need
// enough to land each stop's edge close to where it is: 64 places it within
// 1/128 of the ramp.
const AVERAGE_SAMPLES = 64;

// The inline fallback reads fewer, because every pixel pays for them.
const INLINE_AVERAGE_SAMPLES = 16;

/** The palette and how to blend it, shared by every coloring step. */
export interface BandPalette {
  stops: ColorRampStop[];
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
}

// ---------------------------------------------
// The stops, eased in
// ---------------------------------------------

/**
 * The band coordinate, reshaped so colorRamp's straight blend between two
 * stops becomes an eased one. colorRamp blends linearly across each segment
 * (the stretch between two neighboring stops), so the color's rate of change
 * jumps at every stop, and the eye reads that jump as a faint crease. Easing
 * each segment through smoothstep flattens the blend to zero slope at both
 * of its stops, so neighboring segments meet without a crease.
 *
 * The blend fills the middle `width` of each segment. At softness 1 that is
 * the whole segment: smoothstep(0, 1, x), the S-curve. At softness 0 it
 * would be a hard step at the segment's middle, so each stop owns a flat
 * band, as FractalNoise's softness 0 does. The blend never gets narrower
 * than one pixel's footprint, though, so a hard edge still spans a pixel
 * and reads smooth instead of stair-stepped.
 *
 * The reshaped coordinate is a sum over the segments. Each segment adds its
 * eased share of its own span: none before the coordinate reaches it, all
 * of it once the coordinate has passed it. Inside segment j everything
 * before it adds up to its start, so the sum lands at
 * start_j + span_j x ease(x), and colorRamp turns that back into an eased
 * blend between stop j and stop j + 1.
 */
export function easeStops(
  coordinate: TSLNode,
  stops: ColorRampStop[],
  softness: TSLNode,
  footprint: TSLNode,
): ShaderNodeObject<Node> {
  const first = stops[0];

  if (first === undefined) return float(coordinate);

  let eased = float(first.position);

  // Mirrors colorRamp's own walk: adjacent pairs, skipping a pair with no
  // span to blend across.
  for (let i = 1; i < stops.length; i += 1) {
    const start = stops[i - 1]?.position ?? 0;
    const span = (stops[i]?.position ?? 0) - start;

    if (span <= 0) continue;

    // The footprint is in whole passes of the ramp, so dividing by the
    // span gives it as a fraction of this segment.
    const width = clamp(max(softness, float(footprint).div(span)), MIN_BLEND_WIDTH, 1);
    const halfWidth = width.mul(0.5);
    const segmentX = float(coordinate).sub(start).div(span);

    // smoothstep is 0 below its first edge and 1 above its second, so x
    // before the segment adds nothing and x past it adds the whole span.
    eased = eased.add(
      smoothstep(float(0.5).sub(halfWidth), halfWidth.add(0.5), segmentX).mul(span),
    );
  }

  return eased;
}

/** The color of a band coordinate, its stops eased in. */
export function bandColor(
  coordinate: TSLNode,
  { stops, colorSpace, hueInterpolation }: BandPalette,
  softness: TSLNode,
  footprint: TSLNode,
): ShaderNodeObject<Node> {
  return colorRamp(
    easeStops(coordinate, stops, softness, footprint),
    stops,
    colorSpace,
    hueInterpolation,
  );
}

// ---------------------------------------------
// Cache the palette for reads along a trace
// ---------------------------------------------

// Samples across one pass of the ramp. The endpoints occupy texel centers,
// so clamped reads preserve the first and last colors. 1024 half-float RGBA
// texels use 8 KiB. More samples reduce interpolation error between texels.
const RAMP_TEXELS = 1024;

/** A cached ramp, with the same inputs as bandColor and an owned texture. */
export interface RampPass {
  colorAt: (coordinate: TSLNode, softness: TSLNode, footprint: TSLNode) => ShaderNodeObject<Node>;
  dispose: () => void;
}

/**
 * Cache color-space conversion once per palette, so every trace sample
 * reads RGB instead of evaluating the full colorRamp. Stop easing still
 * runs at the read, because its width depends on the pixel's footprint.
 */
export function createRampPass(shaderContext: ShaderContextValue, palette: BandPalette): RampPass {
  const inline: RampPass = {
    colorAt: (coordinate, softness, footprint) =>
      bandColor(coordinate, palette, softness, footprint),
    dispose: () => {
      // The inline path owns no texture or pre-pass.
    },
  };

  // A narrow stop interval needs more samples than this table can give it.
  // Keep the exact calculation there, and for constant or linear palettes
  // whose conversion costs too little to justify a texture read.
  const hasNarrowInterval = palette.stops.some((stop, index) => {
    const previous = palette.stops[index - 1];
    const span = previous === undefined ? 0 : stop.position - previous.position;

    return span > 0 && span < 4 / (RAMP_TEXELS - 1);
  });

  if (palette.stops.length < 2 || palette.colorSpace === 'linear' || hasNarrowInterval)
    return inline;

  const coordinate = uv()
    .x.mul(RAMP_TEXELS)
    .sub(0.5)
    .div(RAMP_TEXELS - 1);
  const pass = createTexturePass(
    shaderContext.renderer.three,
    vec4(colorRamp(coordinate, palette.stops, palette.colorSpace, palette.hueInterpolation), 1),
    { width: RAMP_TEXELS, height: 1, type: HalfFloatType, filter: LinearFilter },
  );
  const rampTexture = pass.texture;

  if (rampTexture === null) return inline;

  // Palette edits rebuild the material and this cache together. Draw once,
  // before the scene first samples it, then reuse it even as softness moves.
  let drawn = false;
  const removePrePass = shaderContext.registerPrePass(() => {
    if (drawn) return;
    pass.render();
    drawn = true;
  });

  return {
    colorAt: (position, softness, footprint) => {
      const eased = easeStops(position, palette.stops, softness, footprint);
      const sampleX = clamp(eased, 0, 1)
        .mul(RAMP_TEXELS - 1)
        .add(0.5)
        .div(RAMP_TEXELS);

      return texture(rampTexture, vec2(sampleX, 0.5)).rgb;
    },
    dispose() {
      removePrePass();
      pass.dispose();
    },
  };
}

// ---------------------------------------------
// The seams, smoothed
// ---------------------------------------------

/**
 * Smooths the seams, where the repeating coordinate drops from 1 back to 0
 * and the last stop meets the first. A pixel's color comes from one point,
 * its center, so a pixel the seam crosses lands wholly on one side, and a
 * curved seam comes out as a staircase. Here a pixel near the seam takes
 * the share of the other side's color that its footprint covers instead,
 * so the seam spans one pixel and reads as a smooth line.
 *
 * `coordinate` is the repeating 0..1 band coordinate and `footprint` how
 * much of it one pixel spans. Near the top, the part of the footprint past 1
 * belongs to the first stop. Near the bottom, the part below 0 belongs to
 * the last. The blend is in linear light, as light mixes inside one pixel.
 * `seamWeight` turns the smoothing off at a single pass, which has no seam.
 */
export function smoothSeams(
  color: TSLNode,
  coordinate: TSLNode,
  footprint: TSLNode,
  { first, last }: { first: TSLNode; last: TSLNode },
  seamWeight: TSLNode,
): ShaderNodeObject<Node> {
  const halfFootprint = float(footprint).mul(0.5);
  const safeFootprint = max(footprint, 1e-5);
  const pastTop = clamp(float(coordinate).add(halfFootprint).sub(1).div(safeFootprint), 0, 1);
  const belowBottom = clamp(halfFootprint.sub(coordinate).div(safeFootprint), 0, 1);

  const withFirst = mix(color, first, pastTop.mul(seamWeight));

  return mix(withFirst, last, belowBottom.mul(seamWeight));
}

// ---------------------------------------------
// The bands' average color
// ---------------------------------------------

/**
 * The average color of one whole pass of the bands: the color a pixel should
 * show once it spans every stop, as when the flow stretches a thread thinner
 * than a pixel. Reads the eased ramp at evenly spaced points and averages
 * them in linear light, the way light averages inside a pixel. Averaging the
 * stop colors alone misses the ramp's blend curve: on a dark-to-light
 * palette it landed 0.1 off in OKLab, enough to show as a halo where the
 * threads fade.
 */
function averageBandColor(palette: BandPalette, softness: TSLNode, sampleCount: number) {
  return Fn(() => {
    const total = vec3(0, 0, 0).toVar();

    Loop(sampleCount, ({ i }: { i: ShaderNodeObject<Node> }) => {
      // Each sample sits at the middle of its share of the ramp, and with no
      // footprint the eased blend is softness's alone.
      const coordinate = float(i).add(0.5).div(sampleCount);

      total.addAssign(bandColor(coordinate, palette, softness, float(0)));
    });

    return total.div(sampleCount);
  })();
}

/** The average pass's handle: the average color, and how to release it. */
export interface AveragePass {
  color: ShaderNodeObject<Node>;
  dispose: () => void;
}

/**
 * Draws the bands' average color into a one-texel texture, so a pixel reads
 * one texel instead of sampling the ramp 64 times. The average depends on
 * the palette and on softness, never on the pixel. A palette change rebuilds
 * the material and this pass with it, so the pass redraws only when softness
 * has moved since its last draw. Where the renderer can't draw half floats,
 * every pixel works it out from fewer samples instead, and `dispose` has
 * nothing to release.
 *
 * The caller creates and disposes the pass in one effect, so a Strict Mode
 * remount builds a fresh one (the Strict Mode gotcha in docs/agents/tsl.md).
 */
export function createAveragePass(
  shaderContext: ShaderContextValue,
  palette: BandPalette,
  softness: ReturnType<typeof uniform<number>>,
): AveragePass {
  // A half float keeps the dark end of linear light, which an 8-bit texel
  // rounds into visible steps. One texel needs no filtering.
  const pass = createTexturePass(
    shaderContext.renderer.three,
    vec4(averageBandColor(palette, softness, AVERAGE_SAMPLES), 1),
    { width: 1, height: 1, type: HalfFloatType, filter: NearestFilter },
  );
  const averageTexture = pass.texture;

  if (averageTexture === null) {
    return {
      color: averageBandColor(palette, softness, INLINE_AVERAGE_SAMPLES),
      dispose: () => {
        // Nothing was allocated.
      },
    };
  }

  // A pre-pass draws before the scene pass in the same frame, so a softness
  // change reaches the average on the frame it lands (the draw-order gotcha
  // in docs/agents/tsl.md). Each draw is its own render pass, and a pass
  // costs time to begin and end even for one texel: drawing every frame
  // read 0.04 ms in the Reactive card's window at 2x, a tenth of its
  // budget. So the pre-pass checks softness on the CPU first and skips the
  // draw while it holds still. NaN never equals a number, so the first
  // frame always draws.
  let drawnSoftness = Number.NaN;
  const removePrePass = shaderContext.registerPrePass(() => {
    if (softness.value === drawnSoftness) return;
    drawnSoftness = softness.value;
    pass.render();
  });

  return {
    // The coordinate goes in when the node is built, so three skips the
    // texture matrix (the texture-matrix gotcha in docs/agents/tsl.md).
    color: texture(averageTexture, vec2(0.5, 0.5)).rgb,
    dispose() {
      removePrePass();
      pass.dispose();
    },
  };
}
