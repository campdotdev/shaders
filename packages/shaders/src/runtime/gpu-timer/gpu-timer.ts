// GPU timing for the render passes a scene draws each frame (a render pass is
// one batch of draws into one target). The output stage creates one timer for
// its two passes and draws each frame through measure(). ShaderMonitor turns
// timing on through the scene context's timeGpu while it is mounted.
import type { Camera, Object3D, RenderTarget } from 'three';
import type { WebGPURenderer } from 'three/webgpu';

/** One pass the timer measures: what three draws, from which camera, into what. */
export interface TimedPass {
  scene: Object3D;
  camera: Camera;
  /** The pass's render target, or null when it draws to the canvas. */
  renderTarget: RenderTarget | null;
}

/**
 * Turns GPU timing on, and calls `onFrameTime` with the GPU milliseconds of
 * each measured frame: the time the GPU spent on any of its passes, with time
 * where passes overlap counted once. Timing stays on until every caller has
 * called the off switch this returns. On a renderer that cannot time its
 * passes, such as the WebGL2 fallback, nothing is ever reported.
 */
export type TimeGpu = (onFrameTime: (milliseconds: number) => void) => () => void;

export interface GpuTimer {
  start: TimeGpu;
  /**
   * Run `draw` with timing on, then read back the passes it drew. The owner
   * draws every frame through this, and `draw` must draw the measured passes
   * and no others, because three times every pass it begins inside it.
   */
  measure: (draw: () => void) => void;
}

// ----------------------------------------------------------------------------
// The backend internals the timer reads
// ----------------------------------------------------------------------------
// A timestamp query asks the GPU to write its clock into a query set (a small
// GPU-side array of results) at the start and end of a pass. The GPU then
// resolves the query set, copying the results into a buffer, and the CPU maps
// that buffer to read it. three 0.170 has all of this, but only its async
// render path reads the results, and a scene draws synchronously. So the
// timer reaches into WebGPUBackend's per-pass state, the way gamut.ts reaches
// into its canvas context: the timestamp-writes gotcha in docs/agents/tsl.md.

/**
 * What WebGPUBackend keeps per render context for timing. three's public
 * types declare none of it. `initTimestampQuery` creates the query set and
 * puts its writes on the pass descriptor, and `prepareTimestampBuffer`
 * resolves the query set into the result buffer at the end of every pass,
 * unless the buffer is still mapped from an earlier read.
 */
interface PassTimestampState {
  descriptor?: GPURenderPassDescriptor;
  timeStampQuerySet?: GPUQuerySet;
  currentTimestampQueryBuffers?: TimestampBuffers;
}

interface TimestampBuffers {
  resultBuffer: GPUBuffer;
  isMappingPending: boolean;
}

/**
 * WebGPUBackend's timestamp flag, its feature check, the per-object data map
 * it keeps render contexts in, and the call that sets up a pass's timestamp
 * query. three reads the flag at init only to turn it off on an adapter
 * without the feature, and again on every pass. It calls
 * `initTimestampQuery` on each pass's descriptor right before the pass
 * begins.
 */
interface TimestampBackend {
  trackTimestamp: boolean;
  hasFeature: (name: string) => boolean;
  get: (renderContext: object) => PassTimestampState;
  initTimestampQuery: (renderContext: object, descriptor: GPURenderPassDescriptor) => void;
}

function isTimestampBackend(backend: unknown): backend is TimestampBackend {
  if (typeof backend !== 'object' || backend === null) return false;
  if (!('isWebGPUBackend' in backend) || backend.isWebGPUBackend !== true) return false;

  return (
    'trackTimestamp' in backend &&
    typeof backend.trackTimestamp === 'boolean' &&
    'hasFeature' in backend &&
    typeof backend.hasFeature === 'function' &&
    'get' in backend &&
    typeof backend.get === 'function' &&
    'initTimestampQuery' in backend &&
    typeof backend.initTimestampQuery === 'function'
  );
}

// ----------------------------------------------------------------------------
// Building the timer
// ----------------------------------------------------------------------------

export function createGpuTimer(renderer: WebGPURenderer, passes: readonly TimedPass[]): GpuTimer {
  // The WebGL2 fallback has no timestamp path three 0.170 can use here, and
  // a WebGPU adapter may lack the feature. three requests every feature the
  // adapter has at init, so the device has it whenever the adapter does.
  const backend: unknown = renderer.backend;
  const timestampBackend =
    isTimestampBackend(backend) && backend.hasFeature('timestamp-query') ? backend : null;
  // One entry per start() call, so two monitors in one scene each get the
  // frames, and the second one's stop does not end the first one's timing.
  const listeners = new Set<{ onFrameTime: (milliseconds: number) => void }>();

  const passStates = (activeBackend: TimestampBackend): PassTimestampState[] | null => {
    const renderContexts = renderer._renderContexts;

    if (!renderContexts) return null;

    return passes.map(({ scene, camera, renderTarget }) =>
      activeBackend.get(renderContexts.get(scene, camera, renderTarget)),
    );
  };

  const collect = (activeBackend: TimestampBackend) => {
    const states = passStates(activeBackend);

    if (!states) return;

    const buffers = states.map(bufferToRead);

    if (!buffers.every((buffer) => buffer !== null)) return;

    // A read fails when the device is lost or the renderer is disposed
    // mid-read. That frame goes unreported, and the next frame tries again.
    Promise.all(buffers.map(readPassSpan)).then(
      (spans) => {
        const frameMilliseconds = busyMilliseconds(spans);

        if (frameMilliseconds === null) return;
        for (const listener of listeners) listener.onFrameTime(frameMilliseconds);
      },
      () => undefined,
    );
  };

  return {
    start(onFrameTime) {
      if (!timestampBackend) return () => undefined;

      const listener = { onFrameTime };

      listeners.add(listener);

      return () => {
        if (!listeners.delete(listener) || listeners.size > 0) return;
        // three stops resolving a query set once timing is off, but a cached
        // descriptor would keep asking the GPU to write timestamps into it.
        for (const state of passStates(timestampBackend) ?? []) {
          delete state.descriptor?.timestampWrites;
        }
      };
    },

    measure(draw) {
      if (!timestampBackend || listeners.size === 0) {
        draw();

        return;
      }
      // The flag is on only for this draw, so no other pass, such as
      // CursorRipple's wave field, gets timestamp writes from the timer. The
      // finally puts back the value it found, which app code that reached
      // the renderer through the scene context may have set, even when a
      // lost device makes the draw throw.
      //
      // For the same draw, initTimestampQuery also puts the writes back on a
      // descriptor that lost them, before its pass begins. A resize rebuilds
      // the descriptor and a stop takes the writes off, so without this the
      // next frame would draw untimed, and a paused or idle scene may draw
      // only that one frame.
      const wasTracking = timestampBackend.trackTimestamp;
      const { initTimestampQuery } = timestampBackend;

      timestampBackend.trackTimestamp = true;
      timestampBackend.initTimestampQuery = (renderContext, descriptor) => {
        initTimestampQuery.call(timestampBackend, renderContext, descriptor);
        restoreTimestampWrites({
          descriptor,
          timeStampQuerySet: timestampBackend.get(renderContext).timeStampQuerySet,
        });
      };
      try {
        draw();
      } finally {
        timestampBackend.trackTimestamp = wasTracking;
        timestampBackend.initTimestampQuery = initTimestampQuery;
      }
      collect(timestampBackend);
    },
  };
}

// ----------------------------------------------------------------------------
// Reading one pass, and adding up a frame
// ----------------------------------------------------------------------------

/**
 * Put the timestamp writes back on a pass descriptor that lost them. three
 * puts them on a pass's descriptor once, when it creates the pass's query
 * set. A resize rebuilds the descriptor without them, and a stop takes them
 * off.
 */
function restoreTimestampWrites({ descriptor, timeStampQuerySet }: PassTimestampState) {
  if (!descriptor || !timeStampQuerySet || descriptor.timestampWrites) return;
  descriptor.timestampWrites = {
    querySet: timeStampQuerySet,
    beginningOfPassWriteIndex: 0,
    endOfPassWriteIndex: 1,
  };
}

/**
 * The result buffer that holds this frame's timestamps for a pass, or null
 * when the pass cannot be read this frame.
 */
function bufferToRead(state: PassTimestampState): TimestampBuffers | null {
  const { descriptor, currentTimestampQueryBuffers } = state;

  // A descriptor without its writes has not drawn with timing on since the
  // last stop, so its resolved timestamps are stale.
  if (!descriptor?.timestampWrites) return null;
  // No buffers yet means three has not drawn this pass with timing on. A
  // buffer still mapped from an earlier read was skipped by this frame's
  // resolve, so it holds an older frame than the other pass.
  if (!currentTimestampQueryBuffers || currentTimestampQueryBuffers.isMappingPending) return null;

  return currentTimestampQueryBuffers;
}

/** When a pass started and ended on the GPU's clock, in nanoseconds. */
interface PassSpan {
  begin: bigint;
  end: bigint;
}

/**
 * Map a pass's result buffer and read its two timestamps. This mirrors
 * three's own resolveTimestampAsync, which reports into `renderer.info`
 * instead. info adds each pass to a running total that it resets by a count
 * of last frame's draws, so it cannot pair one frame's passes. The pending
 * flag keeps three from resolving into the buffer while it is mapped.
 */
async function readPassSpan(buffers: TimestampBuffers): Promise<PassSpan> {
  const { resultBuffer } = buffers;

  buffers.isMappingPending = true;
  try {
    await resultBuffer.mapAsync(GPUMapMode.READ);
    const [begin = 0n, end = 0n] = new BigUint64Array(resultBuffer.getMappedRange());

    resultBuffer.unmap();

    return { begin, end };
  } finally {
    buffers.isMappingPending = false;
  }
}

/**
 * How long the GPU was busy with a frame's passes, in milliseconds: the
 * length of the union of their spans, or null when no pass has a usable span.
 *
 * A plain sum would overcount on a tile-based GPU, such as Apple silicon's.
 * It splits a pass into a vertex stage and a fragment stage, and starts the
 * next pass's vertex stage while the previous pass's fragments still run.
 * The output quad's span then sits almost entirely inside the scene pass's:
 * on an M1 Max the quad begins about 0.1ms after the scene pass and ends
 * about 0.1ms after it, so a sum reads nearly double. On a GPU that runs
 * passes one after another, the union is the sum.
 *
 * Metal writes no end timestamp for a pass that drew nothing, and an
 * unwritten timestamp reads as 0, so a span that ends before it begins is
 * left out.
 */
function busyMilliseconds(spans: readonly PassSpan[]): number | null {
  const usable = spans
    .filter(({ begin, end }) => begin > 0n && end >= begin)
    .sort((first, second) => Number(first.begin - second.begin));

  if (usable.length === 0) return null;

  let busyNanoseconds = 0n;
  let coveredUntil = 0n;

  for (const { begin, end } of usable) {
    // Only the part of this span past what earlier spans covered is new.
    const uncoveredFrom = begin > coveredUntil ? begin : coveredUntil;

    if (end > uncoveredFrom) busyNanoseconds += end - uncoveredFrom;
    if (end > coveredUntil) coveredUntil = end;
  }

  return Number(busyNanoseconds) / 1_000_000;
}
