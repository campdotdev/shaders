// Draws CursorTrail's path into a heat texture, one soft stroke along the
// points path.ts packs. Drawn at half the canvas's resolution, and only
// when the path changes, so a resting trail costs nothing. Lives beside the
// component, as field.ts does in cursor-smudge/.
import {
  Break,
  clamp,
  dot,
  float,
  Fn,
  If,
  int,
  length,
  Loop,
  max,
  mix,
  oneMinus,
  smoothstep,
  uniform,
  uniformArray,
  uv,
  vec2,
  vec4,
} from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import {
  HalfFloatType,
  LinearFilter,
  type Node,
  RedFormat,
  type Texture,
  Vector4,
  type WebGPURenderer,
} from 'three/webgpu';

import { createTexturePass, type TSLNode } from '../../engine.js';
import { MAX_POINTS } from './path.js';

// three's Loop callback receives its iterator variables untyped; this names
// the one this loop declares.
interface LoopVars {
  index: ShaderNodeObject<Node>;
}

export interface TrailField {
  /**
   * Draw the packed path: x, y, width, and heat per point, `count` points.
   * Skips the draw when nothing changed since the last one. Call inside the
   * scene's pre-pass, the GPU work the scene runs just before it draws.
   * Returns whether it drew.
   */
  draw: (points: Float32Array, count: number) => boolean;
  /** Latest heat texture, or null when float targets are unavailable. */
  readonly texture: Texture | null;
  /** Match the canvas size. The next draw redraws the path at the new size. */
  resize: (width: number, height: number) => void;
  /** Release the target and its material. */
  dispose: () => void;
}

// A half-resolution field is interpolated when sampled at full size. A
// quarter showed its texels as a stair-stepped rim. The 1024-texel cap
// bounds memory and fill cost on large canvases.
const FIELD_SCALE = 0.5;
const MAX_FIELD_EDGE = 1024;

/**
 * The brush's heat at `distance` canvas heights from its center: 1 at the
 * center, easing to 0 at `radius`. The epsilon keeps smoothstep's edges
 * distinct at radius zero.
 */
function brushFalloff(distance: TSLNode, radius: TSLNode): ShaderNodeObject<Node> {
  return oneMinus(smoothstep(0, max(radius, 1e-5), distance));
}

/**
 * How far `point` lies from the segment from `start` to `end`. `along` is
 * where its nearest point on the segment sits, from 0 at `start` to 1 at
 * `end`, and `distance` is how far away that nearest point is. Measure all
 * three in canvas heights so the result is too. The denominator epsilon
 * keeps a zero-length segment from dividing by zero; it reads as `start`.
 */
function nearestOnSegment(
  point: ShaderNodeObject<Node>,
  start: ShaderNodeObject<Node>,
  end: ShaderNodeObject<Node>,
): { along: ShaderNodeObject<Node>; distance: ShaderNodeObject<Node> } {
  const segment = end.sub(start);
  const along = clamp(dot(point.sub(start), segment).div(max(dot(segment, segment), 1e-8)), 0, 1);

  return { along, distance: length(point.sub(start.add(segment.mul(along)))) };
}

export function createTrailField(
  renderer: WebGPURenderer,
  width: number,
  height: number,
): TrailField {
  const vectors = Array.from({ length: MAX_POINTS }, () => new Vector4());
  const points = uniformArray(vectors, 'vec4');
  const count = uniform(0);
  const aspect = uniform(width / height);

  // ---- The hottest segment at each texel
  // A texel is one pixel of the heat texture. Each takes the hottest of the
  // segments between neighboring points, so the shape is one stroke.
  // uv() starts at the bottom-left, as the packed points do. Stretch x by
  // width/height so both axes measure canvas heights and the brush stays
  // round on a wide canvas. Each segment's width and heat run linearly
  // between its two points, as the taper does along the path. The loop's
  // bound is fixed for the WebGL2 fallback; it stops at the last point.
  const node = Fn(() => {
    const stretch = vec2(aspect, 1).toVar();
    const texel = stretch.mul(uv()).toVar();
    const heat = float(0).toVar();

    Loop(
      { start: int(1), end: int(MAX_POINTS), name: 'index', condition: '<' },
      ({ index }: LoopVars) => {
        If(float(index).greaterThanEqual(count), () => {
          Break();
        });
        const start = points.element(index.sub(1));
        const end = points.element(index);
        const { along, distance } = nearestOnSegment(
          texel,
          stretch.mul(start.xy),
          stretch.mul(end.xy),
        );
        const brush = brushFalloff(distance, mix(start.z, end.z, along));

        heat.assign(max(heat, brush.mul(mix(start.w, end.w, along))));
      },
    );

    return vec4(heat, 0, 0, 1);
  })();
  const size = (nextWidth: number, nextHeight: number) => {
    const scale = Math.min(FIELD_SCALE, MAX_FIELD_EDGE / Math.max(nextWidth, nextHeight));

    return {
      width: Math.max(1, Math.round(nextWidth * scale)),
      height: Math.max(1, Math.round(nextHeight * scale)),
    };
  };
  const pass = createTexturePass(renderer, node, {
    ...size(width, height),
    type: HalfFloatType,
    filter: LinearFilter,
    format: RedFormat,
  });
  // What the last draw drew, to skip a draw that would change nothing.
  const drawn = new Float32Array(MAX_POINTS * 4);
  let drawnCount = -1;

  // ---- Draw, resize, and release the heat field
  return {
    draw(packed, nextCount) {
      if (!pass.texture) return false;
      const used = nextCount * 4;
      let same = nextCount === drawnCount;

      for (let at = 0; same && at < used; at += 1) same = packed[at] === drawn[at];
      if (same) return false;
      for (let at = 0; at < nextCount; at += 1) vectors[at]?.fromArray(packed, at * 4);
      drawn.set(packed.subarray(0, used));
      drawnCount = nextCount;
      count.value = nextCount;
      pass.render();

      return true;
    },
    get texture() {
      return pass.texture;
    },
    resize(nextWidth, nextHeight) {
      if (nextWidth <= 0 || nextHeight <= 0) return;
      const nextSize = size(nextWidth, nextHeight);

      pass.resize(nextSize.width, nextSize.height);
      aspect.value = nextWidth / nextHeight;
      drawnCount = -1;
    },
    dispose() {
      pass.dispose();
    },
  };
}
