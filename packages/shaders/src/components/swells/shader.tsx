'use client';

// Swells' GPU half. Unlike the flat Sources, this one draws a 3D world. The
// pixel's journey: cast a ray from a perspective camera through the pixel
// (cameraRay), follow it until it meets the sand (marchHeightMap), light
// the sand it hits from a sun, and leave the pixel transparent where the
// ray misses, so the Source beneath shows through as the sky. The wrapper
// (./swells.tsx) supplies the props.
import { useEffect } from 'react';

import {
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
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

import {
  cameraRay,
  type ColorSpace,
  type HueInterpolation,
  marchHeightMap,
  mixColor,
  stableHash,
} from '../../engine.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useAspectUniform } from '../../react/hooks/use-aspect-uniform/use-aspect-uniform.js';
import { useColorUniform } from '../../react/hooks/use-color-uniform/use-color-uniform.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';

type TSLValue = ShaderNodeObject<Node>;

// ---------------------------------------------
// Feel constants (provisional until the defaults gate)
// ---------------------------------------------
// The tuning prop overrides the first seven on the docs page, and the
// defaults gate bakes the landed values back in here.

// The share of the ray's height above the ground that each march step
// moves (marchHeightMap's stepScale). Lower is safer on steep slopes and
// reaches less far in the same steps.
const STEP_SCALE = 0.5;

// How far the camera sees, in terrain units. A ray that travels this far
// without meeting the ground counts as a miss.
const MAX_DISTANCE = 40;

// Which way the wind blows, in compass degrees clockwise from the way the
// camera faces, the convention sunAngle uses: 0 blows straight away from
// the camera, 90 to its right. The crests run square to the wind, and each
// dune's steep face looks downwind.
const WIND_ANGLE = 30;

// The share of each dune's length that its steep downwind face takes, 0 to
// 1. Wind pushes sand up the long, gentle windward face and drops it over
// the crest, where it slides down a short, steep face (the slip face).
// Lower makes that face shorter and steeper; 0.5 makes both faces alike.
const SLIP_FACE = 0.3;

// How far the crests wander from straight lines, in dune lengths. 0 lines
// them up like a ploughed field; higher bends and breaks them more.
const MEANDER = 1.5;

// The distance from one ripple's crest to the next, in terrain units. It
// stays put when `scale` changes, as real wind ripples do. Lower packs them
// tighter, and below about 0.08 they get finer than the normal's height
// reads can follow (NORMAL_OFFSET below).
const RIPPLE_SIZE = 0.1;

// How tall the ripples are at `ripples={1}`, in terrain units. Real ripples
// are a few centimetres on dunes metres tall, so a little goes a long way:
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

// How many layers of noise the broad swell under the dunes sums. Each adds
// bumps half the size of the last. More adds finer detail and costs a noise
// read per march step.
const SWELL_OCTAVES = 2;

// How many noise cells span one dune length for the swell, which both
// bends the crests and lifts and lowers whole stretches of sand. At 0.5 one
// swell spans about two dunes.
const SWELL_FREQUENCY = 0.5;

// How much of the sand's height comes from the swell rather than the dunes,
// as a share of the dunes' own height. Higher rolls the ground more between
// the crests.
const SWELL_SHARE = 0.35;

// How many noise cells span one dune length for each dune's strength, which
// makes one crest stand tall and the next one fade. Higher varies it over a
// shorter stretch.
const STRENGTH_FREQUENCY = 0.8;

// The weakest a dune gets, as a share of the tallest. 1 makes every crest
// the same height; 0 lets some flatten out entirely.
const MIN_STRENGTH = 0.4;

// The ripples' crests wobble from straight lines over a long wavelength:
// how many ripple lengths one full wobble spans across the wind (190 is
// about 19 terrain units at the default ripple size), and how many ripple
// lengths it pushes a crest at the most.
const RIPPLE_WOBBLE_LENGTH = 190;
const RIPPLE_WOBBLE = 1.4;

// How far the swell bends the ripples, in ripple lengths across one swell,
// so the ripples curve with the ground under them instead of running ruler
// straight across every dune.
const RIPPLE_SWELL_BEND = 6;

// Where the ripples fade out, in ripple lengths from the camera. Far away a
// pixel covers several ripples, and the light flickers between their lit
// and shaded sides from pixel to pixel (aliasing, a pattern finer than the
// pixels sampling it). Fading them out before then leaves smooth far sand.
const RIPPLE_FADE_START = 15;
const RIPPLE_FADE_END = 60;

// `scale` counts the dunes, crest to crest, in this many terrain units, so a
// dune is DUNE_SPAN / scale units long. Counting dunes, rather than giving a
// dune's length, keeps `scale` a density, as it is on FractalNoise and
// Voronoi: higher packs in more, smaller features.
const DUNE_SPAN = 10;

// The range of `scale` the shader works with. It divides DUNE_SPAN, so 0
// would blow up, and past MAX_SCALE a dune shorter than a quarter unit would
// push the noise coordinates toward the hash's range (HASH_DOMAIN_OFFSET
// below). MIN_SCALE makes a dune 100 units long, past the horizon.
const MIN_SCALE = 0.1;
const MAX_SCALE = 40;

// The smallest ripple size the shader works with, in terrain units. It
// divides the ground's coordinates, so 0 would blow up.
const MIN_RIPPLE_SIZE = 0.05;

// Shifts noise coordinates positive before hashing. stableHash converts its
// input to u32, and u32 of a negative float is backend-defined. The camera
// sits at the origin and sees maxDistance units at most. At the tuning
// slider's 120 units over the shortest dune, a quarter unit at MAX_SCALE,
// that is 480 dune lengths, and the
// finest noise read, the swell's second octave, reaches about 500 cells, so
// no cell comes near -1024.
const HASH_DOMAIN_OFFSET = 1024;

// Each cell's corner hashes x + y * ROW_STRIDE, one whole number per
// corner. Every cell coordinate stays under ROW_STRIDE, and the sum stays
// under 2^24, where a float still holds every whole number exactly on both
// backends (the seeded-randomness gotcha in docs/agents/tsl.md).
const ROW_STRIDE = 4096;

const DEGREES_TO_RADIANS = Math.PI / 180;

/** TEMPORARY (build-phase tuning only): dev overrides for the feel constants. */
export interface SwellsTuning {
  /** The share of the ray's height above the ground each march step moves, 0 to 1. */
  stepScale?: number;
  /** How far the camera sees, in terrain units. */
  maxDistance?: number;
  /** Which way the wind blows, in compass degrees from the camera's heading. */
  windAngle?: number;
  /** The share of each dune's length its steep downwind face takes, 0 to 1. */
  slipFace?: number;
  /** How far the crests wander from straight lines, in dune lengths. */
  meander?: number;
  /** The distance from one ripple's crest to the next, in terrain units. */
  rippleSize?: number;
  /** How tall the ripples are at full strength, in terrain units. */
  rippleHeight?: number;
}

// ---------------------------------------------
// Noise for the sand's shape
// ---------------------------------------------

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

  // The random height at a corner, from one whole number per corner.
  const corner = (offsetX: number, offsetY: number) =>
    stableHash(cell.x.add(offsetX).add(cell.y.add(offsetY).mul(ROW_STRIDE)));

  const bottom = mix(corner(0, 0), corner(1, 0), weight.x);
  const top = mix(corner(0, 1), corner(1, 1), weight.x);

  return mix(bottom, top, weight.y);
};

/**
 * SWELL_OCTAVES layers of value noise, each twice as fine and half as tall
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

  for (let octave = 0; octave < SWELL_OCTAVES; octave += 1) {
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
   * How many dunes, crest to crest, fit in 10 terrain units. Accepts a
   * static value or an animation signal.
   */
  scale: AnimatableProp<number>;
  /**
   * How tall the dunes are, in terrain units, where 0 is level ground.
   * Accepts a static value or an animation signal.
   */
  relief: AnimatableProp<number>;
  /**
   * How strong the wind ripples are, from 0 to 1, where 0 is smooth sand.
   * Accepts a static value or an animation signal.
   */
  ripples: AnimatableProp<number>;
  /**
   * Where the sun sits around the scene, in compass degrees clockwise from
   * the way the camera faces. Accepts a static value or an animation
   * signal.
   */
  sunAngle: AnimatableProp<number>;
  /**
   * How high the sun sits, in degrees above the horizon. Accepts a static
   * value or an animation signal.
   */
  sunHeight: AnimatableProp<number>;
  /** The sand's color in full sun: hex, `oklch()`, or `oklab()`. */
  color: string;
  /** The sand's color on faces turned from the sun: hex, `oklch()`, or `oklab()`. */
  shadowColor: string;
  /** The color space the slopes between `shadowColor` and `color` blend in. */
  colorSpace: ColorSpace;
  /** The hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert otherwise. */
  hueInterpolation: HueInterpolation;
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
  ripples,
  sunAngle,
  sunHeight,
  color,
  shadowColor,
  colorSpace,
  hueInterpolation,
  tuning,
}: SwellsShaderProps) {
  const shaderContext = useShaderContext();

  // Nothing on screen moves yet, so the scene can park on its first frame.
  // The glide in a later phase changes this vote.
  useStaticSceneHint(true);

  // Every dial lives in a uniform, a value the CPU can change each frame
  // without rebuilding the shader, tracking a static number or a signal.
  const altitudeUniform = useAnimatableUniform<number>(altitude);
  const tiltUniform = useAnimatableUniform<number>(tilt);
  const fieldOfViewUniform = useAnimatableUniform<number>(fieldOfView);
  const scaleUniform = useAnimatableUniform<number>(scale);
  const reliefUniform = useAnimatableUniform<number>(relief);
  const ripplesUniform = useAnimatableUniform<number>(ripples);
  const sunAngleUniform = useAnimatableUniform<number>(sunAngle);
  const sunHeightUniform = useAnimatableUniform<number>(sunHeight);
  const colorUniform = useColorUniform(color);
  const shadowColorUniform = useColorUniform(shadowColor);

  // TEMPORARY: the feel constants ride uniforms too, so the tuning sliders
  // glide. The defaults gate deletes these and bakes the constants back in.
  const stepScaleUniform = useAnimatableUniform<number>(tuning?.stepScale ?? STEP_SCALE);
  const maxDistanceUniform = useAnimatableUniform<number>(tuning?.maxDistance ?? MAX_DISTANCE);
  const windAngleUniform = useAnimatableUniform<number>(tuning?.windAngle ?? WIND_ANGLE);
  const slipFaceUniform = useAnimatableUniform<number>(tuning?.slipFace ?? SLIP_FACE);
  const meanderUniform = useAnimatableUniform<number>(tuning?.meander ?? MEANDER);
  const rippleSizeUniform = useAnimatableUniform<number>(tuning?.rippleSize ?? RIPPLE_SIZE);
  const rippleHeightUniform = useAnimatableUniform<number>(tuning?.rippleHeight ?? RIPPLE_HEIGHT);

  // Canvas width over height, so the view widens on a wide canvas instead
  // of stretching the terrain.
  const aspectNode = useAspectUniform();

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  // Runs once per mount, and again when `colorSpace` or `hueInterpolation`
  // changes, because each space's blend is different shader code. Every
  // other dial flows through a uniform, so nothing else here depends on a
  // prop's value.
  useEffect(() => {
    if (!shaderContext) return;

    // Fn() wraps the body in a GPU function node, which gives the march's
    // loop a list of statements to append to. The trailing () calls it once
    // to produce the node the material renders.
    const swellsNode = Fn(() => {
      // ---------------------------------------------
      // Cast the pixel's ray
      // ---------------------------------------------
      // uv() is the pixel's place on the full-canvas quad, 0..1 both ways,
      // which cameraRay turns into a ray through that point of the view.
      const ray = cameraRay(uv(), {
        aspect: aspectNode,
        altitude: altitudeUniform,
        tilt: tiltUniform,
        fieldOfView: fieldOfViewUniform,
      });

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
      const duneLength = float(DUNE_SPAN)
        .div(clamp(scaleUniform, MIN_SCALE, MAX_SCALE))
        .toVar();
      const rippleLength = max(rippleSizeUniform, MIN_RIPPLE_SIZE).toVar();
      // The steep face's share, kept clear of 0 and 1, where one of the two
      // faces would have no length and the divides below would blow up.
      const slipShare = clamp(slipFaceUniform, 0.05, 0.95).toVar();
      const windwardShare = slipShare.oneMinus().toVar();
      const rippleAmplitude = ripplesUniform.mul(rippleHeightUniform).toVar();

      // How far a ground point lies along the wind, and across it to the
      // wind's right, in the units the point is in. A dot product with the
      // wind's direction measures along it; the direction turned a quarter
      // turn, (windZ, -windX), measures across it.
      const alongWind = (point: TSLValue) => point.x.mul(windX).add(point.y.mul(windZ));
      const acrossWind = (point: TSLValue) => point.x.mul(windZ).sub(point.y.mul(windX));

      // ---------------------------------------------
      // The sand's height: dunes, swell, and ripples
      // ---------------------------------------------
      // The march calls this with a ground point (x, z) on every step and
      // every bisection step, then once more where it stopped, and the
      // normal calls it four more times around the hit.
      const heightAt = (groundPoint: TSLValue) => {
        // The point in dune lengths, so one unit is one dune crest to crest.
        const dunePoint = groundPoint.div(duneLength);

        // The swell: broad noise, 0..1, that rolls the ground and bends the
        // crests. Each dune's strength is a second noise, slid by an
        // arbitrary offset so it doesn't track the swell.
        const swell = layeredNoise(dunePoint.mul(SWELL_FREQUENCY));
        const strength = valueNoise(dunePoint.mul(STRENGTH_FREQUENCY).add(vec2(41.7, 23.9)));

        // Where the point falls within its dune, 0..1 from one trough to
        // the next, measured downwind. fract() keeps the fractional part, so
        // the count repeats once per dune length. Adding the swell, centered
        // on 0 and scaled by the meander, slides the crests up and down the
        // wind from place to place, so they bend instead of running straight.
        const withinDune = fract(alongWind(dunePoint).add(swell.sub(0.5).mul(meanderUniform)));

        // The dune's profile: a triangle that climbs from 0 at the trough
        // to 1 at the crest over the windward share, then drops back to 0
        // over the slip face's share. Each face is a straight line, the
        // first rising as withinDune / windwardShare and the second falling
        // as (1 - withinDune) / slipShare, and min() takes whichever is
        // lower, which is the rising line before the crest and the falling
        // one after. Squaring it bends both faces so they meet sharp at the
        // crest and round at the trough: at the crest the square still
        // slopes steeply, and at the trough it flattens to 0. A sharp crest
        // is what splits a dune into a lit face and a shaded one.
        const ridge = min(
          withinDune.div(windwardShare),
          withinDune.oneMinus().div(slipShare),
        ).toVar();
        const profile = ridge.mul(ridge);

        // The dune's own height, scaled by its strength, then the swell
        // added under it. Dividing by 1 + SWELL_SHARE brings the tallest
        // sum back to 1, so `relief` is the height of the tallest crests,
        // before the ripples add their few thousandths of a unit on top.
        const dunes = profile
          .mul(mix(MIN_STRENGTH, 1, strength))
          .add(swell.mul(SWELL_SHARE))
          .div(1 + SWELL_SHARE)
          .mul(reliefUniform);

        // The ripples: a sine wave whose crests run square to the wind,
        // one per ripple length, its phase wobbled across the wind and bent
        // by the swell so the crests curve. sin() of the phase times 2 pi
        // runs one full wave per ripple length; * 0.5 + 0.5 moves it to
        // 0..1, so a ripple only ever adds sand.
        const ripplePoint = groundPoint.div(rippleLength);
        const ripplePhase = alongWind(ripplePoint)
          .add(
            sin(acrossWind(ripplePoint).mul((Math.PI * 2) / RIPPLE_WOBBLE_LENGTH)).mul(
              RIPPLE_WOBBLE,
            ),
          )
          .add(swell.mul(RIPPLE_SWELL_BEND));
        const wave = sin(ripplePhase.mul(Math.PI * 2))
          .mul(0.5)
          .add(0.5);

        // Fade the ripples out with distance from the camera, which stands
        // over (0, 0), measured in ripple lengths. smoothstep() runs 0..1
        // from the fade's start to its end, and oneMinus() flips it, so the
        // ripples hold full strength up close and reach 0 at the end.
        const fade = smoothstep(
          RIPPLE_FADE_START,
          RIPPLE_FADE_END,
          length(groundPoint).div(rippleLength),
        ).oneMinus();

        return dunes.add(wave.mul(rippleAmplitude).mul(fade));
      };

      // ---------------------------------------------
      // Find where the ray meets the sand
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

      // How squarely the sand faces the sun. The normal points straight out
      // of the ground, and its dot product with the sun's direction is the
      // cosine of the angle between them: 1 where the sand faces the sun
      // head on, 0 where the light runs along it, negative where it faces
      // away. max() clamps the far side to 0, so sand turned from the sun
      // takes the shadow color alone. mixColor blends the two colors in
      // `colorSpace`, so the slopes between them pass through that space's
      // midpoints: oklab's keep an even lightness step, where linear RGB's
      // turn muddy between a warm and a cool color.
      //
      // A low sun is what makes dunes read. Level sand faces a sun 15
      // degrees up at only sin(15) = 0.26, a slope that tips toward it
      // climbs fast toward 1, and one that tips away drops to 0. So small
      // slopes swing far between the two colors, and every crest splits
      // into a lit face and a shaded one (raking light). A sun overhead
      // lights level sand at 1 and a 20 degree slope at cos(20) = 0.94, so
      // the same dunes flatten into one tone.
      const facing = max(dot(march.normal, sunDirection), 0);
      const sand = mixColor(shadowColorUniform, colorUniform, facing, colorSpace, hueInterpolation);

      // ---------------------------------------------
      // Leave the sky transparent
      // ---------------------------------------------
      // hit is 1 on the ground and 0 where the ray missed, so it serves as
      // the alpha: the ground covers what is beneath it, and the sky lets
      // it through.
      return vec4(sand, march.hit);
    })();

    // An unlit material whose per-pixel color comes from colorNode.
    // transparent lets the alpha above show the Source beneath.
    const material = new MeshBasicNodeMaterial();

    material.transparent = true;
    material.colorNode = swellsNode;

    // A 2x2 plane exactly fills ShaderScene's camera view (-1..1 on both
    // axes), so every pixel of the canvas casts a ray.
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext.scene.add(mesh);

    // A still scene is parked, so ask it to draw the new mesh.
    shaderContext.scheduler.requestRender();

    return () => {
      shaderContext.scene.remove(mesh);
      // Another still Source can keep the scene parked, and a parked scene
      // would keep showing the sand, so ask for a frame without it.
      shaderContext.scheduler.requestRender();
      try {
        material.dispose();
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
      try {
        mesh.geometry.dispose();
      } catch {
        // same
      }
    };
  }, [
    shaderContext,
    altitudeUniform,
    tiltUniform,
    fieldOfViewUniform,
    scaleUniform,
    reliefUniform,
    ripplesUniform,
    sunAngleUniform,
    sunHeightUniform,
    colorUniform,
    shadowColorUniform,
    colorSpace,
    hueInterpolation,
    stepScaleUniform,
    maxDistanceUniform,
    windAngleUniform,
    slipFaceUniform,
    meanderUniform,
    rippleSizeUniform,
    rippleHeightUniform,
    aspectNode,
  ]);

  return null;
}
