'use client';

// Swells' GPU half. Unlike the flat Sources, this one draws a 3D world. The
// pixel's journey: cast a ray from a perspective camera through the pixel
// (cameraRay), follow it until it meets the surface (marchHeightMap), light
// the surface it hits from a sun and add a sheen, blend it into the haze and
// fade it out with distance, shimmer it near the horizon, and leave the
// pixel transparent where the ray misses, so the page, or a Source mounted
// beneath, shows through as the sky. The camera glides over the surface and
// can sway sideways toward a point, and the swells rise and fall in place.
// The wrapper (./swells.tsx) supplies the props.
import { useEffect, useRef } from 'react';

import {
  atan,
  clamp,
  cos,
  dot,
  float,
  floor,
  Fn,
  fract,
  length,
  max,
  min,
  mix,
  type ShaderNodeObject,
  sin,
  smoothstep,
  sqrt,
  step,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

import {
  cameraRay,
  type ColorSpace,
  getReducedMotionTimeScale,
  type HueInterpolation,
  marchHeightMap,
  mixColor,
  stableHash,
} from '../../engine.js';
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

// ---------------------------------------------
// Feel constants (provisional until the defaults gate)
// ---------------------------------------------
// The tuning prop overrides the ones SwellsTuning lists, on the docs page,
// and the defaults gate bakes the landed values back in here.

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

// Which way the wind blows, in compass degrees clockwise from the way the
// camera faces, the convention sunAngle uses: 0 blows straight away from
// the camera, 90 to its right. The crests run square to the wind, and at
// full `sharpness` each swell's steep face looks downwind, as a dune's does.
const WIND_ANGLE = 30;

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
// gives broader, softer crests. The shader holds it to 1 or under, since
// past that the band would reach the trough and lift it.
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
// ripples are a few centimetres on dunes metres tall, so a little goes a long way:
// the light picks them out from their slope, not their height.
const RIPPLE_HEIGHT = 0.008;

// How many steps each pixel's ray takes. It is baked into the shader as the
// loop's bound, because WebGL2 accepts only a fixed one, so it is not on the
// tuning rig. More steps reach further toward the horizon and cost GPU time
// on every pixel.
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

// How tightly the sheen gathers around the sun's reflection: the exponent
// the highlight's falloff is raised to (the Light it from the sun section
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

// Where the mirage starts, in terrain units from the camera: the shimmer
// fades in from here to twice as far, and holds full strength beyond,
// over the far ground and the horizon. Lower brings it closer.
const MIRAGE_START = 12;

// How far the mirage moves a pixel at `mirage={1}`, at the most, as a share
// of the canvas's height: 0.003 is 3 pixels on a canvas 1000 pixels tall.
// Higher wavers more. Past about 0.0044 the shimmer's waves fold the
// image over itself (the Shimmer near the horizon section says why).
const MIRAGE_SWAY = 0.003;

// How much of the surface the mirage clears at its strongest, where the
// sky shows through, 0 to 1, at `mirage={1}`.
const MIRAGE_CLEARING = 0.6;

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

// The smallest ripple size the shader works with, in terrain units. It
// divides the ground's coordinates, so 0 would blow up.
const MIN_RIPPLE_SIZE = 0.05;

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

// The closest the pivot may sit, in terrain units. The turn is the angle to
// the pivot, so a pivot at 0 would swing the camera a quarter turn.
const MIN_PARALLAX_PIVOT = 0.5;

const DEGREES_TO_RADIANS = Math.PI / 180;

/** TEMPORARY (build-phase tuning only): dev overrides for the feel constants. */
export interface SwellsTuning {
  /** The share of the ray's height above the ground each march step moves, 0 to 1. */
  stepScale?: number;
  /** How far the camera sees, in terrain units. */
  maxDistance?: number;
  /** The steepest a swell's face may get, as height gained per unit of ground. */
  maxSlope?: number;
  /** Which way the wind blows, in compass degrees from the camera's heading. */
  windAngle?: number;
  /** The share of each swell's length its steep downwind face takes at full sharpness, 0 to 1. */
  slipFace?: number;
  /** How wide a band the crest rounds over at sharpness 0, 0 to 1. */
  crestRounding?: number;
  /** How far the crests wander from straight lines, in swell lengths. */
  meander?: number;
  /** The distance from one ripple's crest to the next, in terrain units. */
  rippleSize?: number;
  /** How tall the ripples are at full strength, in terrain units. */
  rippleHeight?: number;
  /** How tightly the sheen gathers around the sun's reflection, as an exponent. */
  sheenFocus?: number;
  /** The share of the camera's reach, at its far end, the surface fades out over, 0 to 1. */
  reachFade?: number;
  /** Where the mirage starts, in terrain units from the camera. */
  mirageStart?: number;
  /** How far the mirage moves a pixel at full strength, as a share of the canvas's height. */
  mirageSway?: number;
  /** How much of the surface the mirage clears at its strongest, 0 to 1. */
  mirageClearing?: number;
  /** How many times further out the surface fades than it turns to the haze color. */
  hazeFadeLag?: number;
  /** How far ahead the point the camera keeps facing while it sways sits, in terrain units. */
  parallaxPivot?: number;
}

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

/**
 * TEMPORARY (build-phase tuning only): a uniform for each feel constant,
 * holding the tuning prop's override or the constant itself. They ride
 * uniforms so the tuning sliders glide without rebuilding the shader. The
 * defaults gate deletes this hook and bakes the constants back in.
 */
function useTuningUniforms(tuning: SwellsTuning | undefined) {
  const {
    stepScale = STEP_SCALE,
    maxDistance = MAX_DISTANCE,
    maxSlope = MAX_SLOPE,
    windAngle = WIND_ANGLE,
    slipFace = SLIP_FACE,
    crestRounding = CREST_ROUNDING,
    meander = MEANDER,
    rippleSize = RIPPLE_SIZE,
    rippleHeight = RIPPLE_HEIGHT,
    sheenFocus = SHEEN_FOCUS,
    reachFade = REACH_FADE,
    mirageStart = MIRAGE_START,
    mirageSway = MIRAGE_SWAY,
    mirageClearing = MIRAGE_CLEARING,
    hazeFadeLag = HAZE_FADE_LAG,
    parallaxPivot = PARALLAX_PIVOT,
  } = tuning ?? {};

  return {
    stepScaleUniform: useAnimatableUniform<number>(stepScale),
    maxDistanceUniform: useAnimatableUniform<number>(maxDistance),
    maxSlopeUniform: useAnimatableUniform<number>(maxSlope),
    windAngleUniform: useAnimatableUniform<number>(windAngle),
    slipFaceUniform: useAnimatableUniform<number>(slipFace),
    crestRoundingUniform: useAnimatableUniform<number>(crestRounding),
    meanderUniform: useAnimatableUniform<number>(meander),
    rippleSizeUniform: useAnimatableUniform<number>(rippleSize),
    rippleHeightUniform: useAnimatableUniform<number>(rippleHeight),
    sheenFocusUniform: useAnimatableUniform<number>(sheenFocus),
    reachFadeUniform: useAnimatableUniform<number>(reachFade),
    mirageStartUniform: useAnimatableUniform<number>(mirageStart),
    mirageSwayUniform: useAnimatableUniform<number>(mirageSway),
    mirageClearingUniform: useAnimatableUniform<number>(mirageClearing),
    hazeFadeLagUniform: useAnimatableUniform<number>(hazeFadeLag),
    parallaxPivotUniform: useAnimatableUniform<number>(parallaxPivot),
  };
}

/**
 * The uniforms for the light and air over the surface: the sheen, the
 * haze, and the mirage, with the mirage's clock.
 */
function useAirUniforms({
  sheen,
  sheenColor,
  haze,
  hazeColor,
  mirage,
}: Pick<SwellsShaderProps, 'sheen' | 'sheenColor' | 'haze' | 'hazeColor' | 'mirage'>) {
  return {
    sheenUniform: useAnimatableUniform<number>(sheen),
    sheenColorUniform: useColorUniform(sheenColor),
    hazeUniform: useAnimatableUniform<number>(haze),
    hazeColorUniform: useColorUniform(hazeColor),
    mirageUniform: useAnimatableUniform<number>(mirage),
    // The mirage's clock: seconds summed on the CPU each frame, times the
    // reduced-motion time scale, so the shimmer slows under reduced motion
    // and holds still under the `paused` policy posters and visual tests
    // use.
    shimmerClock: useAnimatableSpeed(1),
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
}: Pick<SwellsShaderProps, 'speed' | 'swellSpeed' | 'parallax' | 'parallaxCenter'>) {
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
    // resolves to the scene's shared pointer.
    parallaxCenterUniform: useAnimatablePoint(parallaxCenter, { screenOrigin: true }),
  };
}

/**
 * Swells' render-on-demand vote: true when nothing it draws changes between
 * frames, so the scene may stop drawing. Three dials move the picture on
 * their own: the glide, the swells' rise and fall, and the mirage's
 * shimmer. A signal is live whatever it reads now, because it can change
 * between renders.
 *
 * The sway doesn't count, even toward the cursor. A cursor moves only when
 * the pointer does, and useCursor wakes the scene on every move and keeps
 * it drawing until its smoothing settles, so a still pointer can let the
 * scene park, as LedWall's swell center does (SHA-139).
 */
function isSwellsStill({
  speed,
  swellSpeed,
  mirage,
}: Pick<SwellsShaderProps, 'speed' | 'swellSpeed' | 'mirage'>): boolean {
  if (isSignal(speed) || isSignal(swellSpeed) || isSignal(mirage)) return false;

  return speed === 0 && swellSpeed === 0 && mirage <= 0;
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
   * How strong the fine ripples are, from 0 to 1, where 0 is a smooth
   * surface. Accepts a static value or an animation signal.
   */
  ripples: AnimatableProp<number>;
  /**
   * Where the sun sits around the scene, in compass degrees clockwise from
   * the way the camera faces at rest. The sun stays put while a parallax
   * sway turns the camera. Accepts a static value or an animation signal.
   */
  sunAngle: AnimatableProp<number>;
  /**
   * How high the sun sits, in degrees above the horizon. Accepts a static
   * value or an animation signal.
   */
  sunHeight: AnimatableProp<number>;
  /** The surface's color in full sun: hex, `oklch()`, or `oklab()`. */
  color: string;
  /** The surface's color on faces turned from the sun: hex, `oklch()`, or `oklab()`. */
  shadowColor: string;
  /**
   * How strong the soft highlight is where the surface mirrors the sun, from
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
   * How strongly the far surface shimmers, from 0 (still air) to 1, like
   * heat haze over sand. Accepts a static value or an animation signal.
   */
  mirage: AnimatableProp<number>;
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
   * TEMPORARY (build-phase tuning only): dev overrides for the feel
   * constants.
   */
  tuning: SwellsTuning | undefined;
}

export function SwellsShader({
  altitude,
  tilt,
  fieldOfView,
  scale,
  relief,
  sharpness,
  ripples,
  sunAngle,
  sunHeight,
  color,
  shadowColor,
  sheen,
  sheenColor,
  haze,
  hazeColor,
  mirage,
  colorSpace,
  hueInterpolation,
  speed,
  swellSpeed,
  parallax,
  parallaxCenter,
  tuning,
}: SwellsShaderProps) {
  const shaderContext = useShaderContext();

  // Every dial lives in a uniform, a value the CPU can change each frame
  // without rebuilding the shader, tracking a static number or a signal.
  const altitudeUniform = useAnimatableUniform<number>(altitude);
  const tiltUniform = useAnimatableUniform<number>(tilt);
  const fieldOfViewUniform = useAnimatableUniform<number>(fieldOfView);
  const scaleUniform = useAnimatableUniform<number>(scale);
  const reliefUniform = useAnimatableUniform<number>(relief);
  const sharpnessUniform = useAnimatableUniform<number>(sharpness);
  const ripplesUniform = useAnimatableUniform<number>(ripples);
  const sunAngleUniform = useAnimatableUniform<number>(sunAngle);
  const sunHeightUniform = useAnimatableUniform<number>(sunHeight);
  const colorUniform = useColorUniform(color);
  const shadowColorUniform = useColorUniform(shadowColor);
  const {
    sheenUniform,
    sheenColorUniform,
    hazeUniform,
    hazeColorUniform,
    mirageUniform,
    shimmerClock,
  } = useAirUniforms({ sheen, sheenColor, haze, hazeColor, mirage });
  const { travelUniform, swellClock, parallaxUniform, parallaxCenterUniform } = useMotionUniforms({
    speed,
    swellSpeed,
    parallax,
    parallaxCenter,
  });

  useStaticSceneHint(isSwellsStill({ speed, swellSpeed, mirage }));

  // TEMPORARY: the tuning rig's uniforms (useTuningUniforms above).
  const {
    stepScaleUniform,
    maxDistanceUniform,
    maxSlopeUniform,
    windAngleUniform,
    slipFaceUniform,
    crestRoundingUniform,
    meanderUniform,
    rippleSizeUniform,
    rippleHeightUniform,
    sheenFocusUniform,
    reachFadeUniform,
    mirageStartUniform,
    mirageSwayUniform,
    mirageClearingUniform,
    hazeFadeLagUniform,
    parallaxPivotUniform,
  } = useTuningUniforms(tuning);

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
      // left. cameraRay takes it in degrees, and max() holds the pivot at
      // MIN_PARALLAX_PIVOT or further. The pivot is always
      // ahead, so the one-argument atan() covers every angle, and it avoids
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
      // move the view under a moving pointer. The parallax center uniform
      // goes in as an argument to add(), never as the receiver of a chained
      // call (the vec-uniform gotcha in docs/agents/tsl.md).
      const fullMotion = step(FULL_MOTION, getReducedMotionTimeScale());
      const towardCenter = clamp(vec2(-0.5, -0.5).add(parallaxCenterUniform).mul(2), -1, 1);
      const swayRight = towardCenter.x.mul(parallaxUniform).mul(fullMotion).toVar();
      const orbitTurn = atan(swayRight.negate().div(max(parallaxPivotUniform, MIN_PARALLAX_PIVOT)))
        .div(DEGREES_TO_RADIANS)
        .toVar();
      const camera = {
        aspect: aspectNode,
        altitude: altitudeUniform,
        tilt: tiltUniform,
        fieldOfView: fieldOfViewUniform,
        turn: { right: orbitTurn },
      };
      const straightRay = cameraRay(uv(), camera);

      // ---------------------------------------------
      // Shimmer near the horizon
      // ---------------------------------------------
      // Over hot ground, the air just above it is hotter and thinner than
      // the air higher up, and light bends as it passes between them. Far
      // off, where a ray skims the ground for a long way, the bend is enough
      // to show the sky where the ground should be, and the moving air
      // makes it waver (a mirage). Swells fakes the bend in screen space:
      // it nudges the pixel's place up or down a little before casting its
      // ray, so the pixel shows the ground from just above or below it.
      //
      // Where the mirage applies: how far off the pixel's ground lies. The
      // straight ray falls its altitude by the time it reaches height 0,
      // at altitude / descent units, which is close to where it meets the
      // swells, and is known before the march. A ray heading level or up
      // has no ground, and max() turns its descent into a sliver, so its
      // distance is huge and it counts as far: the shimmer reaches up over
      // the horizon line, where the far crests waver into the sky. The band
      // fades in from mirageStart to twice that. smoothstep() has no defined
      // result when its two edges meet, as they would at a start of 0, so
      // max() keeps the start a sliver above 0, which still puts the mirage
      // over all the ground.
      const straightDescent = max(vec3(straightRay.direction).y.negate(), 1e-4);
      const groundDistance = vec3(straightRay.origin).y.div(straightDescent);
      const mirageFrom = max(mirageStartUniform, 1e-3);
      const mirageAmount = smoothstep(mirageFrom, mirageFrom.mul(2), groundDistance)
        .mul(clamp(mirageUniform, 0, 1))
        .toVar();

      // The shimmer itself: two sine waves that run mostly up the canvas,
      // tilted a little across it in opposite directions, and drift at
      // different rates, so their sum never repeats a simple pattern and
      // reads as turbulent air. The canvas's x is multiplied by its aspect,
      // so both axes count in canvas heights and the waves keep their shape
      // on a wide canvas. Halving the sum keeps it -1..1. The numbers
      // multiplying screenY and screenX are each wave's frequency, in
      // radians per canvas height: 260 runs a wave about every 1/41 of the
      // canvas's height, and higher packs the waves tighter. The numbers
      // multiplying shimmerClock are its drift, in radians per second, and
      // higher shimmers faster.
      //
      // A wave of up-down nudges stretches the image where the nudge grows
      // and squeezes it where it shrinks. If the nudge grows faster than
      // the pixels it moves, by more than one canvas height per canvas
      // height, neighboring pixels swap order and the image folds over
      // itself. The waves' slopes are their frequencies times the sway:
      // the sum's steepest is (260 + 190) / 2 = 225 times the sway, so a
      // sway under 1 / 225, about 0.0044, never folds (MIRAGE_SWAY above).
      const screenX = uv().x.mul(aspectNode);
      const screenY = uv().y;
      const shimmer = sin(screenY.mul(260).add(screenX.mul(23)).add(shimmerClock.mul(5)))
        .add(sin(screenY.mul(190).sub(screenX.mul(41)).sub(shimmerClock.mul(3.7))))
        .mul(0.5)
        .toVar();
      const nudge = shimmer.mul(mirageSwayUniform).mul(mirageAmount);
      const ray = cameraRay(vec2(uv().x, uv().y.add(nudge)), camera);

      // ---------------------------------------------
      // Settle the wind and the sizes before the march
      // ---------------------------------------------
      // These depend on the uniforms alone, so every step of every pixel's
      // march would work them out the same. .toVar() pins each in a GPU
      // variable here, before the loop, rather than where the march first
      // reads it, which is inside the loop (the first-use gotcha in
      // docs/agents/tsl.md).
      //
      // The wind's direction on the ground, as a unit vec2 of (x, z): the
      // compass angle's sine is how far it points right (+x), and its
      // cosine how far it points ahead (+z), so 0 points straight ahead.
      const windRadians = windAngleUniform.mul(DEGREES_TO_RADIANS);
      const windX = sin(windRadians).toVar();
      const windZ = cos(windRadians).toVar();
      const swellLength = float(SWELL_SPAN)
        .div(clamp(scaleUniform, MIN_SCALE, MAX_SCALE))
        .toVar();
      const rippleLength = max(rippleSizeUniform, MIN_RIPPLE_SIZE).toVar();
      // How sharp the swells are, kept to 0..1, and where each one's crest
      // falls along it. A round swell is symmetric, so its crest sits
      // halfway; a sharp one is a dune, whose crest sits past its long
      // windward face. mix() slides the crest between the two. The steep
      // face's share is kept clear of 0 and 1, where one of the two faces
      // would have no length and the divides below would blow up.
      const sharpnessAmount = clamp(sharpnessUniform, 0, 1).toVar();
      const slipShare = clamp(slipFaceUniform, 0.05, 0.95);
      const crestShare = mix(0.5, slipShare.oneMinus(), sharpnessAmount).toVar();
      const fallShare = crestShare.oneMinus().toVar();
      // The crest's rounding band (CREST_ROUNDING above), kept to 1 or
      // under so it never reaches the trough. It shrinks with
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
        .mul(clamp(crestRoundingUniform, 0, 1))
        .max(1e-4)
        .toVar();
      const crestRestore = float(1).div(crestRounding.mul(-0.25).add(1)).toVar();
      const rippleAmplitude = ripplesUniform.mul(rippleHeightUniform).toVar();

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
      // `relief` is lower, and max() keeps a negative limit from turning the
      // swells upside down. At the defaults, swells 2.5 units long with a
      // 0.75-unit slip face, the limit is about 1.5, above the default
      // relief of 0.8, so it changes nothing there. The roll's meander packs
      // crests closer in places, which steepens them past this estimate, so
      // MAX_SLOPE sits well under the slope where crests start to slip.
      const steepening = mix(float(1.5), float(2), sharpnessAmount).mul(crestRestore);
      const shortestFace = min(crestShare, fallShare).mul(swellLength);
      const limitedRelief = min(
        reliefUniform,
        max(maxSlopeUniform, 0)
          .mul(1 + ROLL_SHARE)
          .mul(shortestFace)
          .div(steepening),
      ).toVar();

      // How far a ground point lies along the wind, and across it to the
      // wind's right, in the units the point is in. A dot product with the
      // wind's direction measures along it; the direction turned a quarter
      // turn, (windZ, -windX), measures across it.
      const alongWind = (point: TSLValue) => point.x.mul(windX).add(point.y.mul(windZ));
      const acrossWind = (point: TSLValue) => point.x.mul(windZ).sub(point.y.mul(windX));

      // ---------------------------------------------
      // Drift the swells' strength
      // ---------------------------------------------
      // Each swell's strength, how tall it stands against its neighbors,
      // comes from a slow noise field (heightAt below). To make the swells
      // rise and fall in place, the field changes over time while the
      // crests stay where they are. Noise in 2D has no time axis, so the
      // drift fakes one: it reads two unrelated slices of the noise, the
      // current one and the next, and blends from one to the other as the
      // clock runs. swellClock counts slices, so its whole part picks the
      // slices and its fraction is how far the blend has gone.
      //
      // Both slice numbers wrap into 0..STRENGTH_SLICES - 1, the next one
      // too, so the last slice of the cycle blends into the first and the
      // cycle closes with no jump. Each slice number then slides the noise
      // by SLICE_STEP cells that many times, which gives each its own
      // pattern. At swellSpeed 0 the clock stays at 0, so the strength reads
      // slice 0 alone and the swells hold still.
      //
      // smoothstep() eases each blend in and out, so every swell slows to a
      // stop at the end of a slice, then starts toward its next height:
      // a slow breath rather than a steady crawl.
      //
      // A blend of two unrelated noises is flatter than either: halfway,
      // the highs and lows partly cancel, and the spread around the middle
      // falls to sqrt(0.5 ^ 2 + 0.5 ^ 2) = 0.71 of a single slice's. Left
      // alone, every crest would even out once per slice. Dividing the
      // distance from the middle by sqrt(w ^ 2 + (1 - w) ^ 2), where w is
      // the blend, puts the spread back, and it is 1 at either end of a
      // blend, where one slice shows alone.
      //
      // All of this depends on the clock alone, so .toVar() pins it here,
      // before the march's loop (the first-use gotcha).
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
      const offsetNow = sliceOffset(sliceNow);
      const offsetNext = sliceOffset(sliceNext);

      // ---------------------------------------------
      // The surface's height: swells, roll, and ripples
      // ---------------------------------------------
      // The march calls this with a ground point (x, z) on every step and
      // every bisection step, then once more where it stopped, and the
      // normal calls it four more times around the hit. The point is where
      // the ray is relative to the camera, which stands over (0, 0).
      const heightAt = (groundPoint: TSLValue) => {
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

        // The roll: broad noise, 0..1, that lifts and lowers the ground and
        // bends the crests. Each swell's strength is a second noise, slid by
        // an arbitrary offset so it doesn't track the roll, and drifting
        // between two slices as the swells rise and fall ("Drift the swells'
        // strength" above). The blend is pulled back out
        // from the middle by spreadRestore and clamped to 0..1, which the
        // restored spread can pass at a rare extreme.
        const roll = layeredNoise(swellPoint.mul(ROLL_FREQUENCY));
        const strengthPoint = swellPoint.mul(STRENGTH_FREQUENCY);
        const strength = clamp(
          mix(
            valueNoise(strengthPoint.add(offsetNow)),
            valueNoise(strengthPoint.add(offsetNext)),
            sliceBlend,
          )
            .sub(0.5)
            .mul(spreadRestore)
            .add(0.5),
          0,
          1,
        );

        // Where the point falls within its swell, 0..1 from one trough to
        // the next, measured downwind. fract() keeps the fractional part, so
        // the count repeats once per swell length. Adding the roll, centered
        // on 0 and scaled by the meander, slides the crests up and down the
        // wind from place to place, so they bend instead of running straight.
        const withinSwell = fract(alongWind(swellPoint).add(roll.sub(0.5).mul(meanderUniform)));

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
        const swells = profile
          .mul(mix(MIN_STRENGTH, 1, strength))
          .add(roll.mul(ROLL_SHARE))
          .div(1 + ROLL_SHARE)
          .mul(limitedRelief);

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
        // and reach 0 at the end.
        const fade = smoothstep(
          RIPPLE_FADE_START,
          RIPPLE_FADE_END,
          length(groundPoint).div(rippleLength),
        ).oneMinus();

        return swells.add(wave.mul(rippleAmplitude).mul(fade));
      };

      // ---------------------------------------------
      // Find where the ray meets the surface
      // ---------------------------------------------
      const march = marchHeightMap(ray, heightAt, {
        steps: STEP_COUNT,
        maxDistance: maxDistanceUniform,
        stepScale: stepScaleUniform,
        normalOffset: NORMAL_OFFSET,
      });

      // ---------------------------------------------
      // Light it from the sun
      // ---------------------------------------------
      // The sun's direction, a unit vector from the ground toward it. Its
      // height above the horizon splits it into an upward part, sin(height),
      // and a level part, cos(height); the compass angle then points the
      // level part, sine to the right (+x) and cosine ahead (+z), the way
      // the wind's direction works above.
      const sunAngleRadians = sunAngleUniform.mul(DEGREES_TO_RADIANS);
      const sunHeightRadians = sunHeightUniform.mul(DEGREES_TO_RADIANS);
      const level = cos(sunHeightRadians);
      const sunDirection = vec3(
        sin(sunAngleRadians).mul(level),
        sin(sunHeightRadians),
        cos(sunAngleRadians).mul(level),
      );

      // How squarely the surface faces the sun. The normal points straight
      // out of the surface, and its dot product with the sun's direction is
      // the cosine of the angle between them: 1 where the surface faces the
      // sun head on, 0 where the light runs along it, negative where it faces
      // away. max() clamps the far side to 0, so a face turned from the sun
      // takes the shadow color alone. mixColor blends the two colors in
      // `colorSpace`, so the slopes between them pass through that space's
      // midpoints: oklab's keep an even lightness step, where linear RGB's
      // turn muddy between a warm and a cool color.
      //
      // A low sun is what makes swells read. Level ground faces a sun 15
      // degrees up at only sin(15) = 0.26, a slope that tips toward it
      // climbs fast toward 1, and one that tips away drops to 0. So small
      // slopes swing far between the two colors, and every crest splits
      // into a lit face and a shaded one (raking light). A sun overhead
      // lights level ground at 1 and a 20 degree slope at cos(20) = 0.94, so
      // the same swells flatten into one tone.
      const sunFacing = dot(march.normal, sunDirection).toVar();
      const facing = max(sunFacing, 0);
      const diffuse = mixColor(
        shadowColorUniform,
        colorUniform,
        facing,
        colorSpace,
        hueInterpolation,
      );

      // ---------------------------------------------
      // Add the sheen where the surface mirrors the sun
      // ---------------------------------------------
      // The light above is diffuse: a face looks the same from any angle,
      // because it scatters sunlight every way, as chalk or dry sand does.
      // A smooth surface also mirrors some of it, and that reflection is
      // bright only where it bounces toward the camera, so it moves when the
      // camera does. That mirrored light is specular light, and the sheen is
      // a soft version of it.
      //
      // A face mirrors the sun into the camera when its normal points
      // exactly halfway between the way to the sun and the way back to the
      // camera. The way back to the camera is the ray's direction flipped.
      // Adding the two unit vectors and normalizing the sum gives that
      // halfway direction, so dot(normal, halfway) is 1 on a face that
      // mirrors the sun straight at the camera and falls as the face turns
      // off it (the Blinn-Phong model).
      //
      // pow() of that cosine shapes the highlight. A dot product just under
      // 1, 0.95, stays 0.54 at the power 12 and drops to 0.01 at the power
      // 100, so a low power (SHEEN_FOCUS above) spreads the glow over every
      // face near the reflection, and a high one keeps only the faces that
      // mirror the sun almost exactly. max() keeps pow() off negative
      // numbers, which have no real power.
      //
      // A face turned from the sun can still have its normal near the
      // halfway direction when the sun sits low behind the swells, and would
      // glow from light that never reaches it. smoothstep() fades the sheen
      // in as the face turns toward the sun, over its first 0.15 of
      // sunFacing, about 9 degrees, so the cut isn't a hard line.
      const toCamera = vec3(ray.direction).negate();
      const halfway = sunDirection.add(toCamera).normalize();
      const mirror = max(dot(march.normal, halfway), 0);
      const sunlit = smoothstep(0, 0.15, sunFacing);
      const highlight = mirror
        .pow(max(sheenFocusUniform, 1))
        .mul(sunlit)
        .mul(clamp(sheenUniform, 0, 1));

      // Blend toward sheenColor by the highlight's strength, in the same
      // space the slopes blend in, so the brightest point of a full sheen
      // is exactly sheenColor and no channel ever clips past it.
      const surface = mixColor(diffuse, sheenColorUniform, highlight, colorSpace, hueInterpolation);

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
      // out. At haze 0.04 and a lag of 2, the ground has turned 47% to the
      // haze's color at 20 units and 92% at 40, while its alpha is still 85%
      // at 20 and 53% at 40, where the reach fade below takes it the rest
      // of the way.
      //
      // march.distance is where the ray stopped. For a ray that ran out of
      // steps, that is short of where it meets the ground, so its haze is a
      // little light, but close to its neighbors' that met the crests
      // around it, so no sliver shows.
      const hazeDepth = max(hazeUniform, 0).mul(march.distance).toVar();
      const hazeBlend = hazeDepth.mul(hazeDepth).negate().exp().oneMinus();
      const hazed = mixColor(surface, hazeColorUniform, hazeBlend, colorSpace, hueInterpolation);
      const fadeDepth = hazeDepth.div(max(hazeFadeLagUniform, 0.1));
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
      // it, so it draws nothing. smoothstep() has no defined result when
      // its two edges meet, as they would at a reach fade of 0, so the
      // clamp keeps the share a sliver above 0: a fade over the last 0.1%
      // of the reach, which reads as the hard edge 0 asks for.
      const reachShare = clamp(reachFadeUniform, 1e-3, 1);
      const withinReach = smoothstep(
        maxDistanceUniform.mul(reachShare.oneMinus()),
        maxDistanceUniform,
        march.distance,
      ).oneMinus();

      // The mirage clears the surface where the shimmer peaks, so the sky
      // beneath shows through in wavering patches, as it does over hot sand.
      // shimmer * 0.5 + 0.5 moves it to 0..1, and the clearing grows with
      // the mirage's strength in the band (MIRAGE_CLEARING above).
      // oneMinus() turns the share cleared into the share of the surface
      // that still covers what is beneath.
      const mirageCoverage = shimmer
        .mul(0.5)
        .add(0.5)
        .mul(mirageAmount)
        .mul(clamp(mirageClearingUniform, 0, 1))
        .oneMinus();

      return vec4(hazed, coverage.mul(clearAir).mul(withinReach).mul(mirageCoverage));
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
    sunAngleUniform,
    sunHeightUniform,
    colorUniform,
    shadowColorUniform,
    sheenUniform,
    sheenColorUniform,
    hazeUniform,
    colorSpace,
    hueInterpolation,
    stepScaleUniform,
    maxDistanceUniform,
    maxSlopeUniform,
    windAngleUniform,
    slipFaceUniform,
    crestRoundingUniform,
    meanderUniform,
    rippleSizeUniform,
    rippleHeightUniform,
    sheenFocusUniform,
    mirageUniform,
    shimmerClock,
    reachFadeUniform,
    mirageStartUniform,
    mirageSwayUniform,
    mirageClearingUniform,
    hazeColorUniform,
    hazeFadeLagUniform,
    parallaxPivotUniform,
    travelUniform,
    swellClock,
    parallaxUniform,
    parallaxCenterUniform,
    aspectNode,
  ]);

  return null;
}
