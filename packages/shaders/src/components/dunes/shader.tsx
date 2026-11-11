'use client';

// Dunes' GPU half. Unlike the flat Sources, this one draws a 3D world. The
// pixel's journey: cast a ray from a perspective camera through the pixel
// (cameraRay), follow it until it meets the terrain (marchHeightMap), light
// the ground it hits from the slope there, and leave the pixel transparent
// where the ray misses, so the Source beneath shows through as the sky. The
// wrapper (./dunes.tsx) supplies the props.
import { useEffect } from 'react';

import {
  dot,
  float,
  floor,
  Fn,
  fract,
  max,
  mix,
  type ShaderNodeObject,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

import { cameraRay, marchHeightMap, stableHash } from '../../engine.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useAspectUniform } from '../../react/hooks/use-aspect-uniform/use-aspect-uniform.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';
import { parseColor } from '../shared/color.js';

type TSLValue = ShaderNodeObject<Node>;

// ---------------------------------------------
// Feel constants (provisional until the defaults gate)
// ---------------------------------------------
// The tuning prop overrides the first four on the docs page, and the
// defaults gate bakes the landed values back in here.

// How many noise cells span one terrain unit. One cell is about one hill,
// so at 0.35 a hill is about 3 units across. Higher packs more, smaller
// hills.
const FREQUENCY = 0.35;

// How tall the terrain's highest crests are, in terrain units. The noise
// runs 0..1, so the ground sits between 0 and this height.
const TERRAIN_HEIGHT = 0.8;

// The share of the ray's height above the ground that each march step
// moves (marchHeightMap's stepScale). Lower is safer on steep slopes and
// reaches less far in the same steps.
const STEP_SCALE = 0.5;

// How far the camera sees, in terrain units. A ray that travels this far
// without meeting the ground counts as a miss.
const MAX_DISTANCE = 40;

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

// How many layers of noise the terrain sums. Each adds bumps half the size
// of the last. More adds finer detail and costs a noise read per march step.
const OCTAVES = 3;

// Where the light comes from: a unit vector pointing from the ground toward
// it, here from the left and ahead of the camera, about 25 degrees above the
// horizon. A low light rakes across the hills, so a gentle slope turns far
// enough toward or away from it to change its shade. Phase 2 replaces it
// with the sun.
const LIGHT_DIRECTION = (() => {
  const [x, y, z] = [-0.75, 0.42, 0.5];
  const length = Math.hypot(x, y, z);

  return [x / length, y / length, z / length] as const;
})();

// The ground's color facing the light and facing away from it, decoded to
// linear RGB once. A warm sand and a darker, cooler shade. Phase 2 makes
// both props.
const LIT_COLOR = parseColor('oklch(0.82 0.08 75)');
const SHADE_COLOR = parseColor('oklch(0.42 0.05 40)');

// Shifts noise coordinates positive before hashing. stableHash converts its
// input to u32, and u32 of a negative float is backend-defined. The camera
// sits at the origin and sees MAX_DISTANCE units at most, so at the
// frequency above no cell coordinate comes near -1024.
const HASH_DOMAIN_OFFSET = 1024;

// Each cell's corner hashes x + y * ROW_STRIDE, one whole number per
// corner. Every cell coordinate stays under ROW_STRIDE, and the sum stays
// under 2^24, where a float still holds every whole number exactly on both
// backends (the seeded-randomness gotcha in docs/agents/tsl.md).
const ROW_STRIDE = 4096;

/** TEMPORARY (build-phase tuning only): dev overrides for the feel constants. */
export interface DunesTuning {
  /** How many noise cells span one terrain unit; one cell is about one hill. */
  frequency?: number;
  /** How tall the highest crests are, in terrain units. */
  terrainHeight?: number;
  /** The share of the ray's height above the ground each march step moves, 0 to 1. */
  stepScale?: number;
  /** How far the camera sees, in terrain units. */
  maxDistance?: number;
}

// ---------------------------------------------
// The terrain's height
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
 * OCTAVES layers of value noise, each twice as fine and half as tall as the
 * last, so big hills carry smaller bumps. Each octave turns the grid by
 * about 37 degrees (the 0.8 and 0.6 below are its cosine and sine) and
 * slides it by an arbitrary offset, (17.3, 9.1), so the octaves' grid lines
 * and their shared origin don't line up into visible rows or a seam at
 * (0, 0). Dividing by the summed amplitudes keeps the result 0..1.
 */
const terrainNoise = (point: TSLValue): TSLValue => {
  let sum: TSLValue = float(0);
  let octavePoint = point;
  let amplitude = 1;
  let total = 0;

  for (let octave = 0; octave < OCTAVES; octave += 1) {
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

export interface DunesShaderProps {
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
   * TEMPORARY (build-phase tuning only): dev overrides for the feel
   * constants.
   */
  tuning: DunesTuning | undefined;
}

export function DunesShader({ altitude, tilt, fieldOfView, tuning }: DunesShaderProps) {
  const shaderContext = useShaderContext();

  // Nothing on screen moves yet, so the scene can park on its first frame.
  // The glide in a later phase changes this vote.
  useStaticSceneHint(true);

  // The camera dials live in uniforms, values the CPU can change each frame
  // without rebuilding the shader, tracking a static number or a signal.
  const altitudeUniform = useAnimatableUniform<number>(altitude);
  const tiltUniform = useAnimatableUniform<number>(tilt);
  const fieldOfViewUniform = useAnimatableUniform<number>(fieldOfView);

  // TEMPORARY: the feel constants ride uniforms too, so the tuning sliders
  // glide. The defaults gate deletes these and bakes the constants back in.
  const frequencyUniform = useAnimatableUniform<number>(tuning?.frequency ?? FREQUENCY);
  const terrainHeightUniform = useAnimatableUniform<number>(
    tuning?.terrainHeight ?? TERRAIN_HEIGHT,
  );
  const stepScaleUniform = useAnimatableUniform<number>(tuning?.stepScale ?? STEP_SCALE);
  const maxDistanceUniform = useAnimatableUniform<number>(tuning?.maxDistance ?? MAX_DISTANCE);

  // Canvas width over height, so the view widens on a wide canvas instead
  // of stretching the terrain.
  const aspectNode = useAspectUniform();

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  // Runs once per mount. Every dial flows through a uniform, so nothing here
  // depends on a prop's value.
  useEffect(() => {
    if (!shaderContext) return;

    // Fn() wraps the body in a GPU function node, which gives the march's
    // loop a list of statements to append to. The trailing () calls it once
    // to produce the node the material renders.
    const dunesNode = Fn(() => {
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
      // Find where it meets the ground
      // ---------------------------------------------
      // The height function turns a ground point (x, z) into the ground's
      // height there: noise at frequency cells per unit, scaled to the
      // terrain's height.
      const heightAt = (groundPoint: TSLValue) =>
        terrainNoise(groundPoint.mul(frequencyUniform)).mul(terrainHeightUniform);

      const march = marchHeightMap(ray, heightAt, {
        steps: STEP_COUNT,
        maxDistance: maxDistanceUniform,
        stepScale: stepScaleUniform,
        normalOffset: NORMAL_OFFSET,
      });

      // ---------------------------------------------
      // Light it from the slope
      // ---------------------------------------------
      // The normal points straight out of the ground. Its dot product with
      // the light direction is the cosine of the angle between them: 1
      // where the ground faces the light, 0 where the light runs along it,
      // negative where the ground faces away. max() clamps the far side to
      // 0, so ground turned from the light takes the shade color alone.
      const facing = max(dot(march.normal, vec3(...LIGHT_DIRECTION)), 0);
      const color = mix(vec3(...SHADE_COLOR), vec3(...LIT_COLOR), facing);

      // ---------------------------------------------
      // Leave the sky transparent
      // ---------------------------------------------
      // hit is 1 on the ground and 0 where the ray missed, so it serves as
      // the alpha: the ground covers what is beneath it, and the sky lets
      // it through.
      return vec4(color, march.hit);
    })();

    // An unlit material whose per-pixel color comes from colorNode.
    // transparent lets the alpha above show the Source beneath.
    const material = new MeshBasicNodeMaterial();

    material.transparent = true;
    material.colorNode = dunesNode;

    // A 2x2 plane exactly fills ShaderScene's camera view (-1..1 on both
    // axes), so every pixel of the canvas casts a ray.
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext.scene.add(mesh);

    // A still scene is parked, so ask it to draw the new mesh.
    shaderContext.scheduler.requestRender();

    return () => {
      shaderContext.scene.remove(mesh);
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
    frequencyUniform,
    terrainHeightUniform,
    stepScaleUniform,
    maxDistanceUniform,
    aspectNode,
  ]);

  return null;
}
