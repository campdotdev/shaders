// A water surface simulated on the GPU as a height field that persists
// between frames. CursorRipple drives it from the scene's scheduler and reads
// its texture to refract and light the image beneath; a later Blobs physics
// may reuse it. It is written against three's renderer alone, with no React,
// and sits next to the output stage for the same reason that module does:
// ShaderScene stays readable and this part has its own test. ADR 0003 says
// why it is a fragment pass rather than a compute shader.
import {
  ClampToEdgeWrapping,
  HalfFloatType,
  LinearFilter,
  RenderTarget,
  RGBAFormat,
  type Texture,
  Vector2,
} from 'three';
import {
  clamp,
  dot,
  float,
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
import type { WebGPURenderer } from 'three/webgpu';
import { NodeMaterial, QuadMesh } from 'three/webgpu';

import { getReducedMotionTimeScale } from '../reduced-motion/reduced-motion.js';

/**
 * A stroke the pointer made this frame: the segment from where it was on
 * the previous frame to where it is now, in 0..1 canvas coordinates with
 * [0, 0] at the top-left, plus the presence value that gates it.
 */
export interface WaveFieldStroke {
  /** Where the pointer was on the previous frame. */
  from: readonly [number, number];
  /** Where the pointer is now. */
  to: readonly [number, number];
  /** How present the pointer is, 0 (gone) to 1 (over the canvas). */
  presence: number;
}

export interface WaveField {
  /**
   * Advance the water by one rendered frame of `delta` seconds, pushing the
   * stroke into it first when one is given.
   */
  step: (delta: number, stroke?: WaveFieldStroke) => void;
  /**
   * The most recently written height field, with height in R and velocity
   * in G, in uv space (bottom-left origin, so `texture(field.texture)`
   * sampled at `uv()` lines up with the canvas). Null while the module is
   * inert. Read it every frame: the two targets swap on every pass.
   */
  readonly texture: Texture | null;
  /** True while the field holds no energy, so a caller can let the scene idle. */
  readonly atRest: boolean;
  /** Match a new canvas size. Recreates both targets and loses the field. */
  resize: (width: number, height: number) => void;
  /** Release both targets. The renderer stays the caller's to dispose. */
  dispose: () => void;
}

// ----------------------------------------------------------------------------
// Resolution
// ----------------------------------------------------------------------------

/**
 * Field texels per canvas pixel along each edge. A quarter is plenty for a
 * ripple that is read through linear filtering, and it cuts the per-pass
 * cost to a sixteenth of full resolution. Raising it sharpens small rings
 * and costs proportionally more fill.
 */
const FIELD_SCALE = 0.25;

/**
 * Cap on the field's long edge, in texels. Keeps a wide banner from
 * quadrupling the pass cost. Lowering it softens the ripple on large
 * canvases.
 */
const MAX_FIELD_EDGE = 512;

function fieldSize(width: number, height: number): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  const scale = Math.min(FIELD_SCALE, MAX_FIELD_EDGE / longEdge);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// ----------------------------------------------------------------------------
// Time
// ----------------------------------------------------------------------------

/**
 * Length of one simulation step, in seconds. The wave equation below moves
 * a wave a fixed fraction of a texel per substep, so a fixed substep makes
 * wave speed the same at 30Hz and 144Hz: a frame runs as many of these as
 * its delta holds. Shortening it runs more substeps a second, which speeds
 * the visible wave up for the same stiffness and costs more passes per
 * frame.
 */
const SUBSTEP_SECONDS = 1 / 120;

/**
 * The most substeps one frame may run. A tab that comes back after seconds
 * away would otherwise try to catch up in one frame and stall it. Excess
 * time is dropped, not banked, so the field skips rather than bursts.
 */
const MAX_SUBSTEPS_PER_FRAME = 4;

/**
 * How much velocity survives each substep, 0..1. Height now carries most of
 * the damping so a uniform offset can decay; keeping velocity near 1 leaves
 * the travelling ring's combined decay close to the original update. Lower
 * values stop the ring sooner.
 */
const VELOCITY_DAMPING = 0.999;

/**
 * How much height survives each substep, 0..1. This removes the permanent
 * mean offset that a one-sided stroke would otherwise leave behind. 0.985
 * takes a flat offset below one 8-bit step in about 370 substeps. Closer to
 * 1 takes longer to return to level; lower flattens the field sooner.
 */
const HEIGHT_DAMPING = 0.985;

/**
 * The amplitude, as a fraction of the injected height, below which the
 * field counts as flat. 1/256 is one 8-bit step, so what is left could not
 * show in the output.
 */
const SETTLE_AMPLITUDE = 1 / 256;

// ----------------------------------------------------------------------------
// Strokes
// ----------------------------------------------------------------------------

/**
 * How hard a stroke pushes the water, from how fast the pointer moved: the
 * segment's length in canvas-height units over the frame's `delta`, times
 * the presence gate. Scaling x by the width-to-height aspect makes equal
 * pixel distances equal in every direction. A still or absent pointer gives
 * 0, which the step treats as no stroke at all.
 */
export function strokeStrength(
  from: readonly [number, number],
  to: readonly [number, number],
  delta: number,
  presence: number,
  aspect: number,
): number {
  if (delta <= 0 || presence <= 0) return 0;
  const horizontal = (to[0] - from[0]) * aspect;
  const vertical = to[1] - from[1];
  const speed = Math.hypot(horizontal, vertical) / delta;

  return speed * presence;
}

/**
 * Height pushed per canvas height of pointer travel. At 60Hz, a brisk drag
 * at 10 canvas heights per second travels one sixth of the height and dents
 * the surface by 0.2. Higher makes every drag a bigger wave.
 */
const INJECTION_PER_CANVAS_HEIGHT = 1.2;

/**
 * The deepest dent one stroke may make, in height units. A flick across the
 * whole canvas in one frame would otherwise push a wall of water that takes
 * seconds to die down.
 */
const MAX_INJECTION = 1;

/**
 * Turns speed into this frame's height push. Multiplying by elapsed time
 * integrates the rate over the frame, so splitting one path across more
 * frames does not make the path stronger.
 */
export function strokePushForFrame(strength: number, delta: number): number {
  if (strength <= 0 || delta <= 0) return 0;

  return Math.min(strength * delta * INJECTION_PER_CANVAS_HEIGHT, MAX_INJECTION);
}

/**
 * Half-width of the stroke's stamp, in canvas heights (1 is the full
 * height). The stamp is a soft brush along the pointer's segment, so a fast
 * sweep lays down a continuous wake rather than a row of dots. Wider makes
 * broader, gentler rings.
 */
const STROKE_RADIUS = 0.03;

// ----------------------------------------------------------------------------
// The wave equation
// ----------------------------------------------------------------------------

/**
 * How much of the Laplacian below is added to a texel's velocity each
 * substep, which sets the wave speed: a ring travels about the square root
 * of this in texels per substep, 0.63 here, about 76 texels a second. The
 * update is only stable up to 0.5. Above that a wave crosses more than a
 * texel per substep and the field blows up.
 */
const WAVE_STIFFNESS = 0.4;

// ----------------------------------------------------------------------------
// Capability checks
// ----------------------------------------------------------------------------

/**
 * Whether the renderer can draw into a half-float target. WebGPU renders
 * rgba16float in core. The WebGL2 fallback needs EXT_color_buffer_float,
 * which three's hasFeature() table does not list, so this reads the
 * backend's extension registry the way create-renderer reads its
 * isWebGLBackend flag: both are internal fields, probed with `in` guards.
 */
function supportsHalfFloatTargets(renderer: WebGPURenderer): boolean {
  const backend: unknown = renderer.backend;

  if (typeof backend !== 'object' || backend === null) return false;
  if (!('isWebGLBackend' in backend) || backend.isWebGLBackend !== true) return true;
  if (!('extensions' in backend)) return false;
  const extensions: unknown = backend.extensions;

  if (typeof extensions !== 'object' || extensions === null || !('has' in extensions)) return false;
  const has: unknown = extensions.has;

  return typeof has === 'function' && has.call(extensions, 'EXT_color_buffer_float') === true;
}

/**
 * Whether three's renderer has recorded a lost device. It keeps that on a
 * private `_isDeviceLost` field and turns every later draw into a silent
 * no-op rather than a throw, so the flag is the only early signal. Re-check
 * the field name at any three bump.
 */
function isDeviceLost(renderer: WebGPURenderer): boolean {
  const candidate: unknown = renderer;

  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    '_isDeviceLost' in candidate &&
    candidate._isDeviceLost === true
  );
}

// ----------------------------------------------------------------------------
// The passes
// ----------------------------------------------------------------------------

function createTarget(width: number, height: number): RenderTarget {
  return new RenderTarget(width, height, {
    // Half float: height and velocity need sign and fractions, which an 8-bit
    // target cannot hold. Two channels are used; RGBA is the format every
    // backend can render to.
    type: HalfFloatType,
    format: RGBAFormat,
    // Linear filtering lets the consumer sample between texels smoothly.
    // Clamping keeps a pass's neighbour reads at the edge on the edge
    // texel, so the outside looks like a copy of the border: a wave meets
    // it and reflects, the way water meets the side of a basin.
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
}

/**
 * The live inputs of the passes. Every one is a uniform, a value the CPU
 * writes and the GPU reads at each draw, so a pass changes them and redraws
 * without ever rebuilding a material.
 */
interface FieldUniforms {
  /** The target a pass reads. Swapped to the other target every pass. */
  previous: ReturnType<typeof texture>;
  /** One texel, in uv units, so the step can find its neighbours. */
  texelWidth: ReturnType<typeof uniform<number>>;
  texelHeight: ReturnType<typeof uniform<number>>;
  /** Field width over height, so the stroke's stamp stays round on screen. */
  aspect: ReturnType<typeof uniform<number>>;
  /** The stroke segment in uv space. */
  strokeFrom: ReturnType<typeof uniform<Vector2>>;
  strokeTo: ReturnType<typeof uniform<Vector2>>;
  /** Height the stroke pushes, already scaled and capped. */
  strokePush: ReturnType<typeof uniform<number>>;
}

/**
 * Builds the fragment that turns the previous field into the next one, one
 * substep later. It runs once per texel of the field. Reading the previous
 * target while writing the other is the ping-pong: a pass can never read
 * the texture it is drawing into, so the state lives in two targets that
 * trade roles.
 */
function buildStepNode({ previous, texelWidth, texelHeight }: FieldUniforms) {
  // The quad's uv() is this texel's 0..1 position in the field.
  const here = uv();

  // The texel's own state: height in R, velocity in G.
  const state = previous.uv(here);
  const height = state.r;
  const velocity = state.g;

  // The Laplacian: the four neighbours summed, less four times this texel,
  // which is four times how far the texel sits below their average.
  // Positive where the texel is in a dip, negative on a crest, zero on a
  // flat or a straight slope. It is the "curvature" that a stretched
  // surface pulls flat, and the whole wave comes from it. A step of one
  // texel each way finds the neighbours.
  const left = previous.uv(here.sub(vec2(texelWidth, 0))).r;
  const right = previous.uv(here.add(vec2(texelWidth, 0))).r;
  const below = previous.uv(here.sub(vec2(0, texelHeight))).r;
  const above = previous.uv(here.add(vec2(0, texelHeight))).r;
  const laplacian = left.add(right).add(below).add(above).sub(height.mul(4));

  // The wave equation, in two integrations. Velocity gains the curvature
  // times the stiffness (a dip accelerates up, a crest down), then keeps most
  // of its value so the ring travels. Height moves by that new velocity and
  // then loses a small fraction. That height loss makes even a perfectly
  // flat offset return to zero; its Laplacian would otherwise stay zero and
  // leave the offset forever. The two retention factors together keep the
  // travelling wave's decay close to the original velocity-only damping.
  const nextVelocity = velocity.add(laplacian.mul(WAVE_STIFFNESS)).mul(VELOCITY_DAMPING);
  const nextHeight = height.add(nextVelocity).mul(HEIGHT_DAMPING);

  return vec4(nextHeight, nextVelocity, float(0), float(1));
}

/**
 * Builds the fragment that presses a stroke into the field without moving
 * time: the previous state copied through, with the surface pushed down
 * along the pointer's segment. It is its own pass rather than part of the
 * step so a stroke lands once per frame whatever the frame rate, and a
 * frame too short for a substep still leaves its segment in the water.
 */
function buildStampNode({ previous, aspect, strokeFrom, strokeTo, strokePush }: FieldUniforms) {
  const here = uv();
  const state = previous.uv(here);

  // How close this texel is to the segment the pointer swept, in a space
  // where x is scaled by the aspect so distances mean the same along both
  // axes and the brush is round on screen. The vec2 uniforms are consumed
  // as arguments of mul, never as chained receivers (the vec-uniform gotcha
  // in AGENTS.md).
  const stretch = vec2(aspect, 1);
  const point = stretch.mul(here);
  const start = stretch.mul(strokeFrom);
  const end = stretch.mul(strokeTo);

  // Closest point on the segment: project the texel onto the segment's
  // direction and clamp to its ends. The max() keeps a zero-length segment
  // from dividing by zero, which turns a tap into a dot rather than NaN.
  const segment = end.sub(start);
  const toPoint = point.sub(start);
  const along = clamp(dot(toPoint, segment).div(max(dot(segment, segment), 1e-6)), 0, 1);
  const closest = start.add(segment.mul(along));
  const distance = length(point.sub(closest));

  // A soft brush: full push at the segment, fading to nothing at the radius.
  // smoothstep needs its edges in rising order, so oneMinus() flips it.
  const brush = oneMinus(smoothstep(0, STROKE_RADIUS, distance));

  // The push presses the surface down. The step's crest then rebounds
  // through the neighbours, which is the ring.
  return vec4(state.r.sub(brush.mul(strokePush)), state.g, float(0), float(1));
}

// ----------------------------------------------------------------------------
// Building the field
// ----------------------------------------------------------------------------

// What a renderer that cannot draw to a half-float target gets: a field with
// nothing behind it. The consumer sees a null texture and renders as
// identity (ADR 0003).
const inertField: WaveField = {
  step: () => {
    // No target to draw into.
  },
  texture: null,
  atRest: true,
  resize: () => {
    // No targets to recreate.
  },
  dispose: () => {
    // Nothing was allocated.
  },
};

export function createWaveField(
  renderer: WebGPURenderer,
  width: number,
  height: number,
): WaveField {
  if (!supportsHalfFloatTargets(renderer) || isDeviceLost(renderer)) return inertField;

  const size = fieldSize(width, height);
  // Two targets: a pass reads `read` and writes `write`, then the two swap.
  // A pass cannot read the texture it is writing, so a feedback loop always
  // needs the pair. Both go null once the field is dropped.
  let read: RenderTarget | null = createTarget(size.width, size.height);
  let write: RenderTarget | null = createTarget(size.width, size.height);

  // The passes' live inputs. Vector2 uniforms are held as stable objects
  // and written with set(), the pattern from the AGENTS.md uniform gotchas.
  // One set serves both materials, so a write reaches whichever draws next.
  const uniforms: FieldUniforms = {
    previous: texture(read.texture),
    texelWidth: uniform(1 / size.width),
    texelHeight: uniform(1 / size.height),
    aspect: uniform(size.width / size.height),
    strokeFrom: uniform(new Vector2()),
    strokeTo: uniform(new Vector2()),
    strokePush: uniform(0),
  };

  const stepMaterial = new NodeMaterial();

  stepMaterial.name = 'WaveField step';
  stepMaterial.fragmentNode = buildStepNode(uniforms);

  const stampMaterial = new NodeMaterial();

  stampMaterial.name = 'WaveField stamp';
  stampMaterial.fragmentNode = buildStampNode(uniforms);

  // The clear pass draws zero height and zero velocity. Drawing a flat quad
  // rather than calling the renderer's clear keeps the renderer's clear
  // color out of it, which the scene owns.
  const clearMaterial = new NodeMaterial();

  clearMaterial.name = 'WaveField clear';
  clearMaterial.fragmentNode = vec4(0);

  // One quad draws every pass; the material picks which.
  const quad = new QuadMesh(stepMaterial);

  // Frame time not yet spent on a substep. Frames shorter than a substep
  // bank their time here so two half-substep frames still make one step.
  let carry = 0;
  // A CPU-side model of the wave activity, because reading energy back from
  // the GPU would stall the frame. Strokes add their capped push and each
  // fixed substep applies the same height damping as the simulation. A fresh
  // stroke starts at one maximum push, which preserves the measured
  // single-stroke settle window of about three seconds.
  let settleActivity = 0;

  // Release both targets and forget the simulation state. Nothing recreates the
  // targets but resize, so from every other caller this is the field going
  // inert for good: `texture` reads null and each later call is a no-op.
  // The consumer renders as identity from there; it owns the one
  // development-only log, not this module.
  const dropField = () => {
    read?.dispose();
    write?.dispose();
    read = null;
    write = null;
    settleActivity = 0;
    carry = 0;
  };

  // Whether the field still has targets. A lost device is noticed here, on
  // whichever call comes first, so `texture` goes null without waiting for
  // a step: three only flags the loss and turns later draws into no-ops.
  const alive = () => {
    if (read !== null && isDeviceLost(renderer)) dropField();

    return read !== null && write !== null;
  };

  // Draw one pass into `write`, then swap so the result is what the next
  // pass (and the consumer) reads. The caller binds and restores the
  // renderer's target around the whole frame's run.
  const drawPass = (material: NodeMaterial) => {
    if (!read || !write) return;
    uniforms.previous.value = read.texture;
    quad.material = material;
    renderer.setRenderTarget(write);
    quad.render(renderer);
    [read, write] = [write, read];
  };

  // Run a frame's passes with the renderer's bound target restored after,
  // in a finally block so a draw that throws (a lost device) cannot leave
  // the scene rendering into the field's target. The throw itself is
  // swallowed and the field dropped, so a scheduler client stepping it
  // never breaks the scene's frame loop.
  const runPasses = (stamp: boolean, substeps: number) => {
    const previousTarget = renderer.getRenderTarget();

    try {
      if (stamp) drawPass(stampMaterial);
      for (let index = 0; index < substeps; index += 1) {
        drawPass(stepMaterial);
        settleActivity *= HEIGHT_DAMPING;
      }
      // Zero both targets once the model falls below one 8-bit step. A stale
      // texel would still seed the next stroke's ring, and a fresh field has
      // to start flat. Two clear draws with the swap between them cover both.
      if (settleActivity <= SETTLE_AMPLITUDE) {
        drawPass(clearMaterial);
        drawPass(clearMaterial);
        settleActivity = 0;
        carry = 0;
      }
    } catch {
      dropField();
    } finally {
      renderer.setRenderTarget(previousTarget);
    }
  };

  return {
    step(delta, stroke) {
      if (!alive()) return;
      // The shared reduced-motion factor scales the simulated time, so the
      // "slow" policy makes the wave crawl and "paused" freezes the field:
      // no substeps, and the stroke below never lands either.
      const scaledDelta = delta * getReducedMotionTimeScale().value;

      if (scaledDelta <= 0) return;

      // Speed reads the raw delta and the live field aspect: the pointer moved
      // that far in real time and physical distance, not reduced-motion time.
      const strength = stroke
        ? strokeStrength(stroke.from, stroke.to, delta, stroke.presence, uniforms.aspect.value)
        : 0;
      const stamp = strength > 0 && stroke !== undefined;

      if (stamp) {
        // Pointer coordinates have their origin at the top-left; the field
        // is in uv space with its origin at the bottom-left, so y flips.
        uniforms.strokeFrom.value.set(stroke.from[0], 1 - stroke.from[1]);
        uniforms.strokeTo.value.set(stroke.to[0], 1 - stroke.to[1]);
        const push = strokePushForFrame(strength, delta);

        uniforms.strokePush.value = push;
        settleActivity = Math.max(MAX_INJECTION, settleActivity + push);
      }
      if (settleActivity <= SETTLE_AMPLITUDE) {
        carry = 0;

        return;
      }

      carry = Math.min(carry + scaledDelta, MAX_SUBSTEPS_PER_FRAME * SUBSTEP_SECONDS);
      const substeps = Math.floor(carry / SUBSTEP_SECONDS);

      carry -= substeps * SUBSTEP_SECONDS;

      if (stamp || substeps > 0) runPasses(stamp, substeps);
    },

    get texture() {
      alive();

      return read?.texture ?? null;
    },

    get atRest() {
      return settleActivity <= SETTLE_AMPLITUDE;
    },

    // A fresh target is zero-filled, so a resize is also a reset: the field
    // is not resampled across sizes (out of scope in SHA-138).
    resize(nextWidth, nextHeight) {
      if (!alive()) return;
      const next = fieldSize(nextWidth, nextHeight);

      dropField();
      read = createTarget(next.width, next.height);
      write = createTarget(next.width, next.height);
      uniforms.texelWidth.value = 1 / next.width;
      uniforms.texelHeight.value = 1 / next.height;
      uniforms.aspect.value = next.width / next.height;
    },

    dispose() {
      dropField();
      stepMaterial.dispose();
      stampMaterial.dispose();
      clearMaterial.dispose();
    },
  };
}
