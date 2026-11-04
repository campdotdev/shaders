// Stores how hot each point of the canvas is for CursorTrail. Two textures
// trade read and write roles, so each draw can cool the old heat and stamp
// the latest stroke without reading its own output. Heat runs 0..1 and
// cools at a fixed rate, so a faster pointer leaves a longer tail. Lives
// beside the component, as field.ts does in cursor-smudge/.
import {
  clamp,
  dot,
  length,
  max,
  oneMinus,
  smoothstep,
  texture,
  uniform,
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
  Texture,
  Vector2,
  type WebGPURenderer,
} from 'three/webgpu';

import { createTexturePass, type PushStroke, type TSLNode } from '../../engine.js';

export interface TrailStep {
  /** Seconds since the last draw. */
  delta: number;
  /** The stroke to stamp, in top-left canvas coordinates, or null. */
  stroke: PushStroke | null;
  /** Brush radius in canvas heights. Zero stamps nothing. */
  radius: number;
  /** Seconds for full heat to cool to zero. Zero or below keeps no trail. */
  decay: number;
  /** Clear the field and stamp nothing while disabled. */
  disabled: boolean;
}

export interface TrailField {
  /** Cool, stamp, and draw once. Call inside the scene's pre-pass. */
  step: (step: TrailStep) => void;
  /** Latest heat texture, or null when float targets are unavailable. */
  readonly texture: Texture | null;
  /** Whether every texel has cooled to zero. */
  readonly atRest: boolean;
  /** Match the canvas size, clearing the heat after a resize. */
  resize: (width: number, height: number) => void;
  /** Release both targets and their materials. */
  dispose: () => void;
}

// A half-resolution field is interpolated when sampled at full size. A
// quarter showed its texels as a stair-stepped rim. The 1024-texel cap
// bounds memory and fill cost on large canvases.
const FIELD_SCALE = 0.5;
const MAX_FIELD_EDGE = 1024;
// Below a thousandth of full heat, cool the rest away in one draw, so
// half-float rounding cannot leave a sliver the CPU counts as gone.
const SETTLE_THRESHOLD = 0.001;

/**
 * The brush's heat at `distance` canvas heights from its center: 1 at the
 * center, easing to 0 at `radius`. The field stamps strokes with it and the
 * shader draws the spot under a still pointer with it, so the two meet with
 * no seam. The epsilon keeps smoothstep's edges distinct at radius zero.
 */
export function brushFalloff(distance: TSLNode, radius: TSLNode): ShaderNodeObject<Node> {
  return oneMinus(smoothstep(0, max(radius, 1e-5), distance));
}

export function createTrailField(
  renderer: WebGPURenderer,
  width: number,
  height: number,
): TrailField {
  const placeholder = new Texture();
  const previous = texture(placeholder, uv());
  const fall = uniform(0);
  const keep = uniform(0);
  const stamp = uniform(0);
  const aspect = uniform(width / height);
  const strokeFrom = uniform(new Vector2());
  const strokeTo = uniform(new Vector2());
  const radius = uniform(0);

  // ---- A soft brush around the whole stroke
  // uv() starts at the bottom-left. Stretch x by width/height so both axes
  // measure canvas heights and the brush stays round on a wide canvas.
  const stretch = vec2(aspect, 1);
  const point = stretch.mul(uv());
  const start = stretch.mul(strokeFrom);
  const segment = stretch.mul(strokeTo).sub(start);
  // Project the point onto the stroke, then clamp to its endpoints. The
  // denominator epsilon keeps a zero-length stroke from dividing by zero.
  const along = clamp(dot(point.sub(start), segment).div(max(dot(segment, segment), 1e-8)), 0, 1);
  const distance = length(point.sub(start.add(segment.mul(along))));
  const brush = brushFalloff(distance, radius);

  // ---- Cool, then stamp, in one draw
  // Subtracting a fixed amount per second cools every texel at the same
  // rate, so heat 1 reaches 0 in exactly `decay` seconds. The stamp takes
  // the larger of the old heat and the brush rather than their sum, so a
  // second pass over the same spot is no hotter than the first.
  //
  // The pointer crossed the stroke over the whole frame, so its start is a
  // frame older than its end. Cooling each point by its share of the frame,
  // a full `fall` at the start and none at the end, carries the heat on
  // smoothly from the last frame's stroke. Without it, every frame's stroke
  // takes one heat and the trail breaks into blotches, worst on fast moves.
  // The outer max() floors the heat at 0, which the subtraction can cross.
  //
  // `keep` is 0 on a draw that clears the old heat. Clearing goes through
  // its own switch, not a larger `fall`, because `fall` also ages the new
  // stroke: a clear by `fall` would erase the stroke it stamps.
  const cooled = previous.r.mul(keep).sub(fall);
  const stamped = brush.mul(stamp).sub(oneMinus(along).mul(fall));
  const node = vec4(max(max(cooled, stamped), 0), 0, 0, 1);
  const size = (nextWidth: number, nextHeight: number) => {
    const scale = Math.min(FIELD_SCALE, MAX_FIELD_EDGE / Math.max(nextWidth, nextHeight));

    return {
      width: Math.max(1, Math.round(nextWidth * scale)),
      height: Math.max(1, Math.round(nextHeight * scale)),
    };
  };
  const options = {
    ...size(width, height),
    type: HalfFloatType,
    filter: LinearFilter,
    format: RedFormat,
  };
  let read = createTexturePass(renderer, node, options);
  let write = createTexturePass(renderer, node, options);
  // The hottest any texel can be. Only cooling lowers it and only a stamp
  // raises it, so the CPU knows when the field is cold with no GPU readback.
  let bound = 0;
  let needsClear = true;

  const hasTargets = () => read.texture !== null && write.texture !== null;

  // ---- Advance, resize, and release the heat field
  return {
    step({ delta, stroke, radius: nextRadius, decay, disabled }) {
      if (!hasTargets()) return;
      const accepted = disabled || nextRadius <= 0 ? null : stroke;
      const strength = accepted ? Math.max(0, Math.min(1, accepted.presence)) : 0;

      // A cold field with nothing to stamp needs no draw.
      if (!needsClear && bound === 0 && strength === 0) return;
      const cooling = decay > 0 ? Math.max(0, delta) / decay : 1;
      const remaining = needsClear || disabled ? 0 : bound - cooling;
      const clearing = remaining <= SETTLE_THRESHOLD;

      fall.value = cooling;
      keep.value = clearing ? 0 : 1;
      stamp.value = strength;
      radius.value = nextRadius;
      bound = Math.max(clearing ? 0 : remaining, strength);
      if (accepted) {
        strokeFrom.value.set(accepted.from[0], 1 - accepted.from[1]);
        strokeTo.value.set(accepted.to[0], 1 - accepted.to[1]);
      }
      const source = read.texture;

      if (!source) return;
      previous.value = source;
      write.render();
      [read, write] = [write, read];
      needsClear = false;
    },
    get texture() {
      return hasTargets() ? read.texture : null;
    },
    get atRest() {
      return !hasTargets() || bound === 0;
    },
    resize(nextWidth, nextHeight) {
      if (nextWidth <= 0 || nextHeight <= 0) return;
      const nextSize = size(nextWidth, nextHeight);

      read.resize(nextSize.width, nextSize.height);
      write.resize(nextSize.width, nextSize.height);
      aspect.value = nextWidth / nextHeight;
      bound = 0;
      needsClear = true;
    },
    dispose() {
      read.dispose();
      write.dispose();
      placeholder.dispose();
    },
  };
}
