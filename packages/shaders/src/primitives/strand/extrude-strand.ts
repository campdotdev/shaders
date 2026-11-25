// Widens a path into a strip a set number of CSS pixels wide, in the vertex
// stage: the part of a shader that runs once per vertex and says where on
// screen that vertex lands. It reads each vertex's place on its strand from
// the attributes createStrandGeometry wrote, asks the caller's path where
// that place is in 3D, and pushes the vertex sideways from there. The caller
// brings the path, so this knows nothing about what shape the strands make.
import {
  cameraProjectionMatrix,
  float,
  length,
  max,
  modelViewMatrix,
  screenSize,
  type ShaderNodeObject,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';
import { strandAttributes } from './strand-attributes.js';
import { MIN_STRAND_HALF_WIDTH } from './strand-profile.js';

type TSLValue = ShaderNodeObject<Node>;

/**
 * Where a strand is, in 3D. It receives three floats: `along`, from 0 at the
 * strand's start to 1 at its end; `across`, the strand's place among the
 * others from 0 to 1; and `seed`, a random number from 0 to 1 that is fixed
 * per strand. It returns a vec3 in the mesh's own space, which the mesh's
 * transform and the camera then project like any other vertex.
 *
 * It must be a pure function of its inputs and any uniforms it reads, time
 * included. It is called with `along` a little below 0 and a little above
 * 1, to find which way the strand runs at its two ends.
 */
export type StrandPath = (along: TSLValue, across: TSLValue, seed: TSLValue) => TSLNode;

export interface ExtrudeStrandOptions {
  /**
   * How thick one strand is, in CSS pixels, from one edge of its strip to
   * the other, at any distance from the camera. It is not the width of the
   * whole bundle of strands, which the path decides. The bright core of a
   * strand shaded with strandProfile is about 40% of this, because the
   * falloff reaches nothing at the edge. The strip is never narrower than
   * twice MIN_STRAND_HALF_WIDTH, and strandProfile dims a thinner strand
   * instead.
   */
  strandWidth: TSLNode | number;
}

export interface ExtrudeStrandResult {
  /**
   * Where the vertex lands, as a vec4 in clip space: the coordinates a
   * vertex shader outputs, which the GPU divides by their w to get a place
   * on screen. Set it as the material's `vertexNode`.
   */
  position: TSLValue;
  /**
   * How far the pixel is from the strand's center line, in CSS pixels, as a
   * float. Negative on one side and positive on the other. Read it in the
   * color node, for example with strandProfile.
   */
  distance: TSLValue;
}

// How far either side of a vertex the path is read to find which way the
// strand runs there, in units of `along`. 0.001 is a thousandth of the
// strand's length. Smaller follows a tight curve more closely, and too small
// leaves the two reads less than a pixel apart, where the direction turns to
// rounding noise.
const TANGENT_STEP = 0.001;

/**
 * Widen `path` into a strip `strandWidth` CSS pixels wide.
 *
 * The widening happens on screen, not in 3D. Each vertex's point on the path
 * is projected through the camera first, then pushed sideways in pixels. So
 * a strand is the same width near the camera and far from it, and it always
 * faces the viewer.
 *
 * Use it on a mesh built with createStrandGeometry. The path runs three
 * times per vertex, so keep heavyweight noise out of it (the
 * 128-second-compile gotcha in docs/agents/tsl.md).
 */
export function extrudeStrand(
  path: StrandPath,
  options: ExtrudeStrandOptions,
): ExtrudeStrandResult {
  const { across, seed, along, side } = strandAttributes();

  // ---------------------------------------------
  // Project three points of the path
  // ---------------------------------------------
  // modelViewMatrix moves a point from the mesh's space to the camera's, and
  // cameraProjectionMatrix turns that into clip space. A vec4 with w = 1
  // marks the vec3 as a position, so the matrices' translation applies.
  const project = (at: TSLValue) =>
    cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(vec3(path(at, across, seed)), 1));

  // toVar() stores the center in a GPU variable. Two expressions below read
  // it, and without the variable each would project the path again.
  const center = project(along).toVar();
  const before = project(along.sub(TANGENT_STEP));
  const after = project(along.add(TANGENT_STEP));

  // ---------------------------------------------
  // From clip space to CSS pixels
  // ---------------------------------------------
  // screenSize is the size of what is being drawn into, in device pixels.
  // Dividing by the renderer's pixel ratio gives CSS pixels, so a strandWidth of
  // 4 looks the same on a 1x and a 2x display. The uniform reads the ratio
  // from the renderer before each draw. vec2() wraps screenSize because it
  // is a vec2 uniform (the vec-uniform gotcha in docs/agents/tsl.md).
  const pixelRatio = uniform(1).onRenderUpdate(({ renderer }) => renderer?.getPixelRatio() ?? 1);
  const canvasSize = vec2(screenSize).div(pixelRatio).toVar();

  // Dividing clip x and y by w gives a place from -1 to 1 across the canvas.
  // Half the canvas size scales that to pixels from the center. A point
  // behind the camera has a w at or below 0 and lands nowhere sensible. The
  // GPU clips those triangles away, so keep a path in front of the camera.
  const toPixels = (clip: TSLValue) => clip.xy.div(clip.w).mul(canvasSize).mul(0.5);

  // ---------------------------------------------
  // Which way is sideways
  // ---------------------------------------------
  // The strand runs from `before` to `after` on screen. Dividing that step
  // by its length gives the tangent, a vector one pixel long pointing along
  // the strand. max() keeps the divide away from 0 where the two points
  // project to the same pixel, and the vertex then stays on the center
  // line. Turning the tangent a quarter turn, (x, y) to (-y, x), gives the
  // normal: one pixel long, pointing straight across the strand.
  const travel = toPixels(after).sub(toPixels(before)).toVar();
  const tangent = travel.div(max(length(travel), 1e-6));
  const normal = vec2(tangent.y.negate(), tangent.x);

  // ---------------------------------------------
  // Push the vertex to its edge
  // ---------------------------------------------
  // `side` is -1 or 1, so the two vertices of a sample move opposite ways
  // by half the width. The floor matches strandProfile, which dims a strand
  // asked to be thinner than it can be drawn.
  const halfWidth = max(float(options.strandWidth).mul(0.5), MIN_STRAND_HALF_WIDTH);
  const edgeDistance = side.mul(halfWidth);

  // Back from pixels to clip space: the reverse of toPixels. Multiplying by
  // w cancels the divide the GPU does after the vertex stage, so the push is
  // the same number of pixels at any depth. z and w stay the center's, so
  // the strip sits at the path's own depth and other meshes can hide it.
  const push = normal.mul(edgeDistance).div(canvasSize).mul(2).mul(center.w);
  const position = vec4(center.xy.add(push), center.zw);

  // varying() works the value out per vertex and has the GPU blend it across
  // each triangle. It is -halfWidth on one edge and +halfWidth on the other,
  // so a pixel between them reads its own distance from the center line.
  const distance = varying(edgeDistance);

  return { position, distance };
}
