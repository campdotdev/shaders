'use client';

// Swells' GPU half. Unlike the flat Sources, this one draws a 3D world. The
// pixel's journey: cast a ray from a perspective camera through the pixel
// (cameraRay), follow it until it meets the surface (marchHeightMap), light
// the surface it hits by how it faces the light and add a sheen, blend it
// into the haze and fade it out with distance, and leave the pixel
// transparent where the ray misses, so the page, or a Source mounted
// beneath, shows through as the sky. The camera glides over the surface and
// can sway sideways toward a point, and the swells rise and fall in place.
// The wrapper (./swells.tsx) supplies the props.
import { useEffect, useRef, useState } from 'react';

import {
  abs,
  atan,
  Break,
  clamp,
  cos,
  dot,
  float,
  floor,
  Fn,
  fract,
  If,
  length,
  Loop,
  max,
  min,
  mix,
  type ShaderNodeObject,
  sin,
  smoothstep,
  sqrt,
  step,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  HalfFloatType,
  LinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PlaneGeometry,
  type Texture,
  type Vector2,
} from 'three/webgpu';

import {
  cameraRay,
  type ColorSpace,
  createReducedMotionWatcher,
  createTexturePass,
  getReducedMotionTimeScale,
  type HueInterpolation,
  marchHeightMap,
  mixColor,
  type SchedulerTick,
  stableHash,
} from '../../engine.js';
import type { ShaderContextValue } from '../../react/context/shader-context.js';
import {
  type AnimatableProp,
  isSignal,
  type PositionProp,
} from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatablePoint } from '../../react/hooks/use-animatable-point/use-animatable-point.js';
import { useAnimatableSpeed } from '../../react/hooks/use-animatable-speed/use-animatable-speed.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useAspectUniform } from '../../react/hooks/use-aspect-uniform/use-aspect-uniform.js';
import { useColorUniform } from '../../react/hooks/use-color-uniform/use-color-uniform.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';

type TSLValue = ShaderNodeObject<Node>;
type FloatUniform = ReturnType<typeof uniform<number>>;
type Vector2Uniform = ReturnType<typeof uniform<Vector2>>;

// ---------------------------------------------
// Feel constants
// ---------------------------------------------
// Tuned by eye at the defaults gate (SHA-327). They are baked into the
// shader as literals, so none of them is a prop.

// The share of the ray's height above the ground that each march step
// moves (marchHeightMap's stepScale). Lower is safer on steep slopes and
// reaches less far in the same steps.
const STEP_SCALE = 0.5;

// The steepest a swell's face may get, as height gained per unit of ground:
// 3 climbs at about 72 degrees. A crest steeper than the march's steps can
// follow slips between two of them, both above the ground, and the ray
// draws the ground behind it instead. Short, tall swells, a high `scale`
// with a high `relief`, get there first, so `relief` stops raising them
// once their steepest face reaches this slope. Higher lets taller, sharper
// swells through and lets more crests slip; lower flattens more of them.
const MAX_SLOPE = 3;

// How far the camera sees, in terrain units. A ray that travels this far
// without meeting the ground counts as a miss.
const MAX_DISTANCE = 40;

// The share of each swell's length that its steep downwind face takes at
// full `sharpness`, 0 to 1. On a dune, wind pushes sand up the long, gentle
// windward face and drops it over the crest, where it slides down a short,
// steep face (the slip face). Lower makes that face shorter and steeper;
// 0.5 makes both faces alike. At `sharpness={0}` both faces are alike
// whatever this is.
const SLIP_FACE = 0.3;

// How wide a band the crest rounds over at `sharpness={0}`, in the swell's
// own height (the triangle below climbs 0 to 1). The band narrows as
// `sharpness` rises and closes at 1, where the faces meet at an edge. Higher
// gives broader, softer crests. Keep it at 1 or under, since past that the
// band would reach the trough and lift it.
const CREST_ROUNDING = 0.8;

// How far the crests wander from straight lines, in swell lengths. 0 lines
// them up like a ploughed field; higher bends and breaks them more.
const MEANDER = 1.5;

// The distance from one ripple's crest to the next, in terrain units. It
// stays put when `scale` changes, as real wind ripples do. Lower packs them
// tighter, and below about 0.08 they get finer than the normal's height
// reads can follow (NORMAL_OFFSET below).
const RIPPLE_SIZE = 0.1;

// How tall the ripples are at `ripples={1}`, in terrain units. Real sand
// ripples are a few centimetres on dunes metres tall, so a little goes a
// long way: the light picks them out from their slope, not their height.
const RIPPLE_HEIGHT = 0.008;

// How many steps each pixel's ray takes. It is the loop's bound, which
// WebGL2 accepts only as a fixed number. More steps reach further toward
// the horizon and cost GPU time on every pixel.
const STEP_COUNT = 64;

// How far apart, in terrain units, the normal's height reads sit on either
// side of a hit. Twice the primitive's default, because the far ground's
// hits are rough (marchHeightMap's distance JSDoc says why) and a wider
// spread averages over that. Lower picks up finer bumps in the light; higher
// smooths them away.
const NORMAL_OFFSET = 0.02;

// How many layers of noise the roll sums: broad, gentle noise under the
// swells that lifts and lowers whole stretches of the surface. Each adds
// bumps half the size of the last. More adds finer detail and costs a noise
// read per march step.
const ROLL_OCTAVES = 2;

// How many noise cells span one swell length for the roll, which both bends
// the crests and lifts and lowers whole stretches of the surface. At 0.5 one
// roll spans about two swells.
const ROLL_FREQUENCY = 0.5;

// How much of the surface's height comes from the roll rather than the
// swells, as a share of the swells' own height. Higher rolls the ground more
// between the crests.
const ROLL_SHARE = 0.35;

// How many noise cells span one swell length for each swell's strength, which
// makes one crest stand tall and the next one fade. Higher varies it over a
// shorter stretch.
const STRENGTH_FREQUENCY = 0.8;

// The weakest a swell gets, as a share of the tallest. 1 makes every crest
// the same height; 0 lets some flatten out entirely.
const MIN_STRENGTH = 0.4;

// The ripples' crests wobble from straight lines over a long wavelength:
// how many ripple lengths one full wobble spans across the wind (190 is
// about 19 terrain units at the default ripple size), and how many ripple
// lengths it pushes a crest at the most.
const RIPPLE_WOBBLE_LENGTH = 190;
const RIPPLE_WOBBLE = 1.4;

// How far the roll bends the ripples, in ripple lengths across one roll, so
// the ripples curve with the ground under them instead of running ruler
// straight across every swell.
const RIPPLE_ROLL_BEND = 6;

// Where the ripples fade out, in ripple lengths from the camera. Far away a
// pixel covers several ripples, and the light flickers between their lit
// and shaded sides from pixel to pixel (aliasing, a pattern finer than the
// pixels sampling it). Fading them out before then leaves a smooth far field.
const RIPPLE_FADE_START = 15;
const RIPPLE_FADE_END = 60;

// How tightly the sheen gathers around the light's reflection: the exponent
// the highlight's falloff is raised to (the Shade it by the light section
// says how). Low spreads a broad, soft glow over every face near the
// reflection, which reads as satin; high pinches it into a small, bright
// glint, which reads as wet or polished.
const SHEEN_FOCUS = 12;

// The share of the camera's reach, at its far end, over which the surface
// fades out whatever the haze, 0 to 1. At 0.4 and the 40-unit reach, the
// fade runs from 24 units to 40. Out there some rays meet the ground and
// their neighbors run out of steps or out of reach and miss it, which
// leaves slivers of sky between the far crests; fading that ground out
// hides them. Higher fades more of the far field; 0 turns the fade off and
// leaves the surface ending in a hard, ragged edge at the reach.
const REACH_FADE = 0.4;

// How many times further out the surface fades to transparent than it
// turns to `hazeColor`. At 2, the ground has mostly taken the haze's color
// by the time it starts to thin, so the far field glows in that color
// before it dissolves into what is beneath. At 1 the two happen together
// and the glow is faint; higher holds the glowing band longer.
const HAZE_FADE_LAG = 2;

// `scale` counts the swells, crest to crest, in this many terrain units, so
// a swell is SWELL_SPAN / scale units long. Counting swells, rather than
// giving a swell's length, keeps `scale` a density, as it is on FractalNoise
// and Voronoi: higher packs in more, smaller features.
const SWELL_SPAN = 10;

// The range of `scale` the shader works with. It divides SWELL_SPAN, so 0
// would blow up. Past MAX_SCALE a swell shorter than a quarter unit packs
// the noise so fine that the far field turns to grain. MIN_SCALE makes a
// swell 100 units long, past the horizon.
const MIN_SCALE = 0.1;
const MAX_SCALE = 40;

// Slides every point before the noise cuts it into cells. Any whole number
// gives an equally random surface; this one picks the surface the defaults
// are tuned on.
const HASH_DOMAIN_OFFSET = 1024;

// Each cell's corner hashes x + y * ROW_STRIDE, one whole number per
// corner. The noise wraps each cell coordinate into 0..ROW_STRIDE - 1
// before it hashes, so the sum stays under 2^24, where a float still holds
// every whole number exactly on both backends (the seeded-randomness gotcha
// in docs/agents/tsl.md), and never goes negative, which stableHash's u32
// conversion can't take. The wrap matters once the camera glides, because
// the glide carries the noise coordinates without bound. The noise repeats
// every ROW_STRIDE cells, thousands of swells, too far apart to notice.
const ROW_STRIDE = 4096;

// The swells' rise and fall moves their strength through a cycle of this
// many noise slices, one per second at `swellSpeed={1}`, then starts over.
// "Drift the swells' strength" below says how. 64 seconds at
// that speed, and longer when slower, is too long a cycle to notice
// repeating.
const STRENGTH_SLICES = 64;

// How far apart neighboring slices sit in the strength noise, in its cells.
// Anything over a few cells makes each slice an unrelated pattern; the
// fractions keep slices off the noise's grid lines.
const SLICE_STEP = [37.1, 19.7] as const;

// Slides the strength noise away from the roll, in the strength noise's
// cells, so a swell's strength doesn't track the roll beneath it. Any offset
// of a few cells works; this one picks the pattern the defaults are tuned on.
const STRENGTH_OFFSET = [41.7, 23.9] as const;

// The field texture (createFieldPass below). It covers the ground the march
// reaches: MAX_DISTANCE to either side of the camera and ahead of it, plus
// about a unit of margin for the normal's reads around a hit at the edge of
// the reach and for the grid's snap. Behind the camera it covers
// FIELD_BEHIND units, enough for rays aimed past straight down, which the
// demo's widest view and steepest tilt reach about 1.5 units behind a camera
// at altitude 4. A point past the texture's edge, which a steeper view or a
// higher camera can reach, works the fields out inline ("Read the surface's
// fields" in SwellsShader). Each texel is FIELD_TEXEL units square, and the
// texel counts round each side up to a whole number of texels.
//
// The width stops at WEBGL2_MIN_TEXTURE_SIDE, the longest side every WebGL2
// device allows, which trims the side margin to 0.96 units. createTexturePass
// clamps a longer side to the device's limit, which would stretch each
// texel past FIELD_TEXEL, and the march's snap and bounds, worked out in
// FIELD_TEXEL steps, would then miss the texels the pass drew.
//
// The filter blends the fields in straight lines between texel centers, so
// the surface's slope changes at each texel's edge, which shows as faint
// facets in the light where the noise cells are only a few texels wide: at
// a high `scale`. At 0.04 units, 2048 by 1125 texels and about 18 MB, a
// frame at `scale` 40 matches the inline fields by eye, and the pass costs
// no more GPU time than one at 0.08 units did (SHA-327).
const FIELD_TEXEL = 0.04;
const FIELD_BEHIND = 4;
const WEBGL2_MIN_TEXTURE_SIDE = 2048;
const FIELD_WIDTH = Math.min(
  Math.ceil((MAX_DISTANCE * 2 + 2) / FIELD_TEXEL),
  WEBGL2_MIN_TEXTURE_SIDE,
);
const FIELD_HEIGHT = Math.ceil((MAX_DISTANCE + 1 + FIELD_BEHIND) / FIELD_TEXEL);
const FIELD_SPAN = [FIELD_WIDTH * FIELD_TEXEL, FIELD_HEIGHT * FIELD_TEXEL] as const;

// The reduced-motion time scale counts as full motion only at 1. The sway
// toward parallaxCenter holds still at any lower scale, and this sits just
// under 1 so step() reads 1 exactly as on.
const FULL_MOTION = 0.999;

// How far ahead of the camera, in terrain units, the point it keeps facing
// sits while it sways. Ground at this distance holds still, nearer ground
// slides against the sway, and farther ground slides with it. At the
// default camera the middle of the canvas looks at ground about 7 units
// off. Lower turns the camera harder for the same sway; higher turns it
// less, until the sway is a plain slide.
const PARALLAX_PIVOT = 8;

// How long the intro takes, in seconds, from flat ground under thick haze
// to the finished surface. Higher is slower and calmer.
const INTRO_SECONDS = 3;

// How wide the band at the intro's rise front is, in terrain units. The
// front sweeps in from the edge of the camera's reach toward the camera,
// and ground lifts from flat to its full height as the band passes over it.
// Lower gives a sharper wave of rising ground; higher a softer swell that
// lifts a wider stretch at once.
const INTRO_FRONT = 10;

// How thick the haze is when the intro starts, per terrain unit, like
// `haze`. At 0.2 about 5 units of ground show before the haze takes over.
// Higher hides more of the ground at the start; lower opens with clearer
// air. A `haze` thicker than this starts and stays at its own value.
const INTRO_HAZE = 0.2;

// The share of the intro over which the haze clears, 0 to 1. At 0.5 the air
// is clear by halfway, so the far ground shows while the rise front is still
// out there and the viewer watches it roll in. Lower clears it sooner; 1
// spreads the clearing over the whole intro, which hides more of the far
// rise behind the haze.
const INTRO_HAZE_SHARE = 0.5;

// The longest slice of time one tick may add to the intro's clock, in
// seconds, as in useAnimatableSpeed: a tick after a long stall would
// otherwise jump the intro straight to its end. Normal frames, 16 to 33 ms,
// never come near it.
const INTRO_MAX_DELTA = 0.1;

const DEGREES_TO_RADIANS = Math.PI / 180;

// How many times the shadow ray reads the surface
// on its way from a lit point toward the light. More steps catch thinner
// crests and cost GPU time on every lit pixel: about 1.9 ms a frame at 24,
// 1.0 ms at 12, and 0.6 ms at 8, at 2x on an M1 Max. The author saw no
// difference between 24 and 12 in motion. 8 looked the same too, but it
// leaves half the margin against a thin crest for 0.4 ms.
const SHADOW_STEPS = 12;

// The furthest the shadow ray looks for a crest
// in its way, in terrain units. A light near the horizon would otherwise
// send the ray almost level, and it would never climb clear of the swells.
const SHADOW_REACH = 12;

// The width of a cast shadow's soft edge, as the slope between the shadow
// ray and the crest it grazes: 0.01 is a hard edge, 0.15 a wide blur.
const SHADOW_EDGE = 0.052;

// The most light the sky adds to a face the sun
// doesn't reach, at `skylight` 1, as a share of full sunlight. Higher lifts
// the shadows further toward `color`.
const SKYLIGHT_SHARE = 0.45;

// How tightly the glow hugs surfaces seen edge-on: the
// exponent on 1 minus the cosine between the surface and the view. Low
// spreads the glow over every face that leans away; high keeps only the
// thin rims of crests.
const RIM_FOCUS = 4;

// The smallest and largest cell `glintSize` allows, in
// terrain units. A cell holds one grain, and its glint fills about half of
// it.
const GLINT_SIZE_MIN = 0.002;
const GLINT_SIZE_MAX = 0.2;

// How exactly a grain must mirror the light at the camera to flash: the
// exponent on the cosine between its face and the mirror direction. At 400
// a grain flashes only within about 3.4 degrees, about one grain in 550. At
// 40 the window is about 10.7 degrees, about one in 60, and each flash
// lasts longer. 148 sits between, nearer the busy end.
const GLINT_FOCUS = 148;

// Where the glints fade out, in cells from the camera.
// A cell this far away is about a pixel wide, and further out it would
// flicker as noise. At a `glintSize` of 0.02 the fade runs from 5 to 14
// terrain units.
const GLINT_FADE_START = 250;
const GLINT_FADE_END = 700;

// The grain cells' hash wraps each coordinate into
// 0..GLINT_STRIDE - 1, so the two whole numbers each cell hashes stay under
// 2^24, the largest a float holds exactly (ROW_STRIDE above).
const GLINT_STRIDE = 2048;

// The middle of the canvas, as a position prop: the sway's center when a
// fixed `parallax` of 0 or reduced motion leaves it nothing to do.
const CANVAS_CENTER: readonly [number, number] = [0.5, 0.5];

// ---------------------------------------------
// Noise for the surface's shape
// ---------------------------------------------

/**
 * Wraps a whole number into 0..count - 1, negative numbers included, as
 * value - floor(value / count) * count. It is spelled out rather than
 * mod(), because WGSL's % keeps a negative number's sign and GLSL's mod()
 * doesn't, so the two backends would land on different numbers.
 */
const wrapInto = (value: TSLValue, count: number): TSLValue =>
  value.sub(floor(value.div(count)).mul(count));

/**
 * Value noise: a random height at each whole-number grid point, blended
 * smoothly between them. Returns 0..1. It is the cheapest smooth noise, a
 * hash per corner and a few multiplies, which matters because the march
 * reads the height on every step (the 128-second-compile gotcha in
 * docs/agents/tsl.md rules out simplex here).
 */
const valueNoise = (point: TSLValue): TSLValue => {
  const shifted = point.add(HASH_DOMAIN_OFFSET);

  // Which cell the point is in, and where in that cell, 0..1 each way.
  const cell = floor(shifted);
  const local = fract(shifted);

  // The blend weights. A straight blend would crease at every cell edge;
  // the smoothstep curve 3t^2 - 2t^3 starts and ends flat, so the slope is
  // continuous across edges and the light shows no grid.
  const weight = local.mul(local).mul(local.mul(-2).add(3));

  // The random height at a corner, from one whole number per corner. Each
  // coordinate wraps into 0..ROW_STRIDE - 1 first (ROW_STRIDE above).
  const corner = (offsetX: number, offsetY: number) =>
    stableHash(
      wrapInto(cell.x.add(offsetX), ROW_STRIDE).add(
        wrapInto(cell.y.add(offsetY), ROW_STRIDE).mul(ROW_STRIDE),
      ),
    );

  const bottom = mix(corner(0, 0), corner(1, 0), weight.x);
  const top = mix(corner(0, 1), corner(1, 1), weight.x);

  return mix(bottom, top, weight.y);
};

/**
 * ROLL_OCTAVES layers of value noise, each twice as fine and half as tall
 * as the last. Each octave turns the grid by about 37 degrees (the 0.8 and
 * 0.6 below are its cosine and sine) and slides it by an arbitrary offset,
 * (17.3, 9.1), so the octaves' grid lines and their shared origin don't
 * line up into visible rows or a seam at (0, 0). Dividing by the summed
 * amplitudes keeps the result 0..1.
 */
const layeredNoise = (point: TSLValue): TSLValue => {
  let sum: TSLValue = float(0);
  let octavePoint = point;
  let amplitude = 1;
  let total = 0;

  for (let octave = 0; octave < ROLL_OCTAVES; octave += 1) {
    sum = sum.add(valueNoise(octavePoint).mul(amplitude));
    total += amplitude;
    amplitude *= 0.5;
    octavePoint = vec2(
      octavePoint.x.mul(0.8).sub(octavePoint.y.mul(0.6)),
      octavePoint.x.mul(0.6).add(octavePoint.y.mul(0.8)),
    )
      .mul(2)
      .add(vec2(17.3, 9.1));
  }

  return sum.div(total);
};

// ---------------------------------------------
// The surface's fields: the roll and each swell's strength
// ---------------------------------------------

/** The strength drift's state for this frame, pinned before any loop. */
interface StrengthDrift {
  sliceBlend: TSLValue;
  spreadRestore: TSLValue;
  offsetNow: TSLValue;
  offsetNext: TSLValue;
}

/**
 * Drift the swells' strength. Each swell's strength, how tall it stands
 * against its neighbors, comes from a slow noise field (surfaceFields below).
 * To make the swells rise and fall in place, the field changes over time
 * while the crests stay where they are. Noise in 2D has no time axis, so the
 * drift fakes one: it reads two unrelated slices of the noise, the current
 * one and the next, and blends from one to the other as the clock runs.
 * swellClock counts slices, so its whole part picks the slices and its
 * fraction is how far the blend has gone.
 *
 * Both slice numbers wrap into 0..STRENGTH_SLICES - 1, the next one too, so
 * the last slice of the cycle blends into the first and the cycle closes
 * with no jump. Each slice number then slides the noise by SLICE_STEP cells
 * that many times, which gives each its own pattern. At swellSpeed 0 the
 * clock stays at 0, so the strength reads slice 0 alone and the swells hold
 * still.
 *
 * smoothstep() eases each blend in and out, so every swell slows to a stop
 * at the end of a slice, then starts toward its next height: a slow breath
 * rather than a steady crawl.
 *
 * A blend of two unrelated noises is flatter than either: halfway, the highs
 * and lows partly cancel, and the spread around the middle falls to
 * sqrt(0.5 ^ 2 + 0.5 ^ 2) = 0.71 of a single slice's. Left alone, every
 * crest would even out once per slice. Dividing the distance from the middle
 * by sqrt(w ^ 2 + (1 - w) ^ 2), where w is the blend, puts the spread back,
 * and it is 1 at either end of a blend, where one slice shows alone.
 *
 * All of this depends on the clock alone, so .toVar() pins it where this is
 * called, before any loop (the first-use gotcha in docs/agents/tsl.md).
 */
const strengthDrift = (swellClock: FloatUniform): StrengthDrift => {
  const sliceNow = wrapInto(floor(swellClock), STRENGTH_SLICES).toVar();
  const sliceNext = wrapInto(sliceNow.add(1), STRENGTH_SLICES).toVar();
  const sliceBlend = smoothstep(0, 1, fract(swellClock)).toVar();
  const spreadRestore = float(1)
    .div(sqrt(sliceBlend.mul(sliceBlend).add(sliceBlend.oneMinus().mul(sliceBlend.oneMinus()))))
    .toVar();
  const sliceOffset = (slice: TSLValue) =>
    vec2(...SLICE_STEP)
      .mul(slice)
      .add(vec2(...STRENGTH_OFFSET))
      .toVar();

  return {
    sliceBlend,
    spreadRestore,
    offsetNow: sliceOffset(sliceNow),
    offsetNext: sliceOffset(sliceNext),
  };
};

/**
 * The two noise fields under the surface at a point on the ground, in world
 * terrain units, as vec2(roll, strength).
 *
 * The roll: broad noise, 0..1, that lifts and lowers the ground and bends
 * the crests. Each swell's strength is a second noise, slid by an arbitrary
 * offset so it doesn't track the roll, and drifting between two slices as
 * the swells rise and fall (strengthDrift above). The blend is pulled back
 * out from the middle by spreadRestore. It can pass 0..1 at a rare extreme,
 * and the caller clamps it after any texture read, so the texture's filter
 * blends the smooth value (the texture-pass case in "Keep shared work out of
 * per-pixel loops" in docs/agents/tsl.md).
 */
const surfaceFields = (
  worldPoint: TSLValue,
  swellLength: TSLValue,
  drift: StrengthDrift,
): TSLValue => {
  // The point in swell lengths, so one unit is one swell, crest to crest.
  const swellPoint = worldPoint.div(swellLength);
  const roll = layeredNoise(swellPoint.mul(ROLL_FREQUENCY));
  const strengthPoint = swellPoint.mul(STRENGTH_FREQUENCY);

  // The next slice costs a noise read, four hashes, and at a swellSpeed of 0
  // its blend weight is 0, so the read would go to waste. If() makes it a
  // real GPU branch, a block the GPU runs only when its condition holds. The
  // condition reads a uniform, so every pixel takes the same side and none
  // waits on its neighbors (pixels shaded together run in lockstep, and a
  // branch they split on costs both sides). Skipped, the next slice stays 0,
  // and mix() takes none of it. A clock stopped partway through a blend keeps
  // both reads, because its weight is over 0.
  const strengthNow = valueNoise(strengthPoint.add(drift.offsetNow)).toVar();
  const strengthNext = float(0).toVar();

  If(drift.sliceBlend.greaterThan(0), () => {
    strengthNext.assign(valueNoise(strengthPoint.add(drift.offsetNext)));
  });

  const strength = mix(strengthNow, strengthNext, drift.sliceBlend)
    .sub(0.5)
    .mul(drift.spreadRestore)
    .add(0.5);

  return vec2(roll, strength);
};

/** How long a swell is, crest to crest, in terrain units, from `scale`. */
const swellLengthFrom = (scale: FloatUniform): TSLValue =>
  float(SWELL_SPAN).div(clamp(scale, MIN_SCALE, MAX_SCALE));

/**
 * The parallax sway, in terrain units right of the camera's resting place,
 * and the switch that holds it at 0 below full motion. See "Cast the pixel's
 * ray" in SwellsShader for how the sway works. The parallax center uniform
 * goes in as an argument to add(), never as the receiver of a chained call
 * (the vec-uniform gotcha in docs/agents/tsl.md).
 */
const cameraSway = (parallaxCenter: Vector2Uniform, parallax: FloatUniform) => {
  const fullMotion = step(FULL_MOTION, getReducedMotionTimeScale());
  const towardCenter = clamp(vec2(-0.5, -0.5).add(parallaxCenter).mul(2), -1, 1);

  return { fullMotion, swayRight: towardCenter.x.mul(parallax).mul(fullMotion) };
};

/**
 * The world point at the field texture's corner, for a camera standing over
 * `cameraWorld`. The texture follows the camera, but in whole texels: the
 * corner snaps to the texel grid, so each texel sits on the same world point
 * from frame to frame while the camera glides. A texture that slid with the
 * camera would land its texels on new points each frame, and the filter's
 * small error between texels would crawl over the surface.
 */
const fieldCornerFor = (cameraWorld: TSLValue): TSLValue =>
  floor(cameraWorld.div(FIELD_TEXEL))
    .mul(FIELD_TEXEL)
    .sub(vec2(FIELD_SPAN[0] / 2, FIELD_BEHIND));

interface FieldPassInputs {
  shaderContext: ShaderContextValue;
  scale: FloatUniform;
  swellClock: FloatUniform;
  travel: FloatUniform;
  parallax: FloatUniform;
  parallaxCenter: Vector2Uniform;
}

/** The field pass's texture and its teardown. */
interface FieldPass {
  /** vec2(roll, strength) over the ground ahead of the camera, in r and g. */
  texture: Texture;
  /** Stop drawing the fields, and release the texture. */
  dispose: () => void;
}

/**
 * Draws the surface's two noise fields into a texture once a frame, so each
 * of the march's height reads takes one texture read instead of four value
 * noises, sixteen hashes. The fields depend on a point on the ground and on
 * the uniforms, never on the pixel, so every pixel's reads share one 2D
 * field: the third case in "Keep shared work out of per-pixel loops" in
 * docs/agents/tsl.md, with Aurora's field pass as the model.
 *
 * The texture covers the ground the march reaches (FIELD_TEXEL above), its
 * corner snapped to the texel grid (fieldCornerFor above). Each texel works out the fields
 * at its world point. The march works out the same corner from the same
 * uniforms, and the output stage draws pre-passes ahead of the scene pass in
 * the same frame, so the two agree (the draw-order gotcha in
 * docs/agents/tsl.md).
 *
 * Returns null where the renderer cannot draw into a half-float target, and
 * the march works out the fields inline.
 */
function createFieldPass({
  shaderContext,
  scale,
  swellClock,
  travel,
  parallax,
  parallaxCenter,
}: FieldPassInputs): FieldPass | null {
  const fieldNode = Fn(() => {
    const { swayRight } = cameraSway(parallaxCenter, parallax);
    const corner = fieldCornerFor(vec2(swayRight, travel));
    const worldPoint = uv()
      .mul(vec2(...FIELD_SPAN))
      .add(corner);

    return vec4(surfaceFields(worldPoint, swellLengthFrom(scale), strengthDrift(swellClock)), 0, 1);
  })();

  // A half float holds the fields to about three significant digits, and
  // linear filtering blends the four texels around each read, so the
  // fields vary smoothly between texel centers.
  const pass = createTexturePass(shaderContext.renderer.three, fieldNode, {
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
    type: HalfFloatType,
    filter: LinearFilter,
  });
  const fieldTexture = pass.texture;

  if (fieldTexture === null) return null;

  const removePrePass = shaderContext.registerPrePass(pass.render);

  return {
    texture: fieldTexture,
    dispose() {
      removePrePass();
      pass.dispose();
    },
  };
}

/** The uniforms for the light and air over the surface: the sheen and the haze. */
function useAirUniforms({
  sheen,
  sheenColor,
  haze,
  hazeColor,
}: Pick<SwellsShaderProps, 'sheen' | 'sheenColor' | 'haze' | 'hazeColor'>) {
  return {
    sheenUniform: useAnimatableUniform<number>(sheen),
    sheenColorUniform: useColorUniform(sheenColor),
    hazeUniform: useAnimatableUniform<number>(haze),
    hazeColorUniform: useColorUniform(hazeColor),
  };
}

/**
 * The uniforms for the motion: the camera's travel, the swells' clock, and
 * the sway toward parallaxCenter.
 */
function useMotionUniforms({
  speed,
  swellSpeed,
  parallax,
  parallaxCenter,
  isFullMotion,
}: Pick<SwellsShaderProps, 'speed' | 'swellSpeed' | 'parallax' | 'parallaxCenter'> & {
  isFullMotion: boolean;
}) {
  return {
    // How far the camera has glided, in terrain units: speed times each
    // frame's seconds, summed on the CPU and scaled by the reduced-motion
    // time scale. Summing keeps a speed change from making the surface
    // jump, which speed times elapsed time would. The scene rewinds it to 0
    // at its first frame with content.
    travelUniform: useAnimatableSpeed(speed),
    // How far the swells' strength has drifted, in noise slices, summed the
    // same way.
    swellClock: useAnimatableSpeed(swellSpeed),
    parallaxUniform: useAnimatableUniform<number>(parallax),
    // The center as uv, 0..1 with y up: screenOrigin flips the prop's
    // top-left frame, so up on the canvas is up in the shader. "cursor"
    // resolves to the scene's shared pointer. A fixed `parallax` of 0 holds
    // the camera still wherever the center is, and so does reduced motion,
    // so the canvas center stands in for the center there: following the
    // pointer or a signal would wake the march on every move to draw the
    // same picture. A `parallax` signal can leave 0 at any frame, so it
    // keeps the center.
    parallaxCenterUniform: useAnimatablePoint(
      parallax === 0 || !isFullMotion ? CANVAS_CENTER : parallaxCenter,
      { screenOrigin: true },
    ),
  };
}

/**
 * Whether the reduced-motion policy allows full motion, the only scale at
 * which the sway moves. Kept current as the policy changes, and each change
 * asks for a frame: the sway reads the engine's shared time-scale uniform,
 * which the engine updates without asking for one, so a parked scene would
 * keep the old sway on screen (the bare-uniform-write gotcha in
 * docs/agents/tsl.md).
 */
function useFullMotion(scheduler: ShaderContextValue['scheduler'] | undefined): boolean {
  const [isFullMotion, setIsFullMotion] = useState(() => {
    const motion = createReducedMotionWatcher();
    const scale = motion.scale();

    motion.dispose();

    return scale >= FULL_MOTION;
  });

  useEffect(() => {
    const motion = createReducedMotionWatcher();
    const stopMotion = motion.subscribe((scale) => {
      setIsFullMotion(scale >= FULL_MOTION);
      scheduler?.requestRender();
    });

    // A watcher reports changes only, so seed from this one's scale: the
    // policy can change after the render read it and before this effect
    // runs, such as from another component's layout effect.
    setIsFullMotion(motion.scale() >= FULL_MOTION);

    return () => {
      stopMotion();
      motion.dispose();
    };
  }, [scheduler]);

  return isFullMotion;
}

/**
 * The intro's clock (ADR 0007): a uniform that runs 0 to 1 over the intro,
 * and whether the intro is still playing. It plays once per mount. A
 * scheduler client sums each tick's seconds into the clock and asks for the
 * next frame until the clock lands on 1, as CursorTrail does while its
 * trail fades. Once landed it stays landed, so a prop change, the intro
 * switched off and on, a resumed scene, or a later phase reset never
 * replays it.
 *
 * A phase reset before the intro lands starts the clock over from the
 * reset's origin. The scene resets at its first frame with content, so the
 * intro starts there and the renderer's start-up time doesn't eat into it.
 * The visual-test harness resets the same way. A Swells that mounts into a
 * scene already drawing gets no reset and starts its intro at mount.
 *
 * The intro lands at once when `intro` is off, and whenever the
 * reduced-motion time scale isn't 1, as under the `paused` policy posters
 * and visual tests use and the slow policy's 0.3x. The client reads the
 * engine's time scale on each tick rather than `isFullMotion`, which only
 * catches up on the next render. The shader skips the intro under reduced
 * motion on its own too ("Settle the intro" in the shader), so the first
 * frame shows the finished surface before this client's first tick.
 */
function useIntro({
  intro,
  isFullMotion,
  scheduler,
}: {
  intro: boolean;
  isFullMotion: boolean;
  scheduler: ShaderContextValue['scheduler'] | undefined;
}) {
  const [isIntroPlaying, setIsIntroPlaying] = useState(() => intro && isFullMotion);

  // Created once, so the material that captures it never rebuilds. It starts
  // at 1, the finished surface, unless the intro is about to play.
  const [introUniform] = useState(() => uniform(intro && isFullMotion ? 0 : 1));

  // The clock's seconds, and whether it has landed, read and written by the
  // scheduler client below between renders.
  const clockRef = useRef(0);
  const landedRef = useRef(!(intro && isFullMotion));

  // The prop as of the last render, read fresh by the client on each tick.
  const introRef = useRef(intro);

  useEffect(() => {
    introRef.current = intro;
  }, [intro]);

  useEffect(() => {
    if (!scheduler) return undefined;

    const timeScale = getReducedMotionTimeScale();
    const canPlay = () => introRef.current && timeScale.value >= FULL_MOTION;

    // Writes the clock's share of the intro into the uniform, lands the
    // intro once it reaches 1, and asks for a frame to show it. The scene
    // draws before its children's clients each frame, so a value written
    // on a tick shows on the next frame, and a parked scene would never
    // draw it at all (the bare-uniform-write gotcha in docs/agents/tsl.md).
    // That holds on the landing tick too, which draws the finished surface.
    const writeProgress = () => {
      const progress = Math.min(clockRef.current / INTRO_SECONDS, 1);

      introUniform.value = progress;
      landedRef.current = progress >= 1;
      setIsIntroPlaying(!landedRef.current);
      scheduler.requestRender();
    };

    const advance = ({ delta }: SchedulerTick) => {
      if (landedRef.current) return;

      clockRef.current = canPlay()
        ? clockRef.current + Math.min(delta, INTRO_MAX_DELTA)
        : Number.POSITIVE_INFINITY;
      writeProgress();
    };

    scheduler.add(advance);

    // A reset starts an intro that hasn't landed over from the origin. One
    // that can't play now is left for the next tick to land.
    const stopReset = scheduler.onPhaseReset((originSeconds) => {
      if (landedRef.current || !canPlay()) return;
      clockRef.current = originSeconds;
      writeProgress();
    });

    return () => {
      scheduler.remove(advance);
      stopReset();
    };
  }, [scheduler, introUniform]);

  return { introUniform, isIntroPlaying };
}

/**
 * Swells' render-on-demand vote: true when nothing it draws changes between
 * frames, so the scene may stop drawing. Two dials move the picture on
 * their own: the glide and the swells' rise and fall. A signal is live
 * whatever it reads now, because it can change between renders.
 *
 * The sway doesn't count, even toward the cursor. A cursor moves only when
 * the pointer does, and useCursor wakes the scene on every move and keeps
 * it drawing until its smoothing settles, so a still pointer can let the
 * scene park, as LedWall's swell center does (SHA-139).
 */
function isSwellsStill({
  speed,
  swellSpeed,
}: Pick<SwellsShaderProps, 'speed' | 'swellSpeed'>): boolean {
  if (isSignal(speed) || isSignal(swellSpeed)) return false;

  return speed === 0 && swellSpeed === 0;
}

export interface SwellsShaderProps {
  /**
   * How high the camera sits above the ground, in terrain units. Accepts a
   * static value or an animation signal.
   */
  altitude: AnimatableProp<number>;
  /**
   * How far the camera looks down from the horizon, in degrees. Accepts a
   * static value or an animation signal.
   */
  tilt: AnimatableProp<number>;
  /**
   * How much the camera sees from the bottom of the canvas to the top, in
   * degrees. Accepts a static value or an animation signal.
   */
  fieldOfView: AnimatableProp<number>;
  /**
   * How many swells, crest to crest, fit in 10 terrain units. Accepts a
   * static value or an animation signal.
   */
  scale: AnimatableProp<number>;
  /**
   * How tall the swells are, in terrain units, where 0 is level ground.
   * Short swells stop growing taller once their faces reach MAX_SLOPE.
   * Accepts a static value or an animation signal.
   */
  relief: AnimatableProp<number>;
  /**
   * The swells' shape, from 0 (round swells) to 1 (sharp dune crests).
   * Accepts a static value or an animation signal.
   */
  sharpness: AnimatableProp<number>;
  /**
   * Which way the swells face, in compass degrees clockwise from the way
   * the camera faces at rest. The crests run square to it. Accepts a static
   * value or an animation signal.
   */
  angle: AnimatableProp<number>;
  /**
   * How strong the fine ripples are, from 0 to 1, where 0 is a smooth
   * surface. Accepts a static value or an animation signal.
   */
  ripples: AnimatableProp<number>;
  /**
   * Where the light sits around the scene, in compass degrees clockwise from
   * the way the camera faces at rest. The light stays put while a parallax
   * sway turns the camera. Accepts a static value or an animation signal.
   */
  lightAngle: AnimatableProp<number>;
  /**
   * How high the light sits, in degrees above the horizon. Accepts a static
   * value or an animation signal.
   */
  lightHeight: AnimatableProp<number>;
  /** The surface's color in full light: hex, `oklch()`, or `oklab()`. */
  color: string;
  /** The surface's color on faces turned from the light: hex, `oklch()`, or `oklab()`. */
  shadowColor: string;
  /**
   * How strong the soft highlight is where the surface mirrors the light, from
   * 0 (a matte surface) to 1. Accepts a static value or an animation signal.
   */
  sheen: AnimatableProp<number>;
  /** The highlight's color: hex, `oklch()`, or `oklab()`. */
  sheenColor: string;
  /**
   * How thick the haze is, per terrain unit: how fast the surface turns to
   * `hazeColor` and then fades out with distance, where 0 is clear air.
   * Accepts a static value or an animation signal.
   */
  haze: AnimatableProp<number>;
  /** The haze's color: hex, `oklch()`, or `oklab()`. */
  hazeColor: string;
  /**
   * The color space the slopes between `shadowColor` and `color`, the
   * sheen over them, and the haze blend in.
   */
  colorSpace: ColorSpace;
  /** The hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert otherwise. */
  hueInterpolation: HueInterpolation;
  /**
   * How fast the camera glides forward, in terrain units per second, where
   * negative glides backward. Accepts a static value or an animation signal.
   */
  speed: AnimatableProp<number>;
  /**
   * How fast the swells rise and fall in place, in noise slices per second,
   * where 0 holds them still. Accepts a static value or an animation signal.
   */
  swellSpeed: AnimatableProp<number>;
  /**
   * How far the camera sways sideways toward `parallaxCenter`, in terrain
   * units, at the most. Held at 0 under reduced motion. Accepts a static
   * value or an animation signal.
   */
  parallax: AnimatableProp<number>;
  /**
   * The point the camera sways toward, 0..1 across the canvas with `[0, 0]`
   * at the top-left corner, or `"cursor"`. Only its x moves the camera.
   * Accepts a static value or an animation signal.
   */
  parallaxCenter: PositionProp;
  /**
   * Whether the surface builds itself in when the scene first draws: it
   * rises from flat ground in a sweep from the horizon toward the camera
   * while the haze clears. Plays once per mount, and skips to the finished
   * surface under reduced motion.
   */
  intro: boolean;
  /**
   * How dark the shadows are that crests cast across the surface behind
   * them, from 0 (none, and no GPU cost) to 1 (a shadowed point gets no
   * direct light). Accepts a static value or an animation signal.
   */
  shadows: AnimatableProp<number>;
  /**
   * How much light the sky adds to faces the light doesn't reach, from 0
   * (none, so they take `shadowColor` alone) to 1. Accepts a static value
   * or an animation signal.
   */
  skylight: AnimatableProp<number>;
  /**
   * How strongly surfaces seen edge-on, the rims of crests and the far
   * ground, glow in `sheenColor`, from 0 (none) to 1. Accepts a static
   * value or an animation signal.
   */
  rimGlow: AnimatableProp<number>;
  /**
   * How bright the grains of sand flash where they mirror the light at the
   * camera, from 0 (none) to 1. Accepts a static value or an animation
   * signal.
   */
  glints: AnimatableProp<number>;
  /**
   * How wide one grain's cell is, in terrain units, from 0.002 to 0.2.
   * Higher draws bigger glints, further apart, that show
   * from further away. Accepts a static value or an animation signal.
   */
  glintSize: AnimatableProp<number>;
}

export function SwellsShader({
  altitude,
  tilt,
  fieldOfView,
  scale,
  relief,
  sharpness,
  angle,
  ripples,
  lightAngle,
  lightHeight,
  color,
  shadowColor,
  sheen,
  sheenColor,
  haze,
  hazeColor,
  colorSpace,
  hueInterpolation,
  speed,
  swellSpeed,
  parallax,
  parallaxCenter,
  intro,
  shadows,
  skylight,
  rimGlow,
  glints,
  glintSize,
}: SwellsShaderProps) {
  const shaderContext = useShaderContext();
  const isFullMotion = useFullMotion(shaderContext?.scheduler);

  // Every dial lives in a uniform, a value the CPU can change each frame
  // without rebuilding the shader, tracking a static number or a signal.
  const altitudeUniform = useAnimatableUniform<number>(altitude);
  const tiltUniform = useAnimatableUniform<number>(tilt);
  const fieldOfViewUniform = useAnimatableUniform<number>(fieldOfView);
  const scaleUniform = useAnimatableUniform<number>(scale);
  const reliefUniform = useAnimatableUniform<number>(relief);
  const sharpnessUniform = useAnimatableUniform<number>(sharpness);
  const angleUniform = useAnimatableUniform<number>(angle);
  const ripplesUniform = useAnimatableUniform<number>(ripples);
  const lightAngleUniform = useAnimatableUniform<number>(lightAngle);
  const lightHeightUniform = useAnimatableUniform<number>(lightHeight);
  const colorUniform = useColorUniform(color);
  const shadowColorUniform = useColorUniform(shadowColor);
  const { sheenUniform, sheenColorUniform, hazeUniform, hazeColorUniform } = useAirUniforms({
    sheen,
    sheenColor,
    haze,
    hazeColor,
  });
  const { travelUniform, swellClock, parallaxUniform, parallaxCenterUniform } = useMotionUniforms({
    speed,
    swellSpeed,
    parallax,
    parallaxCenter,
    isFullMotion,
  });

  const shadowsUniform = useAnimatableUniform<number>(shadows);
  const skylightUniform = useAnimatableUniform<number>(skylight);
  const rimGlowUniform = useAnimatableUniform<number>(rimGlow);
  const glintsUniform = useAnimatableUniform<number>(glints);
  const glintSizeUniform = useAnimatableUniform<number>(glintSize);

  const { introUniform, isIntroPlaying } = useIntro({
    intro,
    isFullMotion,
    scheduler: shaderContext?.scheduler,
  });

  useStaticSceneHint(!isIntroPlaying && isSwellsStill({ speed, swellSpeed }));

  // Canvas width over height, so the view widens on a wide canvas instead
  // of stretching the terrain.
  const aspectNode = useAspectUniform();

  // ---------------------------------------------
  // Mount the mesh
  // ---------------------------------------------
  // The mesh is made once per scene and outlives every material rebuild
  // below. three draws transparent meshes in the order they were created
  // when nothing else separates them, and Swells is transparent where the
  // sky shows through. A rebuild that made a new mesh would draw Swells
  // after a Source later in the JSX, such as DotField, and cover it. The
  // mesh holds no material yet. The effect below, which runs right after
  // this one in the same commit and before any frame draws, supplies it.
  const meshRef = useRef<Mesh | null>(null);

  useEffect(() => {
    if (!shaderContext) return;

    // A 2x2 plane exactly fills ShaderScene's camera view (-1..1 on both
    // axes), so every pixel of the canvas casts a ray.
    const mesh = new Mesh(new PlaneGeometry(2, 2));

    meshRef.current = mesh;
    shaderContext.scene.add(mesh);

    return () => {
      meshRef.current = null;
      shaderContext.scene.remove(mesh);
      // Another still Source can keep the scene parked, and a parked scene
      // would keep showing the surface, so ask for a frame without it.
      shaderContext.scheduler.requestRender();
      try {
        mesh.geometry.dispose();
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
    };
  }, [shaderContext]);

  // ---------------------------------------------
  // Build the material and hand it to the mesh
  // ---------------------------------------------
  // Runs once per mount, and again when `colorSpace` or `hueInterpolation`
  // changes, because each space's blend is different shader code. Every
  // other dial flows through a uniform, so nothing else here depends on a
  // prop's value.
  useEffect(() => {
    const mesh = meshRef.current;

    if (!shaderContext || !mesh) return;

    // The field pass, which draws the roll and the strength once a frame for
    // the march to read (createFieldPass above). Null where the renderer
    // cannot draw into a half-float target (WebGL2 without
    // EXT_color_buffer_float), and the march then works the fields out at
    // every height read with the same TSL. It is created and disposed in
    // this effect, so a Strict Mode remount builds a fresh one (the Strict
    // Mode gotcha in docs/agents/tsl.md).
    const fieldPass = createFieldPass({
      shaderContext,
      scale: scaleUniform,
      swellClock,
      travel: travelUniform,
      parallax: parallaxUniform,
      parallaxCenter: parallaxCenterUniform,
    });

    // Fn() wraps the body in a GPU function node, which gives the march's
    // loop a list of statements to append to. The trailing () calls it once
    // to produce the node the material renders.
    const swellsNode = Fn(() => {
      // ---------------------------------------------
      // Cast the pixel's ray
      // ---------------------------------------------
      // uv() is the pixel's place on the full-canvas quad, 0..1 both ways,
      // which cameraRay turns into a ray through that point of the view.
      //
      // The parallax sway first. Parallax is how near things slide
      // further than far ones when the eye moves: shift your head and a
      // fence post next to you jumps across the hills behind it. So the
      // camera moves sideways toward parallaxCenter. A turn alone would
      // swing the whole view by the same angle, near and far alike, and
      // show no depth.
      //
      // The camera orbits rather than slides: as it moves, it turns to keep
      // facing a point PARALLAX_PIVOT units ahead of where it rests. Ground
      // at the pivot holds still, nearer ground slides against the sway,
      // and farther ground slides with it. The glide already carries the
      // diagonal crests across the view, so a sway can cancel the near
      // crests' motion. The far ground then moves the other way, so some of
      // the view always moves.
      //
      // From the camera at (swayRight, 0) the pivot at (0, pivot) lies
      // (-swayRight, pivot) away, and atan() of the one over the other is
      // the angle right of straight ahead, so a sway right turns the camera
      // left. cameraRay takes it in degrees. The pivot is always ahead, so
      // the one-argument atan() covers every angle, and it avoids
      // the atan2 gotcha in docs/agents/tsl.md: with no sway the sway's
      // negation is -0, and atan2() over WebGL read that as half a turn.
      //
      // Only sideways. The camera keeps its altitude, because a camera
      // moved down sinks into the swells: once it is level with the crests
      // the ray starts inside or against a slope, and every ray skims crest
      // after crest until the march runs out of steps.
      //
      // The center's x, minus the canvas center, times 2, runs -1 at the
      // left edge to 1 at the right edge, and clamp() holds a signal that
      // strays off the canvas to that range. Times `parallax` it is the
      // sway in terrain units, so a center at an edge moves the camera the
      // full amount and the canvas center not at all. heightAt below slides
      // the surface under the camera by it, the way the glide does.
      //
      // Under reduced motion the sway holds at 0. The engine's time scale
      // is 1 at full motion, 0.3 slowed, and 0 paused, and step() is 1 only
      // at full motion (FULL_MOTION above), so it switches the sway off at
      // any lower scale rather than slowing it: a slower sway would still
      // move the view under a moving pointer. cameraSway above works it out,
      // so the field pass finds the same camera position.
      const sway = cameraSway(parallaxCenterUniform, parallaxUniform);
      const fullMotion = sway.fullMotion;
      const swayRight = sway.swayRight.toVar();
      const orbitTurn = atan(swayRight.negate().div(PARALLAX_PIVOT))
        .div(DEGREES_TO_RADIANS)
        .toVar();
      const camera = {
        aspect: aspectNode,
        altitude: altitudeUniform,
        tilt: tiltUniform,
        fieldOfView: fieldOfViewUniform,
        turn: { right: orbitTurn },
      };
      const ray = cameraRay(uv(), camera);

      // ---------------------------------------------
      // Settle the wind and the sizes before the march
      // ---------------------------------------------
      // These depend on the uniforms alone, so every step of every pixel's
      // march would work them out the same. .toVar() pins each in a GPU
      // variable here, before the loop, rather than where the march first
      // reads it, which is inside the loop (the first-use gotcha in
      // docs/agents/tsl.md).
      //
      // The way the swells face (`angle`) on the ground, as a unit vec2 of
      // (x, z). Think of it as a wind: the crests run square to it, and at
      // full sharpness each steep face looks downwind, as a dune's does. The
      // compass angle's sine is how far it points right (+x), and its
      // cosine how far it points ahead (+z), so 0 points straight ahead and
      // lays the crests straight across the canvas.
      const windRadians = angleUniform.mul(DEGREES_TO_RADIANS);
      const windX = sin(windRadians).toVar();
      const windZ = cos(windRadians).toVar();
      const swellLength = swellLengthFrom(scaleUniform).toVar();
      const rippleLength = float(RIPPLE_SIZE);
      // How sharp the swells are, kept to 0..1, and where each one's crest
      // falls along it. A round swell is symmetric, so its crest sits
      // halfway; a sharp one is a dune, whose crest sits past its long
      // windward face. mix() slides the crest between the two.
      const sharpnessAmount = clamp(sharpnessUniform, 0, 1).toVar();
      const crestShare = mix(0.5, 1 - SLIP_FACE, sharpnessAmount).toVar();
      const fallShare = crestShare.oneMinus().toVar();
      // The crest's rounding band (CREST_ROUNDING above). It shrinks with
      // sharpness squared rather than sharpness, so the band stays wide
      // through the lower half of the slider and closes fast near 1: at 0.5
      // it is still three quarters as wide. A band of exactly 0 would
      // divide by 0 below, so max() keeps a sliver, far too thin to see.
      // Rounding lowers the crest by a quarter of the band's width, and
      // crestRestore scales the profile back up so the crest still reaches 1
      // and `relief` keeps its meaning.
      const crestRounding = sharpnessAmount
        .mul(sharpnessAmount)
        .oneMinus()
        .mul(CREST_ROUNDING)
        .max(1e-4)
        .toVar();
      const crestRestore = float(1).div(crestRounding.mul(-0.25).add(1)).toVar();
      const rippleAmplitude = ripplesUniform.mul(RIPPLE_HEIGHT).toVar();

      // The relief the swells are built with, `relief` held down where the
      // swells are too short to carry it (MAX_SLOPE above). A face climbs
      // the swell's height over the face's length, and the profile's curve
      // below steepens that straight climb at its steepest point: 1.5 times,
      // halfway up, for the round curve, and 2 times, at the crest, for the
      // sharp one, blended by sharpness. crestRestore stretches the height
      // a little more, and the shorter face is the steeper one. The swell
      // takes relief / (1 + ROLL_SHARE) of the height, so a relief of
      // MAX_SLOPE * (1 + ROLL_SHARE) * face length / steepening puts the
      // steepest face right at the limit. min() keeps whichever of that and
      // `relief` is lower. At the defaults, swells about 3.3 units long whose
      // shorter face is 1.5 units, the limit is about 3, well above the
      // default relief of 0.9, so it changes nothing there. The roll's
      // meander packs crests closer in places, which steepens them past this
      // estimate, so MAX_SLOPE sits well under the slope where crests start
      // to slip.
      const steepening = mix(float(1.5), float(2), sharpnessAmount).mul(crestRestore);
      const shortestFace = min(crestShare, fallShare).mul(swellLength);
      const limitedRelief = min(
        reliefUniform,
        shortestFace.mul(MAX_SLOPE * (1 + ROLL_SHARE)).div(steepening),
      ).toVar();

      // How far a ground point lies along the wind, and across it to the
      // wind's right, in the units the point is in. A dot product with the
      // wind's direction measures along it; the direction turned a quarter
      // turn, (windZ, -windX), measures across it.
      const alongWind = (point: TSLValue) => point.x.mul(windX).add(point.y.mul(windZ));
      const acrossWind = (point: TSLValue) => point.x.mul(windZ).sub(point.y.mul(windX));

      // ---------------------------------------------
      // Read the surface's fields
      // ---------------------------------------------
      // The roll and each swell's strength (surfaceFields above). With a
      // field pass, one read of its texture at the point's place in it: the
      // world point less the texture's corner, over its span, 0..1 across.
      // The corner comes from the same uniforms the field pass reads, so it
      // lands on the same texels, and it is pinned here, before the loop.
      // The read passes its mip level, 0, because the march's loop breaks
      // out at a different step for each pixel (the sample-level gotcha in
      // docs/agents/tsl.md). The coordinate goes in when the node is built,
      // so three adds no matrix multiply (the texture-matrix gotcha in
      // docs/agents/tsl.md).
      //
      // Without a field pass, the fields are worked out inline at every
      // height read, with the drift's state pinned here once.
      //
      // A camera aimed further down than the texture allows for (FIELD_BEHIND
      // above) reaches ground past the texture's edge, where a read would
      // repeat the edge texel. Those reads work the fields out inline too.
      // The bounds sit half a texel in from each edge, where the filter
      // still has a texel on both sides. If() makes the inline work a real
      // GPU branch, so pixels whose reads all land inside the texture skip
      // it. At the demo's camera settings every read on the camera's ray
      // does. A shadow ray walks toward the light and can pass the edge.
      const drift = strengthDrift(swellClock);
      const inlineFieldsAt = (worldPoint: TSLValue) =>
        surfaceFields(worldPoint, swellLength, drift);
      const fieldsAt = (() => {
        if (fieldPass === null) return inlineFieldsAt;
        const fieldCorner = fieldCornerFor(vec2(swayRight, travelUniform)).toVar();
        const coveredHalf = vec2(0.5 - 0.5 / FIELD_WIDTH, 0.5 - 0.5 / FIELD_HEIGHT);

        return (worldPoint: TSLValue) => {
          const fieldUv = worldPoint
            .sub(fieldCorner)
            .div(vec2(...FIELD_SPAN))
            .toVar();
          const fields = texture(fieldPass.texture, fieldUv, float(0)).xy.toVar();
          const overshoot = abs(fieldUv.sub(0.5)).sub(coveredHalf);

          If(max(overshoot.x, overshoot.y).greaterThan(0), () => {
            fields.assign(inlineFieldsAt(worldPoint));
          });

          return fields;
        };
      })();

      // ---------------------------------------------
      // Settle the intro
      // ---------------------------------------------
      // The intro builds the surface in from flat ground under thick haze.
      // introUniform runs 0 to 1 over the intro on the CPU (useIntro
      // above). max() with 1 - fullMotion holds it at 1, the finished
      // surface, at any reduced-motion scale below full motion, so a poster
      // or a reduced-motion first frame shows the finished surface before
      // the CPU's clock has ticked once. Once landed, every value below
      // works out to what it is with no intro, to within float rounding, so
      // the finished surface is the picture Swells drew before it had one.
      //
      // The rise front: a circle around the camera that shrinks from the
      // edge of its reach to the camera's feet. Ground beyond the front has
      // risen; ground inside it is still flat. Seen through the camera, the
      // circle is a line across the ground that sweeps from the horizon
      // toward the viewer. The progress eases out, as 1 - (1 - t)^3: the
      // front starts fast and settles as it nears the camera, the curve an
      // entrance wants. It also evens out how fast the front looks to move.
      // Perspective squeezes the far ground into a few rows of pixels, so a
      // front that started slowly out there would show nothing at all for
      // the first moments. mix() then slides the front from MAX_DISTANCE at
      // 0 to one band width behind the camera at 1. Ending there, rather
      // than at the camera, carries the band's whole width past the camera's
      // feet, so all the ground has risen in full at the end.
      const introProgress = max(introUniform, fullMotion.oneMinus()).toVar();
      const frontLeft = introProgress.oneMinus();
      const frontEased = frontLeft.mul(frontLeft).mul(frontLeft).oneMinus();
      const riseFront = mix(MAX_DISTANCE, -INTRO_FRONT, frontEased).toVar();
      const riseFrontEnd = riseFront.add(INTRO_FRONT).toVar();

      // ---------------------------------------------
      // The surface's height: swells, roll, and ripples
      // ---------------------------------------------
      // The march calls this with a ground point (x, z) on every step and
      // every bisection step, then once more where it stopped, and the
      // normal calls it four more times around the hit. The point is where
      // the ray is relative to the camera, which stands over (0, 0).
      //
      // The shadow ray passes includeRipples as false and reads the swells
      // alone. The ripples are finer than the shadow ray's steps, so reading
      // them there would speckle the shadows.
      const heightAt = (groundPoint: TSLValue, includeRipples = true) => {
        // The glide. The camera stays at the origin, and the surface slides
        // toward it instead: every point reads the surface `travel` units
        // further ahead (+z, the way the camera faces). That looks the same
        // as the camera moving forward, and it keeps the march's numbers,
        // its distances and its ray, small. The parallax sway (+x, to the
        // camera's right) slides the surface the same way. A float holds the
        // travel to within about a thousandth of a unit until it reaches
        // about 8,000 units, which takes over 7 hours at the default speed,
        // so the ripples, the finest detail, stay sharp that long.
        const worldPoint = groundPoint.add(vec2(swayRight, travelUniform));

        // The point in swell lengths, so one unit is one swell, crest to crest.
        const swellPoint = worldPoint.div(swellLength);

        // The roll and each swell's strength ("Read the surface's fields"
        // above). The strength is clamped to 0..1 here, after the read,
        // which the restored spread can pass at a rare extreme.
        const fields = fieldsAt(worldPoint).toVar();
        const roll = fields.x;
        const strength = clamp(fields.y, 0, 1);

        // Where the point falls within its swell, 0..1 from one trough to
        // the next, measured downwind. fract() keeps the fractional part, so
        // the count repeats once per swell length. Adding the roll, centered
        // on 0 and scaled by the meander, slides the crests up and down the
        // wind from place to place, so they bend instead of running straight.
        const withinSwell = fract(alongWind(swellPoint).add(roll.sub(0.5).mul(MEANDER)));

        // The swell's profile starts as a triangle that climbs from 0 at the
        // trough to 1 at the crest, then drops back to 0. Each face is a
        // straight line, the first rising as withinSwell / crestShare and the
        // second falling as (1 - withinSwell) / fallShare. Taking whichever
        // is lower gives the rising line before the crest and the falling
        // one after, and a sharp corner where they cross.
        //
        // A smooth minimum rounds that corner off. Where the two lines are
        // further apart than the rounding band, toRise is 0 or 1 and picks
        // the lower one outright, as min() would. Inside the band it slides
        // from one line to the other, and subtracting band * t * (1 - t),
        // which peaks at a quarter of the band halfway across, bends the
        // join into a curve with no corner.
        const rise = withinSwell.div(crestShare);
        const fall = withinSwell.oneMinus().div(fallShare);
        const toRise = clamp(fall.sub(rise).div(crestRounding).mul(0.5).add(0.5), 0, 1);
        const ridge = mix(fall, rise, toRise)
          .sub(crestRounding.mul(toRise).mul(toRise.oneMinus()))
          .mul(crestRestore)
          .toVar();

        // Two curves then bend the faces, and `sharpness` blends between
        // them.
        //
        // Round: the smoothstep curve 3r^2 - 2r^3, which starts and ends
        // flat, so the swell eases out of the trough and over the crest with
        // no corner at either, like a sine wave.
        //
        // Sharp: the square r^2, flat at the trough but still steep at the
        // crest, so at full sharpness, where the rounding band has closed,
        // both faces meet at an edge. That edge is what splits a dune into a
        // lit face and a shaded one.
        const round = ridge.mul(ridge).mul(ridge.mul(-2).add(3));
        const sharp = ridge.mul(ridge);
        const profile = mix(round, sharp, sharpnessAmount);

        // The swell's own height, scaled by its strength, then the roll
        // added under it. Dividing by 1 + ROLL_SHARE brings the tallest
        // sum back to 1, so `relief` is the height of the tallest crests,
        // unless the slope limit above holds it down, before the ripples add
        // their few thousandths of a unit on top.
        //
        // The intro's rise ("Settle the intro" above) then scales it from
        // flat to full by the point's distance from the camera. smoothstep()
        // runs 0 at the rise front to 1 one band width beyond it, so ground
        // the front has passed stands at its full height, ground it hasn't
        // reached lies flat, and the band between lifts smoothly. The band
        // adds a slope of at most 1.5 * relief / band, where smoothstep() is
        // steepest, about 0.14 at the defaults, far under MAX_SLOPE, so the
        // march still follows it. Once the intro lands the front sits a band
        // behind the camera, and every point reads 1. The ripples rise with
        // the swells (below), so the ground at the start is smooth and level.
        const distance = length(groundPoint);
        const risen = smoothstep(riseFront, riseFrontEnd, distance);
        const swells = profile
          .mul(mix(MIN_STRENGTH, 1, strength))
          .add(roll.mul(ROLL_SHARE))
          .div(1 + ROLL_SHARE)
          .mul(limitedRelief)
          .mul(risen);

        if (!includeRipples) return swells;

        // The ripples: a sine wave whose crests run square to the wind,
        // one per ripple length, its phase wobbled across the wind and bent
        // by the roll so the crests curve. sin() of the phase times 2 pi
        // runs one full wave per ripple length; * 0.5 + 0.5 moves it to
        // 0..1, so a ripple only ever adds height.
        const ripplePoint = worldPoint.div(rippleLength);
        const ripplePhase = alongWind(ripplePoint)
          .add(
            sin(acrossWind(ripplePoint).mul((Math.PI * 2) / RIPPLE_WOBBLE_LENGTH)).mul(
              RIPPLE_WOBBLE,
            ),
          )
          .add(roll.mul(RIPPLE_ROLL_BEND));
        const wave = sin(ripplePhase.mul(Math.PI * 2))
          .mul(0.5)
          .add(0.5);

        // Fade the ripples out with distance from the camera, measured in
        // ripple lengths. The camera stands over (0, 0) of the ground point,
        // not of the glided one, so the distance comes from groundPoint.
        // smoothstep() runs 0..1 from the fade's start to its end, and
        // oneMinus() flips it, so the ripples hold full strength up close
        // and reach 0 at the end. They also scale by `risen`, the intro's rise
        // above, so they come in with the swells rather than striping the
        // flat ground ahead of them.
        const fade = smoothstep(
          RIPPLE_FADE_START,
          RIPPLE_FADE_END,
          distance.div(rippleLength),
        ).oneMinus();

        return swells.add(wave.mul(rippleAmplitude).mul(fade).mul(risen));
      };

      // ---------------------------------------------
      // Find where the ray meets the surface
      // ---------------------------------------------
      const march = marchHeightMap(ray, heightAt, {
        steps: STEP_COUNT,
        maxDistance: MAX_DISTANCE,
        stepScale: STEP_SCALE,
        normalOffset: NORMAL_OFFSET,
      });

      // ---------------------------------------------
      // Shade it by the light
      // ---------------------------------------------
      // The light's direction, a unit vector from the ground toward it. Its
      // height above the horizon splits it into an upward part, sin(height),
      // and a level part, cos(height); the compass angle then points the
      // level part, sine to the right (+x) and cosine ahead (+z), the way
      // the wind's direction works above.
      const lightAngleRadians = lightAngleUniform.mul(DEGREES_TO_RADIANS);
      const lightHeightRadians = lightHeightUniform.mul(DEGREES_TO_RADIANS);
      const level = cos(lightHeightRadians);
      const lightDirection = vec3(
        sin(lightAngleRadians).mul(level),
        sin(lightHeightRadians),
        cos(lightAngleRadians).mul(level),
      );

      // How squarely the surface faces the light. The normal points straight
      // out of the surface, and its dot product with the light's direction is
      // the cosine of the angle between them: 1 where the surface faces the
      // light head on, 0 where the light runs along it, negative where it faces
      // away. max() clamps the far side to 0 (sunFacing below), so with
      // `skylight` at 0 a face turned from the light takes the shadow color
      // alone. mixColor blends the two colors in
      // `colorSpace`, so the slopes between them pass through that space's
      // midpoints: oklab's keep an even lightness step, where linear RGB's
      // turn muddy between a warm and a cool color.
      //
      // A low light is what makes swells read. Level ground faces a light 15
      // degrees up at only sin(15) = 0.26, a slope that tips toward it
      // climbs fast toward 1, and one that tips away drops to 0. So small
      // slopes swing far between the two colors, and every crest splits
      // into a lit face and a shaded one (raking light). A light overhead
      // lights level ground at 1 and a 20 degree slope at cos(20) = 0.94, so
      // the same swells flatten into one tone.
      const lightFacing = dot(march.normal, lightDirection).toVar();

      // ---------------------------------------------
      // Shadows that crests cast
      // ---------------------------------------------
      // lightFacing only knows which way this one point faces. It can't
      // tell that a crest between the point and the light blocks the light,
      // so a trough behind a tall crest is lit as if nothing stood in the
      // way. A cast shadow needs a second ray (a shadow ray): start at the
      // point the camera's ray hit, walk toward the light, and check whether
      // the surface ever rises above the ray.
      //
      // The walk is short. Nothing stands taller than limitedRelief, so
      // once the ray has climbed that high, nothing can block it. The ray
      // climbs toLight.y per unit travelled, so it needs
      // (top - start height) / toLight.y units to get there: a point just
      // under a crest's top walks a few hundredths of a unit, and a point
      // deep in a trough walks furthest. max() keeps a light on the horizon,
      // where toLight.y is 0, from dividing by 0, and SHADOW_REACH caps the
      // walk for a low light. The floor stays tiny: a floor of 0.02 would
      // stop the walk short for a light under about 1.15 degrees, before
      // it climbs clear of the crests SHADOW_REACH still covers.
      //
      // The steps bunch up near the start: each sits at reach * share^2,
      // where share runs 1/12, 2/12, ... 1. The first lands 1/144 of the way
      // along and the last gap covers 16% of the reach. Near crests give a
      // shadow its crisp edge where it starts, so they get the fine steps.
      //
      // At each step, clearance is how far the ray sits above the surface.
      // Below 0, the surface blocks the ray: full shadow. Just above 0, the
      // ray grazes a crest, and the point sits at the shadow's edge. A real
      // sun is a disc, not a point, so at the edge part of the disc still
      // shows over the crest, and the shadow fades in over a band (the
      // penumbra). clearance / along is the slope from the start point up to
      // the ray's gap over the surface, which is how much of that disc
      // clears the crest. Dividing by the edge width turns it into 0..1,
      // and min() keeps the worst step, the crest that blocks the most.
      //
      // sunlit starts at 1, fully lit. The loop is a real GPU loop with
      // .assign(), because a running minimum written as a chain of select()
      // hangs the compiler (the running-minimum gotcha in docs/agents/tsl.md).
      // If() skips the whole walk where shadows are off or the face is
      // turned from the light, which is shaded already, so `shadows` at 0
      // costs nothing.
      const shadowStrength = clamp(shadowsUniform, 0, 1).toVar();
      const sunlit = float(1).toVar();

      If(shadowStrength.greaterThan(0), () => {
        If(lightFacing.greaterThan(0), () => {
          const start = vec3(march.position).toVar();
          const toLight = vec3(lightDirection).toVar();
          const reach = clamp(
            limitedRelief.sub(start.y).div(max(toLight.y, 1e-4)),
            0,
            SHADOW_REACH,
          ).toVar();

          Loop(SHADOW_STEPS, ({ i }: { i: TSLValue }) => {
            const share = float(i).add(1).div(SHADOW_STEPS);
            const along = reach.mul(share).mul(share).toVar();
            const point = start.add(toLight.mul(along)).toVar();
            const clearance = point.y.sub(heightAt(vec2(point.x, point.z), false));

            sunlit.assign(min(sunlit, clearance.div(max(along, 1e-4).mul(SHADOW_EDGE))));

            If(sunlit.lessThan(0), () => {
              Break();
            });
          });
        });
      });

      // smoothstep() eases the edge in and out, and clamps sunlit to 0..1.
      // mix() then scales the shadow by its strength: at 0 every point keeps
      // all its light, and at 1 a blocked point keeps none.
      const sunShare = mix(1, smoothstep(0, 1, sunlit), shadowStrength).toVar();
      const sunFacing = max(lightFacing, 0).mul(sunShare);

      // ---------------------------------------------
      // Light from the sky
      // ---------------------------------------------
      // The sun isn't the only light outdoors. The whole sky glows, and that
      // glow reaches ground the sun can't (ambient light). Without it, every
      // face turned from the sun and every shadowed trough is one flat
      // `shadowColor`, and the ripples there vanish, because nothing lights
      // one side of a ripple more than the other.
      //
      // At dusk the sky is brightest on the sun's side, so the sky's light
      // leans the sun's way but wraps around the surface. lightFacing runs 1
      // facing the sun, 0 edge-on, -1 facing away; * 0.5 + 0.5 moves that to
      // 1..0, so a face edge-on to the sun still gets half and only a face
      // turned straight away gets none (a wrap light). The ripples tilt the
      // normal from one side to the other, so the wrap shades them even in
      // shadow.
      //
      // The two lights then combine as sun + sky * (1 - sun): the sky fills
      // only the share the sun left dark, so a face in full sun stays at 1
      // and never brightens past `color`.
      const skyFacing = lightFacing
        .mul(0.5)
        .add(0.5)
        .mul(clamp(skylightUniform, 0, 1))
        .mul(SKYLIGHT_SHARE);
      const facing = sunFacing.add(skyFacing.mul(sunFacing.oneMinus()));
      const diffuse = mixColor(
        shadowColorUniform,
        colorUniform,
        facing,
        colorSpace,
        hueInterpolation,
      );

      // ---------------------------------------------
      // Add the sheen where the surface mirrors the light
      // ---------------------------------------------
      // The light above is diffuse: a face looks the same from any angle,
      // because it scatters light every way, as chalk or dry sand does.
      // A smooth surface also mirrors some of it, and that reflection is
      // bright only where it bounces toward the camera, so it moves when the
      // camera does. That mirrored light is specular light, and the sheen is
      // a soft version of it.
      //
      // A face mirrors the light into the camera when its normal points
      // exactly halfway between the way to the light and the way back to the
      // camera. The way back to the camera is the ray's direction flipped.
      // Adding the two unit vectors and normalizing the sum gives that
      // halfway direction, so dot(normal, halfway) is 1 on a face that
      // mirrors the light straight at the camera and falls as the face turns
      // off it (the Blinn-Phong model).
      //
      // pow() of that cosine shapes the highlight. A dot product just under
      // 1, 0.95, stays 0.54 at the power 12 and drops to 0.01 at the power
      // 100, so a low power (SHEEN_FOCUS above) spreads the glow over every
      // face near the reflection, and a high one keeps only the faces that
      // mirror the light almost exactly. max() keeps pow() off negative
      // numbers, which have no real power.
      //
      // A face turned from the light can still have its normal near the
      // halfway direction when the light sits low behind the swells, and would
      // glow from light that never reaches it. smoothstep() fades the sheen
      // in as the face turns toward the light, over its first 0.15 of
      // lightFacing, about 9 degrees, so the cut isn't a hard line.
      const toCamera = vec3(ray.direction).negate();
      const halfway = lightDirection.add(toCamera).normalize();
      const mirror = max(dot(march.normal, halfway), 0);
      const lit = smoothstep(0, 0.15, lightFacing);

      // ---------------------------------------------
      // Glints off grains of sand
      // ---------------------------------------------
      // Sand is a heap of tiny crystals, each a mirror facing its own way.
      // The sheen above treats the surface as one smooth sheet. A glint is
      // one grain that happens to face just right to mirror the light
      // straight at the camera, and it flashes and dies as the camera moves.
      //
      // The ground is cut into a grid of cells, `glintSize` on a side, one
      // grain each. The hit point's x and z, plus the glide and the sway
      // that heightAt adds, give its place on the ground itself, so a grain
      // stays put on the surface as the camera passes over. floor() names
      // the cell, and fract() - 0.5 is the place within it, measured from
      // its center.
      //
      // Each cell hashes to two random numbers (stableHash, one whole number
      // in, 0..1 out), and they aim the grain's face anywhere in the upper
      // half of a sphere: the first is its compass turn, times 2 pi, and the
      // second is its upward part, the cosine of its lean from straight up.
      // Picking that cosine evenly spreads the faces evenly over the half
      // sphere. The face ignores the slope under it, because a crystal in a
      // heap faces any way at all. A low sun to one side puts the halfway
      // direction about 70 degrees from straight up, so a grain that only
      // leaned a little off the surface would never reach it.
      //
      // The flash is the sheen's test with a far higher power: the cosine
      // between the grain's normal and the halfway direction, to a power
      // of GLINT_FOCUS (above). At about 150 the result is over 0.5 only
      // within about 5.5 degrees, so about one grain in 200 lines up, and
      // the rest stay dark. As the camera glides, the
      // halfway direction at each grain turns, so grains pass through that
      // narrow window one after another: the twinkle.
      //
      // smoothstep() on the distance from the cell's center draws each
      // glint as a soft dot instead of a square. Its edges run low to high
      // and oneMinus() turns it bright at the center, because GLSL leaves
      // smoothstep() undefined for falling edges, and the WebGL2 fallback
      // compiles to GLSL. The glints fade out with
      // distance, counted in cells so a bigger grain shows from further
      // away, where a cell shrinks under a pixel, and they show only in
      // direct sun: `lit` cuts faces turned from the light, and sunShare
      // cuts cast shadows.
      const grainSize = clamp(glintSizeUniform, GLINT_SIZE_MIN, GLINT_SIZE_MAX).toVar();
      const grainPoint = vec2(march.position.x, march.position.z)
        .add(vec2(swayRight, travelUniform))
        .div(grainSize);
      const grainCell = floor(grainPoint);
      const grainSeed = wrapInto(grainCell.x, GLINT_STRIDE)
        .add(wrapInto(grainCell.y, GLINT_STRIDE).mul(GLINT_STRIDE))
        .toVar();
      const grainTurn = stableHash(grainSeed).mul(Math.PI * 2);
      const grainUp = stableHash(grainSeed.add(GLINT_STRIDE * GLINT_STRIDE));
      const grainLevel = sqrt(grainUp.mul(grainUp).oneMinus());
      const grainNormal = vec3(
        cos(grainTurn).mul(grainLevel),
        grainUp,
        sin(grainTurn).mul(grainLevel),
      );
      const grainDisc = smoothstep(0.15, 0.5, length(fract(grainPoint).sub(0.5))).oneMinus();
      const grainFade = smoothstep(
        GLINT_FADE_START,
        GLINT_FADE_END,
        march.distance.div(grainSize),
      ).oneMinus();
      const glint = max(dot(grainNormal, halfway), 0)
        .pow(GLINT_FOCUS)
        .mul(grainDisc)
        .mul(grainFade)
        .mul(lit)
        .mul(sunShare)
        .mul(clamp(glintsUniform, 0, 1));

      const sheenHighlight = mirror
        .pow(SHEEN_FOCUS)
        .mul(lit)
        // No light reaches a shadowed point, so it
        // mirrors none.
        .mul(sunShare)
        .mul(clamp(sheenUniform, 0, 1));

      // A glint shows through wherever it is brighter
      // than the sheen under it.
      const highlight = max(sheenHighlight, glint);

      // Blend toward sheenColor by the highlight's strength, in the same
      // space the slopes blend in, so the brightest point of a full sheen
      // is exactly sheenColor and no channel ever clips past it.
      const sheened = mixColor(diffuse, sheenColorUniform, highlight, colorSpace, hueInterpolation);

      // ---------------------------------------------
      // A glow on surfaces seen edge-on
      // ---------------------------------------------
      // A surface mirrors more of its surroundings the more edge-on you see
      // it (the Fresnel effect): look straight down at water and you see
      // into it, look across it and you see the sky. So faces that lean away
      // from the camera, the rims of crests and the far ground, take on the
      // color of the sky they mirror. That color is `sheenColor`, the light
      // the surface mirrors everywhere else, and not `hazeColor`: the haze
      // is often darker than the sand, as dusk air is, and blending a sunlit
      // crest toward a darker color dims it where a glow should brighten it.
      //
      // dot(normal, toCamera) is the cosine between the surface and the
      // view: 1 seen head on, 0 seen edge-on. oneMinus() flips it, and pow()
      // gathers the glow toward the edge (RIM_FOCUS above): halfway, at 0.5,
      // the power 4 leaves 0.06, so only faces close to edge-on glow. max()
      // keeps pow() off a negative number on a face that leans past edge-on,
      // which the normal's finite gap can report at a crest.
      const edgeOn = max(dot(march.normal, toCamera), 0)
        .oneMinus()
        .pow(RIM_FOCUS)
        .mul(clamp(rimGlowUniform, 0, 1));
      const surface = mixColor(sheened, sheenColorUniform, edgeOn, colorSpace, hueInterpolation);

      // ---------------------------------------------
      // Leave the sky transparent
      // ---------------------------------------------
      // hit is 1 on the ground and 0 where the ray missed, so it serves as
      // the alpha: the ground covers what is beneath it, and the sky lets
      // it through.
      //
      // The march also gives up when it runs out of steps, and it reports
      // that as a miss. A ray that skims a crest creeps past it in tiny
      // steps, because each step is a share of its height above the ground,
      // and spends its steps there. Near the horizon, where every ray skims
      // crest after crest, that left slivers of sky between the far crests.
      // But no swell dips below height 0, so every ray heading down meets
      // the ground somewhere, and counts as ground wherever its steps ran
      // out. That end point sits just past the last crest it skimmed, so
      // it takes the light of the ground under it. A ray heading down that
      // runs past the camera's reach counts as ground too, and the reach
      // fade below hides it. Only a ray heading level or up, into the sky,
      // can miss, and it does unless it met a crest taller than the camera.
      // step(1e-4, descent) is 1 for a ray heading down, with an epsilon
      // so a level ray doesn't count.
      const descent = vec3(ray.direction).y.negate();
      const coverage = max(march.hit, step(1e-4, descent));

      // ---------------------------------------------
      // Fade the far surface into the haze
      // ---------------------------------------------
      // Air between the camera and the ground scatters some of the light on
      // its way and adds its own glow, so far ground takes on the air's
      // color and then disappears into it (aerial perspective). Swells does
      // both in turn. The far surface first blends toward `hazeColor`, then
      // fades to transparent further out, so the far field glows in the
      // haze's color before it dissolves into whatever is beneath: the
      // page's background, or a sky Source mounted under Swells.
      //
      // Both follow the curve exp(-(haze * d)^2), the squared form three's
      // FogExp2 uses, for how much of the surface gets through d units of
      // haze. Plain exp(-haze * d), the law for even haze, falls fastest at
      // the start, so it would tint the ground at the camera's feet too.
      // Squaring the product keeps the near ground clear and falls fast
      // further out. At 1 / haze units, 37% of the surface's own color gets
      // through, and at haze 0 all of it does.
      //
      // The color takes 1 minus that curve as its blend toward hazeColor,
      // in `colorSpace`. The alpha takes the same curve with the distance
      // divided by the fade lag (HAZE_FADE_LAG above), which stretches it
      // out. For example, at haze 0.04 and a lag of 2, the ground has turned
      // 47% to the haze's color at 20 units and 92% at 40, while its alpha
      // is still 85% at 20 and 53% at 40, where the reach fade below takes
      // it the rest of the way.
      //
      // march.distance is where the ray stopped. For a ray that ran out of
      // steps, that is short of where it meets the ground, so its haze is a
      // little light, but close to its neighbors' that met the crests
      // around it, so no sliver shows.
      //
      // During the intro the haze starts thick and clears. It thins from
      // INTRO_HAZE to `haze` over the first INTRO_HAZE_SHARE of the intro,
      // so the far ground shows while the rise front is still out there.
      // The clearing eases out on the front's curve, 1 - (1 - t)^3: quick at
      // first, then settling onto `haze`, so the air opens up as the intro
      // starts and the two read as one motion. max() keeps a `haze` thicker
      // than INTRO_HAZE at its own value throughout.
      // At the end t is 1 and mix() returns `haze`.
      const settledHaze = max(hazeUniform, 0);
      const hazeLeft = clamp(introProgress.div(INTRO_HAZE_SHARE), 0, 1).oneMinus();
      const clearedShare = hazeLeft.mul(hazeLeft).mul(hazeLeft).oneMinus();
      const hazeNow = mix(max(settledHaze, INTRO_HAZE), settledHaze, clearedShare);
      const hazeDepth = hazeNow.mul(march.distance).toVar();
      const hazeBlend = hazeDepth.mul(hazeDepth).negate().exp().oneMinus();
      const hazed = mixColor(surface, hazeColorUniform, hazeBlend, colorSpace, hueInterpolation);
      const fadeDepth = hazeDepth.div(HAZE_FADE_LAG);
      const clearAir = fadeDepth.mul(fadeDepth).negate().exp();

      // The camera's reach ends the surface wherever haze hasn't. Every
      // ray heading down counts as ground (above), so without this the
      // ground would run solid to the horizon line, lit by wherever each
      // ray stopped, which past the reach is nowhere near the ground.
      // Fading the last share of the reach (REACH_FADE above) to
      // transparent ends the surface softly instead. smoothstep() runs 0..1
      // from where the fade starts to the reach, and oneMinus() flips it,
      // so the surface holds full strength before the fade and reaches 0
      // at the reach. A ray that ran past the reach stopped just beyond
      // it, so it draws nothing.
      const withinReach = smoothstep(
        MAX_DISTANCE * (1 - REACH_FADE),
        MAX_DISTANCE,
        march.distance,
      ).oneMinus();

      return vec4(hazed, coverage.mul(clearAir).mul(withinReach));
    })();

    // An unlit material whose per-pixel color comes from colorNode.
    // transparent lets the alpha above show the Source beneath.
    const material = new MeshBasicNodeMaterial();

    material.transparent = true;
    material.colorNode = swellsNode;
    mesh.material = material;

    // A still scene is parked, so ask it to draw the new material.
    shaderContext.scheduler.requestRender();

    return () => {
      fieldPass?.dispose();
      try {
        material.dispose();
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
    };
  }, [
    shaderContext,
    altitudeUniform,
    tiltUniform,
    fieldOfViewUniform,
    scaleUniform,
    reliefUniform,
    sharpnessUniform,
    ripplesUniform,
    lightAngleUniform,
    lightHeightUniform,
    colorUniform,
    shadowColorUniform,
    sheenUniform,
    sheenColorUniform,
    hazeUniform,
    colorSpace,
    hueInterpolation,
    angleUniform,
    hazeColorUniform,
    travelUniform,
    swellClock,
    parallaxUniform,
    parallaxCenterUniform,
    introUniform,
    aspectNode,
    shadowsUniform,
    skylightUniform,
    rimGlowUniform,
    glintsUniform,
    glintSizeUniform,
  ]);

  return null;
}
