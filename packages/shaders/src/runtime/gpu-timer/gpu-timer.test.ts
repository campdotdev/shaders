import type { WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createGpuTimer } from './gpu-timer.js';

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

/**
 * One pass three draws. three keys a pass's render context by what it draws,
 * from where, and into what. Every pass here is its own object, so the
 * stand-in keys the context on the pass alone.
 */
interface FakePass {
  name: string;
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
  const renderContexts = new Map<FakePass, object>();
  const renderContextFor = (pass: FakePass) => {
    if (!renderContexts.has(pass)) renderContexts.set(pass, {});

    return renderContexts.get(pass)!;
  };
  const renderer = { backend } as unknown as WebGPURenderer;

  /** Set the state three left on a pass's render context. */
  const setPassState = (pass: FakePass, state: FakePassState) => {
    passStates.set(renderContextFor(pass), state);
  };

  /**
   * A draw that begins each pass the way three does: initTimestampQuery on
   * the pass's render context and the descriptor in its state, whether
   * timing is on or not.
   */
  const drawPasses = (passes: readonly FakePass[]) => () => {
    for (const pass of passes) {
      const renderContext = renderContextFor(pass);

      backend.initTimestampQuery(renderContext, backend.get(renderContext).descriptor ?? {});
    }
  };

  return { renderer, backend, setPassState, drawPasses };
}

/** The two passes every frame draws: the scene pass and the output quad. */
const makePasses = (): [FakePass, FakePass] => [{ name: 'scene' }, { name: 'output' }];

/** A pre-pass, such as Aurora's field, drawn before the scene pass. */
const makePrePass = (): FakePass => ({ name: 'pre-pass' });

// Lets the timer's map-and-read promise chains settle.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// A draw that begins no pass, for the tests about the flag and the renderer.
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
    const { renderer, setPassState, drawPasses } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer);
    const onFrameTime = vi.fn();

    timer.start(onFrameTime);
    setPassState(passes[0], scenePass);
    setPassState(passes[1], outputPass);
    timer.measure(drawPasses(passes));
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

  // A pre-pass, such as Aurora's field, is part of the frame's GPU cost. The
  // timer finds every pass three begins inside the draw, so a pass a
  // component adds is timed without the timer being told about it.
  it('times every pass three begins inside the draw', async () => {
    const { renderer, setPassState, drawPasses } = makeRenderer();
    const [scenePass, outputPass] = makePasses();
    const fieldPass = makePrePass();
    const timer = createGpuTimer(renderer);
    const onFrameTime = vi.fn();

    timer.start(onFrameTime);
    setPassState(fieldPass, timedPassState(8, 9.5));
    setPassState(scenePass, timedPassState(10, 13));
    setPassState(outputPass, timedPassState(13.5, 14));
    timer.measure(drawPasses([fieldPass, scenePass, outputPass]));
    await settle();

    expect(onFrameTime.mock.calls[0]?.[0]).toBeCloseTo(5);
  });

  // A component that unmounts takes its pre-pass with it. The pass three no
  // longer begins must not hold up or skew the frames after.
  it('reads only the passes the latest draw began', async () => {
    const { renderer, setPassState, drawPasses } = makeRenderer();
    const [scenePass, outputPass] = makePasses();
    const fieldPass = makePrePass();
    const timer = createGpuTimer(renderer);
    const onFrameTime = vi.fn();
    const field = timedPassState(8, 9.5);

    timer.start(onFrameTime);
    setPassState(fieldPass, field);
    setPassState(scenePass, timedPassState(10, 13));
    setPassState(outputPass, timedPassState(13.5, 14));
    timer.measure(drawPasses([fieldPass, scenePass, outputPass]));
    await settle();
    vi.mocked(field.currentTimestampQueryBuffers!.resultBuffer.mapAsync).mockClear();
    timer.measure(drawPasses([scenePass, outputPass]));
    await settle();

    expect(onFrameTime.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
      expect.closeTo(5),
      expect.closeTo(3.5),
    ]);
    expect(field.currentTimestampQueryBuffers?.resultBuffer.mapAsync).not.toHaveBeenCalled();
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
    const timer = createGpuTimer(renderer);
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
      const timer = createGpuTimer(renderer);
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
    const { renderer, setPassState, drawPasses } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer);
    const states = [timedPassState(10, 11), timedPassState(10, 11)];

    const stop = timer.start(vi.fn());

    setPassState(passes[0], states[0]!);
    setPassState(passes[1], states[1]!);
    timer.measure(drawPasses(passes));
    stop();

    expect(states[0]?.descriptor).not.toHaveProperty('timestampWrites');
    expect(states[1]?.descriptor).not.toHaveProperty('timestampWrites');
  });

  // three would not put the writes back, so app code timing its own passes
  // would read stale timestamps from then on.
  it('keeps the timestamp writes after the last stop while app code has the flag on', () => {
    const { renderer, backend, setPassState, drawPasses } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer);
    const state = timedPassState(10, 11);

    backend.trackTimestamp = true;
    const stop = timer.start(vi.fn());

    setPassState(passes[0], state);
    timer.measure(drawPasses(passes));
    stop();

    expect(state.descriptor).toHaveProperty('timestampWrites');
  });

  // three adds the writes only when it creates a pass's query set, which a
  // restart does not. An idle scene may draw only the one frame after it.
  it('puts the timestamp writes back when timing starts again, and times the next frame', async () => {
    const { renderer, setPassState, drawPasses } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer);
    const onFrameTime = vi.fn();

    setPassState(passes[0], timedPassState(10, 11));
    setPassState(passes[1], timedPassState(11, 12));
    const stop = timer.start(vi.fn());

    timer.measure(drawPasses(passes));
    await settle();
    stop();
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
    const { renderer, setPassState, drawPasses } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer);
    const onFrameTime = vi.fn();
    const busy = timedPassState(10, 11);
    const ready = timedPassState(10, 11);

    busy.currentTimestampQueryBuffers!.isMappingPending = true;
    timer.start(onFrameTime);
    setPassState(passes[0], ready);
    setPassState(passes[1], busy);
    timer.measure(drawPasses(passes));
    await settle();

    expect(ready.currentTimestampQueryBuffers?.resultBuffer.mapAsync).not.toHaveBeenCalled();
    expect(onFrameTime).not.toHaveBeenCalled();
  });

  // The read finishes a frame or more after the draw, by which time a monitor
  // may have stopped or a new one started.
  it('reports a frame only to the callers that were timing when it drew and still are', async () => {
    const { renderer, setPassState, drawPasses } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer);
    const staying = vi.fn();
    const leaving = vi.fn();
    const late = vi.fn();

    timer.start(staying);
    const stopLeaving = timer.start(leaving);

    setPassState(passes[0], timedPassState(10, 11));
    setPassState(passes[1], timedPassState(11, 12));
    timer.measure(drawPasses(passes));
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
    const timer = createGpuTimer(renderer);
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

  // three resolves a pass's timestamps into a buffer at the end of the
  // first pass it draws with timing on. A pass that has none yet holds up
  // the frame rather than leaving it out.
  it('skips a frame until three has drawn every pass with timing on', async () => {
    const { renderer, setPassState, drawPasses } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer);
    const onFrameTime = vi.fn();

    timer.start(onFrameTime);
    setPassState(passes[0], timedPassState(10, 11));
    timer.measure(drawPasses(passes));
    await settle();

    expect(onFrameTime).not.toHaveBeenCalled();
  });

  it('draws, and reads nothing, while no one is timing', async () => {
    const { renderer, setPassState } = makeRenderer();
    const passes = makePasses();
    const timer = createGpuTimer(renderer);
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
    const timer = createGpuTimer(renderer);
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
    const timer = createGpuTimer({} as WebGPURenderer);

    expect(() => {
      timer.start(vi.fn())();
      timer.measure(drawNothing);
    }).not.toThrow();
  });
});
