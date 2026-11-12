// Follows a ray until it first meets a terrain described by a height map,
// and reports where, how far along the ray, and which way the ground faces
// there. A height map is a function from a ground point (x, z) to the
// terrain's height at that point. The caller brings the height function,
// the light, and any fog, so this knows nothing about what the terrain is.
// Dunes marches its sand with it, and Mode 2 users march their own terrain.
import {
  abs,
  Break,
  float,
  Fn,
  If,
  Loop,
  max,
  normalize,
  type ShaderNodeObject,
  step,
  vec2,
  vec3,
} from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { Ray } from '../camera-ray/camera-ray.js';
import type { TSLNode } from '../color-ramp/color-ramp.js';

type TSLValue = ShaderNodeObject<Node>;

/**
 * The terrain's height at a ground point. It receives a vec2 of the point's
 * world x and z, and returns a float: the world y of the ground there.
 */
export type HeightFunction = (groundPoint: TSLValue) => TSLNode;

export interface MarchHeightMapOptions {
  /**
   * How many steps the ray takes before it gives up, a whole number above 0.
   * It is a JS number fixed when the shader builds, because WebGL2 accepts
   * only a loop with a constant bound. More steps find thin crests and far
   * ground more reliably, and cost GPU time on every pixel.
   */
  steps: number;
  /**
   * How far along the ray to look before calling it a miss, in world units.
   * A ray that gets this far without meeting the ground missed it. Default
   * 100.
   */
  maxDistance?: TSLNode | number;
  /**
   * The share of the height above the ground that each step moves, from
   * just above 0 to 1. At 1 a step moves the full height, which overshoots
   * a crest when the ground slopes up toward the ray. Lower values are
   * safer and need more steps to go as far. Default 0.5.
   */
  stepScale?: TSLNode | number;
  /**
   * How far apart, in world units, the normal's height reads sit on either
   * side of the hit. Smaller values follow finer detail and pick up more
   * noise. Default 0.01.
   */
  normalOffset?: TSLNode | number;
}

export interface MarchHeightMapResult {
  /**
   * 1 where the ray met the ground, 0 where it missed. A float, ready to mask
   * with. A ray that starts under the ground, such as from a camera inside a
   * hill, misses.
   */
  hit: TSLValue;
  /**
   * How far along the ray it met the ground, in world units. Undefined where
   * it missed. A ray that grazes far ground can use up every step just above
   * it, and then counts as a hit where it stopped, which is short of where it
   * would meet the ground. More steps bring that point closer.
   */
  distance: TSLValue;
  /** Where the ray met the ground, as a vec3 in world space. */
  position: TSLValue;
  /** The unit vector pointing straight out of the ground there, as a vec3. */
  normal: TSLValue;
}

// How close to the ground the march stops, as a share of the distance
// travelled: at 0.001, a ray 10 units out stops within 0.01 units of the
// ground. Lower is more precise and uses more steps.
const STOP_PRECISION = 0.001;

// How close to the ground a ray that never crossed it must end to count as
// a hit, as a share of the distance travelled. Looser than STOP_PRECISION,
// so a ray that ran out of steps while grazing far ground still draws it.
// Higher lets more rays that pass just over a crest draw ground behind it.
const HIT_TOLERANCE = 0.02;

// How many times the march halves the gap around the ground after a step
// lands under it. Each halving doubles the precision, so 8 narrows the gap
// to 1/256 of the step that went under.
const REFINE_STEPS = 8;

/**
 * March a ray over a height map: from the ray's origin, step forward by a
 * share of the height above the ground until the ray is close enough to the
 * ground to count as a hit, goes past `maxDistance`, or runs out of steps.
 * A step that lands under the ground, as one can on a steep slope, is then
 * walked back to the surface between it and the last point above.
 *
 * Written with TSL's Fn and Loop, so the GPU runs a real `for` loop with a
 * fixed bound (the running-minimum gotcha in docs/agents/tsl.md). The
 * height function runs once per step, so keep heavyweight noise out of it
 * (the 128-second-compile gotcha in docs/agents/tsl.md).
 */
export function marchHeightMap(
  // Wider than cameraRay's Ray, so a hand-built ray can hold uniforms
  // (TSLNode's JSDoc says why a uniform doesn't fit Ray's fields).
  ray: { [Field in keyof Ray]: TSLNode },
  height: HeightFunction,
  options: MarchHeightMapOptions,
): MarchHeightMapResult {
  const { steps } = options;

  if (!Number.isInteger(steps) || steps < 1) {
    throw new RangeError(`marchHeightMap: steps must be a whole number above 0, got ${steps}`);
  }

  const maxDistance = float(options.maxDistance ?? 100);
  const stepScale = float(options.stepScale ?? 0.5);
  const normalOffset = float(options.normalOffset ?? 0.01);
  const heightAt = (groundPoint: TSLValue) => float(height(groundPoint));

  // ---------------------------------------------
  // March the ray
  // ---------------------------------------------
  // Fn gives Loop and If a list of statements to append to. Its result packs
  // two floats into a vec2: x is the distance along the ray where the march
  // stopped, and y is 1 if the march saw the ray cross the ground.
  const march = Fn(() => {
    // Pin the ray in GPU variables before the loop. A TSL node is written
    // out where the shader first uses it, and that would be inside the loop,
    // redoing the camera math on every step (the first-use gotcha in
    // docs/agents/tsl.md).
    const origin = vec3(ray.origin).toVar();
    const direction = vec3(ray.direction).toVar();

    // How high the ray sits above the ground straight beneath it, `along`
    // units from its origin. Below 0 means it has gone under.
    const clearanceAt = (along: TSLValue) => {
      const point = origin.add(direction.mul(along));

      return point.y.sub(heightAt(vec2(point.x, point.z)));
    };

    const travelled = float(0).toVar();

    // The furthest point along the ray the march has measured above the
    // ground. If a step goes under, the surface lies between here and there.
    const above = float(0).toVar();

    // 1 once the march has measured a point above the ground. A ray that
    // starts under the ground never does.
    const measuredAbove = float(0).toVar();

    // 1 if the ray went from above the ground to under it, which proves it
    // met the ground.
    const crossed = float(0).toVar();

    Loop(steps, () => {
      const clearance = clearanceAt(travelled).toVar();

      // Close enough to stop, or gone under. The tolerance grows with
      // distance, because one pixel covers more ground far away, so a far
      // ray needs less precision to look the same.
      If(clearance.lessThan(travelled.mul(STOP_PRECISION)), () => {
        Break();
      });

      above.assign(travelled);
      measuredAbove.assign(1);

      // How far a step can safely go. Over flat ground, a ray that sits
      // `clearance` above it has at least `clearance` to travel before it
      // can reach it, so a step of the full clearance never passes through.
      // Where the ground rises toward the ray, the ray meets it sooner, and
      // a full step can jump through a crest. A level ray meets ground that
      // rises at slope s after clearance / s units, so a step of
      // stepScale * clearance stays short of it while s is under
      // 1 / stepScale: slopes up to 45 degrees at 1, and up to about 63
      // degrees at 0.5. A steeper slope can still take a step under the
      // ground, which the refinement below walks back.
      travelled.addAssign(clearance.mul(stepScale));

      If(travelled.greaterThan(maxDistance), () => {
        Break();
      });
    });

    // ---------------------------------------------
    // Walk an overshoot back to the surface
    // ---------------------------------------------
    // A march that ended under the ground has the surface somewhere between
    // `above` and `travelled`. Bisection finds it: test the middle of that
    // gap, keep the half the surface is in, and repeat, halving the gap each
    // time. The march then stops at the gap's near end, which is always
    // above the ground. On a steep slope the near end can still sit higher
    // than the hit tolerance allows, so the crossing itself marks the hit.
    // A ray that starts under the ground has no gap to search (both ends
    // are 0) and never measured a point above, so it never crosses.
    If(clearanceAt(travelled).lessThan(0), () => {
      crossed.assign(measuredAbove);

      const below = travelled.toVar();

      Loop(REFINE_STEPS, () => {
        const middle = above.add(below).mul(0.5).toVar();

        If(clearanceAt(middle).lessThan(0), () => {
          below.assign(middle);
        }).Else(() => {
          above.assign(middle);
        });
      });

      travelled.assign(above);
    });

    return vec2(travelled, crossed);
  })().toVar();

  const distance = march.x;
  const crossed = march.y;

  // ---------------------------------------------
  // Read the hit
  // ---------------------------------------------
  // A hit stopped short of maxDistance, and either crossed the ground or
  // ended close to it. A ray that grazes far terrain closes in slowly and
  // can use up every step a little above the ground without crossing, so
  // the near-ground test is looser than the stop test. A ray that ran out
  // of steps well above the ground, as one aimed just over the horizon
  // does, is a miss. The clearance is read again at the point where the
  // march stopped, because the loop's last step moves on past the point it
  // last measured. It must sit between 0 and the tolerance: only a ray that
  // started under the ground ends below 0. step(edge, x) is 1 when x >=
  // edge, so each factor is 1 when its test passes, and max() of two such
  // factors is 1 when either passes.
  const position = vec3(ray.origin).add(vec3(ray.direction).mul(distance)).toVar();
  const endClearance = position.y.sub(heightAt(vec2(position.x, position.z))).toVar();
  const nearGround = step(0, endClearance).mul(step(endClearance, distance.mul(HIT_TOLERANCE)));
  const hit = step(distance, maxDistance).mul(max(crossed, nearGround));

  // ---------------------------------------------
  // The normal from the slope
  // ---------------------------------------------
  // The slope of the ground along x is how much the height changes per unit
  // of x, measured here by reading the height a little to either side and
  // dividing by the gap (a central difference). The same goes along z. A
  // ground that rises by slopeX per unit of x faces back against that rise,
  // so its normal is (-slopeX, 1, -slopeZ), normalized. Multiplying through
  // by the gap, 2 * offset, gives the same direction without a divide.
  // max() keeps a zero offset from collapsing the normal to (0, 0, 0).
  const offset = max(abs(normalOffset), 1e-5);
  const ground = vec2(position.x, position.z);
  const alongX = vec2(offset, 0);
  const alongZ = vec2(0, offset);
  const riseX = heightAt(ground.add(alongX)).sub(heightAt(ground.sub(alongX)));
  const riseZ = heightAt(ground.add(alongZ)).sub(heightAt(ground.sub(alongZ)));
  const normal = normalize(vec3(riseX.negate(), offset.mul(2), riseZ.negate()));

  return { hit, distance, position, normal };
}
