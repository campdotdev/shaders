// A water surface simulated on the GPU as a height field that persists
// between frames. CursorRipple drives it from the scene's scheduler and reads
// its texture to refract and light the image beneath; a later Blobs physics
// may reuse it. It is written against three's renderer alone, with no React,
// and sits next to the output stage for the same reason that module does:
// ShaderScene stays readable and this part has its own test. ADR 0003 says
// why it is a fragment pass rather than a compute shader.
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
import {
  ClampToEdgeWrapping,
  HalfFloatType,
  LinearFilter,
  NodeMaterial,
  QuadMesh,
  RenderTarget,
  RGBAFormat,
  type Texture,
  Vector2,
  type WebGPURenderer,
} from 'three/webgpu';

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

/**
 * The water's live parameters: the ones a consumer may change while the
 * field runs. CursorRipple's `radius` drives the brush and its `decay`
 * drives both dampings. Each starts at the named constant next to its
 * definition below.
 */
export interface WaveFieldTuning {
  /** Half-width of the brush, in canvas heights. See STROKE_RADIUS. */
  strokeRadius: number;
  /** Height kept per substep, 0..1. See HEIGHT_DAMPING and dampingForLifetime. */
  heightDamping: number;
  /**
   * Velocity kept per substep, 0..1. See VELOCITY_DAMPING. Damp it along
   * with height to make calm water settle as fast as it looks: height damped
   * alone leaves a slow velocity mode that keeps the scene awake.
   */
  velocityDamping: number;
}

export interface WaveField {
  /**
   * Advance the water by one rendered frame of `delta` seconds, pushing the
   * stroke into it first when one is given.
   */
  step: (delta: number, stroke?: WaveFieldStroke) => void;
  /**
   * Change any live parameter. All are uniform-backed, so a change reaches
   * the next pass with no rebuild and no reset.
   */
  tune: (next: Partial<WaveFieldTuning>) => void;
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
  /** Observe a target replacement before the next scene draw. */
  onResize: (listener: () => void) => () => void;
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
 * The height-damping fraction that gives a dent a lifetime of `seconds`,
 * the time it takes to shrink to 1/e (about 37%) of its size on a flat field.
 * The fraction is applied once per substep, so this is the substep as a
 * share of the lifetime, exponentiated. Consumers that expose a calmness
 * dial in seconds go through here so they never need to know the substep.
 */
export function dampingForLifetime(seconds: number): number {
  return Math.exp(-SUBSTEP_SECONDS / Math.max(seconds, SUBSTEP_SECONDS));
}

/**
 * The height amplitude below which the field counts as flat. 1/256 is one
 * 8-bit step, so what is left could not show in the output.
 */
const SETTLE_AMPLITUDE = 1 / 256;

/**
 * How much the slowest wave mode survives one substep on a clamped field.
 * Clamping copies each edge texel beyond the edge, so the lowest nonuniform
 * Laplacian mode has eigenvalue -4 sin^2(pi / 2N), where N is the longer
 * edge. Applying the height/velocity update to that mode gives this 2x2
 * system's larger eigenvalue. It approaches 1 as the field gets wider, so
 * using the actual target size keeps the settle model conservative without
 * making small fields wait for the 512-texel cap.
 */
export function slowestModeDamping(
  longEdge: number,
  heightDamping = HEIGHT_DAMPING,
  velocityDamping = VELOCITY_DAMPING,
): number {
  if (longEdge <= 1) return heightDamping;

  const laplacian = -4 * Math.sin(Math.PI / (2 * longEdge)) ** 2;
  const velocityFromHeight = velocityDamping * WAVE_STIFFNESS * laplacian;
  const heightFromHeight = heightDamping * (1 + velocityFromHeight);
  const trace = heightFromHeight + velocityDamping;
  const determinant = heightDamping * velocityDamping;
  const discriminant = trace ** 2 - 4 * determinant;

  if (discriminant <= 0) return Math.sqrt(determinant);

  const root = Math.sqrt(discriminant);
  const first = (trace + root) / 2;
  const second = (trace - root) / 2;

  return Math.max(heightDamping, Math.abs(first), Math.abs(second));
}

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
 * Half-width of the stroke's stamp, in canvas heights (1 is the full
 * height). The stamp is a soft brush along the pointer's segment, so a fast
 * sweep lays down a continuous wake rather than a row of dots. Wider makes
 * broader, gentler rings.
 */
const STROKE_RADIUS = 0.03;

/**
 * Turns speed into this frame's height push. Short segments integrate their
 * travel directly. Once a segment is longer than the brush kernel's effective
 * width, every interior texel should receive only that width's contribution;
 * otherwise a low-refresh frame pushes the same swept texel harder than a
 * high-refresh frame. Presence scales both the travel and that limit. The
 * brush width is the field's live `strokeRadius`.
 */
export function strokePushForFrame(
  strength: number,
  delta: number,
  presence = 1,
  strokeRadius = STROKE_RADIUS,
): number {
  if (strength <= 0 || delta <= 0 || presence <= 0) return 0;

  const effectiveTravel = Math.min(strength * delta, strokeRadius * presence);

  return effectiveTravel * INJECTION_PER_CANVAS_HEIGHT;
}

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
  /** The live parameters (WaveFieldTuning), written by `tune`. */
  heightDamping: ReturnType<typeof uniform<number>>;
  velocityDamping: ReturnType<typeof uniform<number>>;
  strokeRadius: ReturnType<typeof uniform<number>>;
}

/**
 * Builds the fragment that turns the previous field into the next one, one
 * substep later. It runs once per texel of the field. Reading the previous
 * target while writing the other is the ping-pong: a pass can never read
 * the texture it is drawing into, so the state lives in two targets that
 * trade roles.
 */
function buildStepNode({
  previous,
  texelWidth,
  texelHeight,
  heightDamping,
  velocityDamping,
}: FieldUniforms) {
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
  const nextVelocity = velocity.add(laplacian.mul(WAVE_STIFFNESS)).mul(velocityDamping);
  const nextHeight = height.add(nextVelocity).mul(heightDamping);

  return vec4(nextHeight, nextVelocity, float(0), float(1));
}

/**
 * Builds the fragment that presses a stroke into the field without moving
 * time: the previous state copied through, with the surface pushed down
 * along the pointer's segment. It is its own pass rather than part of the
 * step so a stroke lands once per frame whatever the frame rate, and a
 * frame too short for a substep still leaves its segment in the water.
 */
function buildStampNode({
  previous,
  aspect,
  strokeFrom,
  strokeTo,
  strokePush,
  strokeRadius,
}: FieldUniforms) {
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
  const brush = oneMinus(smoothstep(0, strokeRadius, distance));

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
  tune: () => {
    // Nothing to tune.
  },
  resize: () => {
    // No targets to recreate.
  },
  onResize: () => () => undefined,
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
  // Kept so `tune` can re-derive the settle model without a resize.
  let fieldLongEdge = Math.max(size.width, size.height);
  let settleDamping = slowestModeDamping(fieldLongEdge);
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
    heightDamping: uniform(HEIGHT_DAMPING),
    velocityDamping: uniform(VELOCITY_DAMPING),
    strokeRadius: uniform(STROKE_RADIUS),
  };

  // The settle model's per-substep decay for the field's current size and
  // dampings. Re-derived whenever either changes.
  const currentSettleDamping = () =>
    slowestModeDamping(fieldLongEdge, uniforms.heightDamping.value, uniforms.velocityDamping.value);

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
  // fixed substep applies the travelling wave's combined amplitude damping.
  // Small strokes therefore settle sooner than a maximum-strength stroke.
  let settleActivity = 0;
  const resizeListeners = new Set<() => void>();

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
  // never breaks the scene's frame loop. `flatten` clears the field whatever
  // the settle model says.
  const runPasses = (stamp: boolean, substeps: number, flatten = false) => {
    const previousTarget = renderer.getRenderTarget();

    try {
      if (stamp) drawPass(stampMaterial);
      for (let index = 0; index < substeps; index += 1) {
        drawPass(stepMaterial);
        settleActivity *= settleDamping;
      }
      // Zero both targets once an unstamped frame finds the model below one
      // 8-bit step. Waiting one frame lets small stroke segments accumulate
      // instead of clearing each one on a high-refresh display. A stale texel
      // would still seed the next stroke's ring, so two draws cover both.
      if (flatten || (!stamp && settleActivity <= SETTLE_AMPLITUDE)) {
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
      // "slow" policy makes the wave crawl. "Paused" (a factor of 0) takes
      // no substeps and no stroke, and it flattens any water left from
      // before the pause: frozen ripples would still show, and a field
      // that never settles would keep its caller asking for frames.
      const timeScale = getReducedMotionTimeScale().value;

      if (timeScale <= 0) {
        if (settleActivity > 0) runPasses(false, 0, true);

        return;
      }

      const scaledDelta = delta * timeScale;

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
        const push = strokePushForFrame(
          strength,
          delta,
          stroke.presence,
          uniforms.strokeRadius.value,
        );

        uniforms.strokePush.value = push;
        settleActivity += push;
      }
      if (!stamp && settleActivity === 0) {
        carry = 0;

        return;
      }

      carry = Math.min(carry + scaledDelta, MAX_SUBSTEPS_PER_FRAME * SUBSTEP_SECONDS);
      const substeps = Math.floor(carry / SUBSTEP_SECONDS);

      carry -= substeps * SUBSTEP_SECONDS;

      if (stamp || substeps > 0 || settleActivity <= SETTLE_AMPLITUDE) {
        runPasses(stamp, substeps);
      }
    },

    // Every value reaches the next pass through its uniform, and the step
    // reads the brush radius back for the push cap. The dampings set how
    // fast the slowest wave dies, so the settle model follows them.
    tune({ strokeRadius, heightDamping, velocityDamping }) {
      if (strokeRadius !== undefined) uniforms.strokeRadius.value = strokeRadius;
      if (heightDamping !== undefined) uniforms.heightDamping.value = heightDamping;
      if (velocityDamping !== undefined) uniforms.velocityDamping.value = velocityDamping;
      settleDamping = currentSettleDamping();
    },

    get texture() {
      alive();

      return read?.texture ?? null;
    },

    get atRest() {
      return settleActivity === 0;
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
      fieldLongEdge = Math.max(next.width, next.height);
      settleDamping = currentSettleDamping();
      for (const listener of resizeListeners) listener();
    },

    onResize(listener) {
      resizeListeners.add(listener);

      return () => resizeListeners.delete(listener);
    },

    dispose() {
      dropField();
      resizeListeners.clear();
      stepMaterial.dispose();
      stampMaterial.dispose();
      clearMaterial.dispose();
    },
  };
}
