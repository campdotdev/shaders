// A ray for each pixel from a perspective camera: where the ray starts and
// which way it points. A 3D Source draws its world by following each pixel's
// ray until it meets something, so this is the first step of every such
// Source. marchHeightMap (../march-height-map) follows the ray over a
// terrain. Swells casts its rays here, and Mode 2 users call it on their own uv.
import { cos, float, normalize, type ShaderNodeObject, sin, tan, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

type TSLValue = ShaderNodeObject<Node>;

/** A ray: a start point and a unit direction, both in world space. */
export interface Ray {
  /** Where the ray starts, as a vec3. */
  origin: TSLValue;
  /** Which way the ray points, as a unit-length vec3. */
  direction: TSLValue;
}

/** How far the camera turns from its heading, in degrees. */
export interface CameraTurn {
  /** Degrees the camera turns to the right. Negative turns it left. Default 0. */
  right?: TSLNode | number;
  /** Degrees the camera tilts up, on top of `tilt`. Negative tilts it down. Default 0. */
  up?: TSLNode | number;
}

export interface CameraRayOptions {
  /**
   * The canvas's width over its height, so the view widens on a wide canvas
   * instead of stretching. Default 1.
   */
  aspect?: TSLNode | number;
  /** How high the camera sits above the ground plane, y = 0. Default 1. */
  altitude?: TSLNode | number;
  /**
   * How far the camera looks down from the horizon, in degrees. 0 looks
   * straight at the horizon, 90 looks straight down. Default 0.
   */
  tilt?: TSLNode | number;
  /**
   * How much the camera sees from the bottom of the canvas to the top, in
   * degrees. Lower values zoom in and flatten depth; higher values widen
   * the view and deepen it. Default 60.
   */
  fieldOfView?: TSLNode | number;
  /** How far the camera turns from looking down +z, in degrees. Default no turn. */
  turn?: CameraTurn;
}

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * The ray from a perspective camera through one point on the canvas.
 *
 * The world is y up. With no turn, the camera sits at (0, altitude, 0) and
 * faces +z, with +x to its right. `tilt` pitches it down from there, and
 * `turn` swings it right and up on top of that.
 *
 * @param position — The pixel's place on the canvas, 0..1 on both axes
 *   with y up, as `uv()` gives it on a full-canvas quad.
 */
export function cameraRay(position: TSLNode, options: CameraRayOptions = {}): Ray {
  const point = vec2(position);
  const aspect = float(options.aspect ?? 1);
  const altitude = float(options.altitude ?? 1);
  const fieldOfView = float(options.fieldOfView ?? 60);

  // ---------------------------------------------
  // Point the camera
  // ---------------------------------------------
  // Two angles aim the camera: how far it turns right of +z (yaw), and how
  // far it looks down from the horizon (pitch). A turn up lowers the pitch,
  // so a camera tilted 10 degrees down and turned 4 up looks 6 down.
  const yaw = float(options.turn?.right ?? 0).mul(DEGREES_TO_RADIANS);
  const pitch = float(options.tilt ?? 0)
    .sub(float(options.turn?.up ?? 0))
    .mul(DEGREES_TO_RADIANS);
  const cosYaw = cos(yaw);
  const sinYaw = sin(yaw);
  const cosPitch = cos(pitch);
  const sinPitch = sin(pitch);

  // The camera's three axes, worked out from those angles. With no turn and
  // no tilt they are the world's own: forward +z, right +x, up +y.
  //
  // - forward starts at +z, dips by the pitch (its y goes to -sin(pitch)),
  //   then swings around y by the yaw.
  // - right stays level, because the camera never rolls: it is +x swung by
  //   the yaw.
  // - up is square to both. It leans forward as the camera looks down, so
  //   at a 90 degree pitch it points along the old forward.
  const forward = vec3(sinYaw.mul(cosPitch), sinPitch.negate(), cosYaw.mul(cosPitch));
  const right = vec3(cosYaw, 0, sinYaw.negate());
  const up = vec3(sinYaw.mul(sinPitch), cosPitch, cosYaw.mul(sinPitch));

  // ---------------------------------------------
  // Aim the ray through the pixel
  // ---------------------------------------------
  // Picture a screen one unit in front of the camera. The field of view is
  // the angle from its bottom edge to its top, so its half height is
  // tan(fieldOfView / 2), and its half width is that times the aspect.
  // The pixel's place on that screen, -1..1 across each axis, scales the
  // half sizes. The ray runs from the camera through that point, and
  // normalize() makes it one unit long, so a distance along it is a
  // distance in the world.
  const halfHeight = tan(fieldOfView.mul(DEGREES_TO_RADIANS * 0.5));
  const screenX = point.x.mul(2).sub(1).mul(aspect).mul(halfHeight);
  const screenY = point.y.mul(2).sub(1).mul(halfHeight);
  const direction = normalize(forward.add(right.mul(screenX)).add(up.mul(screenY)));

  return { origin: vec3(0, altitude, 0), direction };
}
