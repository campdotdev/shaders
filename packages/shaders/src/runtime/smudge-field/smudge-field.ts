// Stores a directional displacement between frames for CursorSmudge. Two
// textures trade read and write roles, so each pass can shrink the old
// displacement and add the latest stroke without reading its own output.
// This fragment pass works on both WebGPU and the WebGL2 fallback.
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
import { HalfFloatType, LinearFilter, Texture, Vector2, type WebGPURenderer } from 'three/webgpu';

import type { PushStroke } from '../../inputs/scroll-push/scroll-push.js';
import { createTexturePass } from '../texture-pass/texture-pass.js';

export interface SmudgeStep {
  /** Seconds of simulation time since the last frame. */
  delta: number;
  /** Seconds of real pointer movement, before reduced-motion scaling. */
  inputDelta: number;
  /** The accepted stroke in top-left canvas coordinates, or null. */
  stroke: PushStroke | null;
  /** Brush radius in canvas heights. Zero accepts no new displacement. */
  radius: number;
  /** Recovery speed, 0..1. Zero holds displacement; higher values settle sooner. */
  decay: number;
  /** Clear the field and accept no stroke while disabled. */
  disabled: boolean;
}

export interface SmudgeField {
  /** Advance and draw once. Call inside the scene's timed pre-pass. */
  step: (step: SmudgeStep) => void;
  /** Latest displacement texture, or null when float targets are unavailable. */
  readonly texture: Texture | null;
  /** Whether every stored displacement has settled to zero. */
  readonly atRest: boolean;
  /** Match the canvas size, clearing displacement after a resize. */
  resize: (width: number, height: number) => void;
  /** Release both targets and their materials. */
  dispose: () => void;
}

// A quarter-resolution field is interpolated when sampled at full size.
// The 512-texel cap bounds memory and fill cost on large canvases.
const FIELD_SCALE = 0.25;
const MAX_FIELD_EDGE = 512;
// Displacement per canvas height travelled. Higher gain pulls harder.
const SWIPE_GAIN = 8;
// Canvas heights per second. Faster movement adds no extra force beyond this.
const SPEED_CAP = 3;
// Seconds to remove 90% of a pull, as positive decay approaches 0 and at 1.
// Exactly zero disables recovery. The 20x range for positive values keeps
// useful slow recovery across the dial instead of crowding it against zero.
const SLOW_RECOVERY_SECONDS = 4;
const FAST_RECOVERY_SECONDS = 0.2;
// Below one thousandth of the maximum pull, clear to exact zero and park.
const SETTLE_THRESHOLD = 0.001;

// Keep all displacement at zero decay. Otherwise, keep 10% after the
// chosen recovery time, independent of frame rate and parking threshold.
function recoveryRetention(decay: number, delta: number): number {
  if (decay <= 0) return 1;
  const recoverySeconds =
    SLOW_RECOVERY_SECONDS *
    Math.pow(FAST_RECOVERY_SECONDS / SLOW_RECOVERY_SECONDS, Math.min(1, decay));

  return Math.pow(0.1, Math.max(0, delta) / recoverySeconds);
}

export function createSmudgeField(
  renderer: WebGPURenderer,
  width: number,
  height: number,
): SmudgeField {
  const placeholder = new Texture();
  const previous = texture(placeholder, uv());
  const retention = uniform(0);
  const aspect = uniform(width / height);
  const strokeFrom = uniform(new Vector2());
  const strokeTo = uniform(new Vector2());
  const impulse = uniform(new Vector2());
  const radius = uniform(0.18);

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
  // smoothstep eases from 0 at the stroke to 1 at the radius. Flip it so
  // the stroke receives full displacement and the edge receives none.
  // The radius epsilon keeps smoothstep's edges distinct at radius zero.
  const brush = oneMinus(smoothstep(0, max(radius, 1e-5), distance));

  // ---- Recovery and injection in one draw
  // Multiplying by a positive fraction only shrinks displacement; there is
  // no velocity or spring force to overshoot. Cap the vector's length at 1
  // so repeated fast strokes cannot exceed the component's strength.
  const next = previous.rg.mul(retention).add(vec2(impulse).mul(brush));
  const capped = next.div(max(1, length(next)));
  const node = vec4(capped, 0, 1);
  const size = (nextWidth: number, nextHeight: number) => {
    const scale = Math.min(FIELD_SCALE, MAX_FIELD_EDGE / Math.max(nextWidth, nextHeight));

    return {
      width: Math.max(1, Math.round(nextWidth * scale)),
      height: Math.max(1, Math.round(nextHeight * scale)),
    };
  };
  const options = { ...size(width, height), type: HalfFloatType, filter: LinearFilter };
  let read = createTexturePass(renderer, node, options);
  let write = createTexturePass(renderer, node, options);
  let bound = 0;
  let needsClear = true;

  const hasTargets = () => read.texture !== null && write.texture !== null;

  // ---- Turn pointer travel into a capped directional impulse
  const updateImpulse = (stroke: PushStroke | null, inputDelta: number) => {
    impulse.value.set(0, 0);
    if (!stroke || inputDelta <= 0) return 0;
    const dx = (stroke.to[0] - stroke.from[0]) * aspect.value;
    const dy = stroke.from[1] - stroke.to[1];
    const travel = Math.hypot(dx, dy);

    if (travel === 0) return 0;
    const speed = Math.min(travel / inputDelta, SPEED_CAP);
    const push = speed * inputDelta * SWIPE_GAIN * Math.max(0, Math.min(1, stroke.presence));

    impulse.value.set((dx / travel) * push, (dy / travel) * push);
    strokeFrom.value.set(stroke.from[0], 1 - stroke.from[1]);
    strokeTo.value.set(stroke.to[0], 1 - stroke.to[1]);

    return push;
  };

  // ---- Advance, resize, and release the displacement field
  return {
    step(step) {
      if (!hasTargets()) return;
      const keep = recoveryRetention(step.decay, step.delta);
      const stroke = step.disabled || step.radius <= 0 ? null : step.stroke;
      const push = updateImpulse(stroke, step.inputDelta);

      // A held field needs no simulation draw, even when another Source
      // keeps the scene animating. Keep its texture for the next stroke.
      if (!needsClear && push === 0 && (bound === 0 || (!step.disabled && step.decay <= 0))) return;
      // This scalar is an upper bound on every texel's length, so deciding
      // when to park needs no synchronous GPU readback.
      bound = Math.min(1, (needsClear ? 0 : bound * keep) + push);
      const clear = step.disabled || (step.decay > 0 && push === 0 && bound <= SETTLE_THRESHOLD);

      retention.value = needsClear || clear ? 0 : keep;
      radius.value = step.radius;
      if (clear) {
        impulse.value.set(0, 0);
        bound = 0;
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
