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
  /** 1 where the ray met the ground, 0 where it missed. A float, ready to mask with. */
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

// How close to the ground the ray must end to count as a hit, as a share of
// the distance travelled. Looser than STOP_PRECISION, so a ray that ran out
// of steps while grazing far ground still draws it. Higher lets more rays
// that pass just over a crest draw ground behind it.
const HIT_TOLERANCE = 0.02;

/**
 * March a ray over a height map: from the ray's origin, step forward by a
 * share of the height above the ground until the ray is close enough to the
 * ground to count as a hit, goes past `maxDistance`, or runs out of steps.
 *
 * Written with TSL's Fn and Loop, so the GPU runs a real `for` loop with a
 * fixed bound (the running-minimum gotcha in docs/agents/tsl.md). The
 * height function runs once per step, so keep heavyweight noise out of it
 * (the 128-second-compile gotcha in docs/agents/tsl.md).
 */
export function marchHeightMap(
  ray: Ray,
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
  // Fn gives Loop and If a list of statements to append to. Its result is
  // the distance along the ray where the march stopped.
  const distance = Fn(() => {
    // Pin the ray in GPU variables before the loop. A TSL node is written
    // out where the shader first uses it, and that would be inside the loop,
    // redoing the camera math on every step (the first-use gotcha in
    // docs/agents/tsl.md).
    const origin = vec3(ray.origin).toVar();
    const direction = vec3(ray.direction).toVar();
    const travelled = float(0).toVar();

    Loop(steps, () => {
      const point = origin.add(direction.mul(travelled));

      // How high the ray sits above the ground straight beneath it. Below 0
      // means it has gone under.
      const clearance = point.y.sub(heightAt(vec2(point.x, point.z))).toVar();

      // Close enough to stop. The tolerance grows with distance, because
      // one pixel covers more ground far away, so a far ray needs less
      // precision to look the same.
      If(clearance.lessThan(travelled.mul(STOP_PRECISION)), () => {
        Break();
      });

      // How far a step can safely go. Over flat ground, a ray that sits
      // `clearance` above it has at least `clearance` to travel before it
      // can reach it, so a step of the full clearance never passes through.
      // Where the ground rises toward the ray, the ray meets it sooner, and
      // a full step can jump through a crest. A level ray meets ground that
      // rises at slope s after clearance / s units, so a step of
      // stepScale * clearance stays short of it while s is under
      // 1 / stepScale: slopes up to 45 degrees at 1, and up to about 63
      // degrees at 0.5. A step that lands just under the ground has a
      // negative clearance, so the next step moves back up toward the
      // surface.
      travelled.addAssign(clearance.mul(stepScale));

      If(travelled.greaterThan(maxDistance), () => {
        Break();
      });
    });

    return travelled;
  })().toVar();

  // ---------------------------------------------
  // Read the hit
  // ---------------------------------------------
  // A hit stopped short of maxDistance, close to the ground. A ray that
  // grazes far terrain closes in slowly and can use up every step a little
  // above the ground, so the hit test is looser than the stop test. A ray
  // that ran out of steps well above the ground, as one aimed just over the
  // horizon does, is a miss. The clearance is read again at the point where
  // the march stopped, because the loop's last step moves on past the point
  // it last measured. step(edge, x) is 1 when x >= edge, so each factor is 1
  // when its test passes.
  const position = vec3(ray.origin).add(vec3(ray.direction).mul(distance)).toVar();
  const endClearance = position.y.sub(heightAt(vec2(position.x, position.z)));
  const hit = step(distance, maxDistance).mul(step(endClearance, distance.mul(HIT_TOLERANCE)));

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
