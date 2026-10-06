import { OrthographicCamera, RenderTarget, Scene } from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createGpuTimer, type TimedPass } from './gpu-timer.js';

// ----------------------------------------------------------------------------
// A stand-in for three's WebGPU backend
// ----------------------------------------------------------------------------
// The timer reads what WebGPUBackend keeps per render context: the pass
// descriptor, the timestamp query set, and the buffer the query set resolves
// into. Each test sets that state up the way three leaves it after a draw.

interface FakeResultBuffer {
  mapAsync: ReturnType<typeof vi.fn>;
  getMappedRange: () => ArrayBuffer;
  unmap: ReturnType<typeof vi.fn>;
}

interface FakePassState {
  descriptor?: { timestampWrites?: unknown };
  timeStampQuerySet?: object;
  currentTimestampQueryBuffers?: { resultBuffer: FakeResultBuffer; isMappingPending: boolean };
}

/** A result buffer holding one pass's begin and end timestamps, in nanoseconds. */
function resultBuffer(beginNanoseconds: bigint, endNanoseconds: bigint): FakeResultBuffer {
  return {
    mapAsync: vi.fn(() => Promise.resolve()),
    getMappedRange: () => new BigUint64Array([beginNanoseconds, endNanoseconds]).buffer,
    unmap: vi.fn(),
  };
}

const nanoseconds = (milliseconds: number) => BigInt(Math.round(milliseconds * 1_000_000));

/**
 * The state three leaves on a pass it drew with timing on, which ran on the
 * GPU from `beginMilliseconds` to `endMilliseconds` of its clock.
 */
function timedPassState(beginMilliseconds: number, endMilliseconds: number): FakePassState {
  const querySet = {};

  return {
    descriptor: { timestampWrites: { querySet } },
    timeStampQuerySet: querySet,
    currentTimestampQueryBuffers: {
      resultBuffer: resultBuffer(nanoseconds(beginMilliseconds), nanoseconds(endMilliseconds)),
      isMappingPending: false,
    },
  };
}

function makeRenderer({ timestampQuery = true, webgpu = true, timestampFlag = true } = {}) {
  const passStates = new Map<object, FakePassState>();
  const backend = {
    isWebGPUBackend: webgpu,
    trackTimestamp: false,
    hasFeature: (name: string) => timestampQuery && name === 'timestamp-query',
    get: (renderContext: object) => {
      if (!passStates.has(renderContext)) passStates.set(renderContext, {});

      return passStates.get(renderContext)!;
    },
    // Like three, adds the writes only when it creates the pass's query set.
    initTimestampQuery: (renderContext: object, descriptor: { timestampWrites?: unknown }) => {
      const state = backend.get(renderContext);

      if (!backend.trackTimestamp || state.timeStampQuerySet) return;
      state.timeStampQuerySet = {};
      descriptor.timestampWrites = { querySet: state.timeStampQuerySet };
    },
  };

  // A three upgrade could rename the flag, and the timer must not write a
  // flag three no longer reads.
  if (!timestampFlag) Reflect.deleteProperty(backend, 'trackTimestamp');
  // three keys a render context by what is drawn, from where, and into what.
  // The timer passes the same three things, so one context per scene is
  // enough for a stand-in.
  const renderContexts = new Map<object, object>();
  const renderer = {
    backend,
    _renderContexts: {
      get: (scene: object) => {
        if (!renderContexts.has(scene)) renderContexts.set(scene, {});

        return renderContexts.get(scene);
      },
    },
  } as unknown as WebGPURenderer;

  /** Set the state three left on a pass's render context. */
  const setPassState = (pass: TimedPass, state: FakePassState) => {
    passStates.set(renderer._renderContexts!.get(pass.scene, pass.camera), state);
  };

  /** A draw that begins each pass the way three does, on the descriptor in its state. */
  const drawPasses = (passes: readonly TimedPass[]) => () => {
    for (const { scene, camera } of passes) {
      const renderContext = renderer._renderContexts!.get(scene, camera);

      backend.initTimestampQuery(renderContext, backend.get(renderContext).descriptor ?? {});
    }
  };

  return { renderer, backend, setPassState, drawPasses };
}

const makePasses = (): [TimedPass, TimedPass] => [
  { scene: new Scene(), camera: new OrthographicCamera(), renderTarget: new RenderTarget() },
  { scene: new Scene(), camera: new OrthographicCamera(), renderTarget: null },
];

// Lets the timer's map-and-read promise chains settle.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// The draw a test hands the timer. The fake backend's pass states already
// say what three drew.
const drawNothing = () => undefined;

describe('createGpuTimer', () => {
  beforeEach(() => {
    vi.stubGlobal('GPUMapMode', { READ: 1 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Time one frame whose two passes ran over the given GPU clock spans, in milliseconds. */
  async function frameTimeFor(scenePass: FakePassState, outputPass: FakePassState) {
    const { renderer, setPassState } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer, passes);
    const onFrameTime = vi.fn();

    timer.start(onFrameTime);
    setPassState(passes[0], scenePass);
    setPassState(passes[1], outputPass);
    timer.measure(drawNothing);
    await settle();

    return onFrameTime;
  }

  it('reports the sum of the passes when the GPU runs them one after another', async () => {
    const onFrameTime = await frameTimeFor(timedPassState(10, 13), timedPassState(13.5, 14));

    expect(onFrameTime).toHaveBeenCalledTimes(1);
    expect(onFrameTime.mock.calls[0]?.[0]).toBeCloseTo(3.5);
  });

  // A tile-based GPU, such as Apple silicon's, starts the output quad while
  // the scene pass's fragments are still running, so the quad's span sits
  // inside the scene pass's. A sum would count that time twice.
  it('counts the time once where the passes overlap', async () => {
    const onFrameTime = await frameTimeFor(timedPassState(10, 19.7), timedPassState(10.1, 19.9));

    expect(onFrameTime.mock.calls[0]?.[0]).toBeCloseTo(9.9);
  });

  // Metal writes no end timestamp for a pass that did no work, and an
  // unwritten timestamp reads as 0.
  it('leaves out a pass whose end timestamp was never written', async () => {
    const onFrameTime = await frameTimeFor(timedPassState(10, 0), timedPassState(10.1, 10.3));

    expect(onFrameTime.mock.calls[0]?.[0]).toBeCloseTo(0.2);
  });

  // three puts timestamp writes on every pass it begins while the flag is on,
  // so a flag left on would time passes the timer never reads.
  it("turns on the backend's timestamp flag only inside the draw, until the last stop", () => {
    const { renderer, backend } = makeRenderer();
    const timer = createGpuTimer(renderer, makePasses());
    const flagInsideDraws: boolean[] = [];
    const drawRecordingFlag = () => {
      flagInsideDraws.push(backend.trackTimestamp);
    };

    const stopFirst = timer.start(vi.fn());
    const stopSecond = timer.start(vi.fn());

    expect(backend.trackTimestamp).toBe(false);
    timer.measure(drawRecordingFlag);
    expect(backend.trackTimestamp).toBe(false);
    stopFirst();
    timer.measure(drawRecordingFlag);
    stopSecond();
    timer.measure(drawRecordingFlag);

    expect(flagInsideDraws).toEqual([true, true, false]);
  });

  // App code can reach the renderer through the scene context and turn the
  // flag on itself.
  it.each([false, true])(
    'puts back the flag it found (%s) and initTimestampQuery, even when the draw throws',
    (found) => {
      const { renderer, backend } = makeRenderer();
      const timer = createGpuTimer(renderer, makePasses());
      const { initTimestampQuery } = backend;

      backend.trackTimestamp = found;
      timer.start(vi.fn());
      timer.measure(drawNothing);

      expect(backend.trackTimestamp).toBe(found);
      expect(backend.initTimestampQuery).toBe(initTimestampQuery);
      expect(() =>
        timer.measure(() => {
          throw new Error('device lost');
        }),
      ).toThrow('device lost');
      expect(backend.trackTimestamp).toBe(found);
      expect(backend.initTimestampQuery).toBe(initTimestampQuery);
    },
  );

  it("removes the timestamp writes from the passes' descriptors after the last stop", () => {
    const { renderer, setPassState } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer, passes);
    const states = [timedPassState(10, 11), timedPassState(10, 11)];

    const stop = timer.start(vi.fn());

    setPassState(passes[0], states[0]!);
    setPassState(passes[1], states[1]!);
    stop();

    expect(states[0]?.descriptor).not.toHaveProperty('timestampWrites');
    expect(states[1]?.descriptor).not.toHaveProperty('timestampWrites');
  });

  // three would not put the writes back, so app code timing its own passes
  // would read stale timestamps from then on.
  it('keeps the timestamp writes after the last stop while app code has the flag on', () => {
    const { renderer, backend, setPassState } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer, passes);
    const state = timedPassState(10, 11);

    backend.trackTimestamp = true;
    const stop = timer.start(vi.fn());

    setPassState(passes[0], state);
    stop();

    expect(state.descriptor).toHaveProperty('timestampWrites');
  });

  // three adds the writes only when it creates a pass's query set, which a
  // restart does not. An idle scene may draw only the one frame after it.
  it('puts the timestamp writes back when timing starts again, and times the next frame', async () => {
    const { renderer, setPassState, drawPasses } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer, passes);
    const onFrameTime = vi.fn();

    setPassState(passes[0], timedPassState(10, 11));
    setPassState(passes[1], timedPassState(11, 12));
    timer.start(vi.fn())();
    timer.start(onFrameTime);
    timer.measure(drawPasses(passes));
    await settle();

    expect(onFrameTime).toHaveBeenCalledTimes(1);
    expect(onFrameTime.mock.calls[0]?.[0]).toBeCloseTo(2);
  });

  // three skips the resolve into a buffer that is still mapped from an
  // earlier read, so that buffer holds an older frame. Reading the other pass
  // alone would pair two different frames.
  it('skips a frame while any pass is still being read', async () => {
    const { renderer, setPassState } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer, passes);
    const onFrameTime = vi.fn();
    const busy = timedPassState(10, 11);
    const ready = timedPassState(10, 11);

    busy.currentTimestampQueryBuffers!.isMappingPending = true;
    timer.start(onFrameTime);
    setPassState(passes[0], ready);
    setPassState(passes[1], busy);
    timer.measure(drawNothing);
    await settle();

    expect(ready.currentTimestampQueryBuffers?.resultBuffer.mapAsync).not.toHaveBeenCalled();
    expect(onFrameTime).not.toHaveBeenCalled();
  });

  // The read finishes a frame or more after the draw, by which time a monitor
  // may have stopped or a new one started.
  it('reports a frame only to the callers that were timing when it drew and still are', async () => {
    const { renderer, setPassState } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer, passes);
    const staying = vi.fn();
    const leaving = vi.fn();
    const late = vi.fn();

    timer.start(staying);
    const stopLeaving = timer.start(leaving);

    setPassState(passes[0], timedPassState(10, 11));
    setPassState(passes[1], timedPassState(11, 12));
    timer.measure(drawNothing);
    stopLeaving();
    timer.start(late);
    await settle();

    expect(staying).toHaveBeenCalledTimes(1);
    expect(leaving).not.toHaveBeenCalled();
    expect(late).not.toHaveBeenCalled();
  });

  // three attaches a pass's timestamp writes only when it creates the pass's
  // query set. A resize rebuilds the descriptor without them, and a paused
  // or idle scene draws only the one frame at its new size.
  it('puts the timestamp writes back on a rebuilt descriptor before its pass begins, and times that frame', async () => {
    const { renderer, setPassState, drawPasses } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer, passes);
    const onFrameTime = vi.fn();
    const rebuilt = timedPassState(10, 11);
    const writesAtPassBegin: unknown[] = [];

    rebuilt.descriptor = {};
    timer.start(onFrameTime);
    setPassState(passes[0], rebuilt);
    setPassState(passes[1], timedPassState(10, 11));
    timer.measure(() => {
      drawPasses(passes)();
      writesAtPassBegin.push(rebuilt.descriptor?.timestampWrites);
    });
    await settle();

    expect(writesAtPassBegin).toEqual([
      { querySet: rebuilt.timeStampQuerySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 },
    ]);
    expect(onFrameTime).toHaveBeenCalledTimes(1);
  });

  it('skips a frame until three has drawn every pass with timing on', async () => {
    const { renderer, setPassState } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer, passes);
    const onFrameTime = vi.fn();

    timer.start(onFrameTime);
    setPassState(passes[0], timedPassState(10, 11));
    timer.measure(drawNothing);
    await settle();

    expect(onFrameTime).not.toHaveBeenCalled();
  });

  it('draws, and reads nothing, while no one is timing', async () => {
    const { renderer, setPassState } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer, passes);
    const state = timedPassState(10, 11);
    const draw = vi.fn();

    setPassState(passes[0], state);
    setPassState(passes[1], timedPassState(10, 11));
    timer.measure(draw);
    await settle();

    expect(draw).toHaveBeenCalledTimes(1);
    expect(state.currentTimestampQueryBuffers?.resultBuffer.mapAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['an adapter without timestamp queries', { timestampQuery: false }],
    ['the WebGL2 fallback', { webgpu: false }],
    ['a backend without the timestamp flag', { timestampFlag: false }],
  ])('never turns timing on for %s', async (_, options) => {
    const { renderer, backend, setPassState } = makeRenderer(options);
    const passes = makePasses();
    const timer = createGpuTimer(renderer, passes);
    const onFrameTime = vi.fn();
    let flagInsideDraw: boolean | undefined;

    timer.start(onFrameTime);
    setPassState(passes[0], timedPassState(10, 11));
    setPassState(passes[1], timedPassState(10, 11));
    timer.measure(() => {
      flagInsideDraw = backend.trackTimestamp;
    });
    await settle();

    expect(flagInsideDraw).not.toBe(true);
    expect(onFrameTime).not.toHaveBeenCalled();
  });

  it('accepts a renderer with no backend, as the scene tests build', () => {
    const timer = createGpuTimer({} as WebGPURenderer, makePasses());

    expect(() => {
      timer.start(vi.fn())();
      timer.measure(drawNothing);
    }).not.toThrow();
  });
});
