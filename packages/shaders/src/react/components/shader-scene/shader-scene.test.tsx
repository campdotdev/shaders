import { useEffect } from 'react';

import { render, waitFor } from '@testing-library/react';
import { Object3D } from 'three';
import type { QuadMesh } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ShadersModule from '../../../engine.js';
import {
  createRenderer,
  type CursorInput,
  type GpuRenderer,
  type Vector2,
} from '../../../engine.js';
import { ShadersError } from '../../errors/shaders-error.js';
import { useResize } from '../../hooks/use-resize/use-resize.js';
import { useShaderContext } from '../../hooks/use-shader-context/use-shader-context.js';
import { useStaticSceneHint } from '../../hooks/use-static-hint/use-static-hint.js';
import { PosterContext } from '../shader-poster/poster-context.js';
import { ShaderScene } from './shader-scene.js';

vi.mock('../../../engine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ShadersModule>();

  return {
    ...actual,
    createRenderer: vi.fn(async () => ({
      three: {
        render: vi.fn(),
        dispose: vi.fn(),
        domElement: document.createElement('canvas'),
        getPixelRatio: () => 1,
        setSize: vi.fn(),
      },
      backend: 'webgl2' as const,
      dispose: vi.fn(),
      resize: vi.fn(),
    })),
  };
});

describe('ShaderScene', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('mounts a canvas element', () => {
    const { container } = render(<ShaderScene />);

    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  // three 0.170's PostProcessing shares one quad and one material across
  // every instance, so two scenes on a page drew whichever output was set
  // last. Each scene must draw its own quad with its own material.
  it('gives every scene its own output quad and material', async () => {
    const frames: FrameRequestCallback[] = [];

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);

      return frames.length;
    });
    vi.mocked(createRenderer).mockClear();

    render(
      <>
        <ShaderScene />
        <ShaderScene />
      </>,
    );

    await waitFor(() => expect(frames.length).toBeGreaterThanOrEqual(2));
    for (const frame of frames.splice(0)) frame(16);

    const renderers = await Promise.all(
      vi.mocked(createRenderer).mock.results.map((result) => result.value),
    );
    const quads = renderers.map(
      (gpuRenderer) => vi.mocked(gpuRenderer.three.render).mock.calls.at(-1)?.[0] as QuadMesh,
    );

    const [first, second] = quads;

    expect(quads).toHaveLength(2);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first).not.toBe(second);
    expect(first?.material).not.toBe(second?.material);
  });

  it('signals painted=false to an enclosing poster boundary on teardown', async () => {
    const setShaderPainted = vi.fn();
    const { unmount } = render(
      <PosterContext.Provider value={{ setShaderPainted }}>
        <ShaderScene />
      </PosterContext.Provider>,
    );

    // Allow a tick for the async setup to run.
    await waitFor(() => {});
    unmount();

    // requestAnimationFrame is stubbed inert in this suite, so the paint
    // signal never fires; teardown must still re-arm the poster.
    expect(setShaderPainted).toHaveBeenCalledWith(false);
  });

  it('does not throw on unmount', async () => {
    const { unmount } = render(<ShaderScene />);

    // Allow a tick for the async setup to run (or be cancelled).
    await waitFor(() => {});
    expect(() => unmount()).not.toThrow();
  });

  it('fires onError with a renderer-init ShadersError when init fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const cause = new Error('no gpu backend');

    vi.mocked(createRenderer).mockRejectedValueOnce(cause);
    const onError = vi.fn();

    render(<ShaderScene onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    const error = onError.mock.calls[0]?.[0] as ShadersError;

    expect(error).toBeInstanceOf(ShadersError);
    expect(error.code).toBe('renderer-init');
    expect(error.cause).toBe(cause);
  });

  it('mounts no children after init failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(createRenderer).mockRejectedValueOnce(new Error('no gpu backend'));

    const { queryByTestId } = render(
      <ShaderScene>
        <div data-testid="child" />
      </ShaderScene>,
    );

    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(queryByTestId('child')).not.toBeInTheDocument();
  });

  it('fires onError once even when a failing setup re-runs', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const cause = new Error('no gpu backend');

    vi.mocked(createRenderer).mockRejectedValueOnce(cause).mockRejectedValueOnce(cause);
    const onError = vi.fn();

    const { rerender } = render(<ShaderScene maxDPR={1} onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    // A maxDPR change re-runs the setup effect; init fails again.
    rerender(<ShaderScene maxDPR={2} onError={onError} />);

    // The dev log fires per attempt, so it marks the second failure settling.
    await waitFor(() => expect(console.error).toHaveBeenCalledTimes(2));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('swallows a throwing onError handler', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(createRenderer).mockRejectedValueOnce(new Error('no gpu backend'));
    const onError = vi.fn(() => {
      throw new Error('handler boom');
    });

    let queryByTestId!: ReturnType<typeof render>['queryByTestId'];

    expect(() => {
      ({ queryByTestId } = render(
        <ShaderScene onError={onError}>
          <div data-testid="child" />
        </ShaderScene>,
      ));
    }).not.toThrow();
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(queryByTestId('child')).not.toBeInTheDocument();
  });

  it('hands every child the same cursor input, and detaches it with the scene', async () => {
    vi.spyOn(window, 'addEventListener');
    vi.spyOn(window, 'removeEventListener');

    const countPointerListeners = (spy: typeof window.addEventListener) =>
      vi.mocked(spy).mock.calls.filter(([eventType]) => eventType === 'pointermove').length;
    const inputs: CursorInput[] = [];

    function Reader() {
      const shaderContext = useShaderContext();

      inputs.push(shaderContext!.getCursorInput(), shaderContext!.getCursorInput());

      return null;
    }

    const { unmount } = render(
      <ShaderScene>
        <Reader />
      </ShaderScene>,
    );

    await waitFor(() => expect(inputs.length).toBeGreaterThanOrEqual(2));

    expect(new Set(inputs).size).toBe(1);
    expect(countPointerListeners(window.addEventListener)).toBe(1);

    unmount();

    expect(countPointerListeners(window.removeEventListener)).toBe(1);
  });

  it('gives two scenes two cursor inputs, each normalized to its own canvas', async () => {
    const inputs: CursorInput[] = [];

    function Reader() {
      const shaderContext = useShaderContext();

      inputs.push(shaderContext!.getCursorInput());

      return null;
    }

    const { container } = render(
      <>
        <ShaderScene>
          <Reader />
        </ShaderScene>
        <ShaderScene>
          <Reader />
        </ShaderScene>
      </>,
    );

    await waitFor(() => expect(inputs.length).toBeGreaterThanOrEqual(2));

    const [first, second] = inputs;

    expect(first).toBeDefined();
    expect(first).not.toBe(second);

    // Two 1000 by 1000 canvases stacked: the first at the top of the page,
    // the second directly below. One pointer at (500, 1500) is below the
    // first canvas and at the center of the second.
    const canvases = container.querySelectorAll('canvas');

    expect(canvases).toHaveLength(2);
    canvases[0]!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 1000, height: 1000 }) as DOMRect;
    canvases[1]!.getBoundingClientRect = () =>
      ({ left: 0, top: 1000, width: 1000, height: 1000 }) as DOMRect;
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 500, clientY: 1500 }));

    expect(first!.getTarget()).toEqual([0.5, 1.5]);
    expect(first!.isInside()).toBe(false);
    expect(second!.getTarget()).toEqual([0.5, 0.5]);
    expect(second!.isInside()).toBe(true);
  });

  it('does not fire onError on successful init', async () => {
    const onError = vi.fn();

    const { getByTestId } = render(
      <ShaderScene onError={onError}>
        <div data-testid="child" />
      </ShaderScene>,
    );

    // Children mount only once setup has committed the shader context, so
    // this waits for the success path to fully settle.
    await waitFor(() => expect(getByTestId('child')).toBeInTheDocument());
    expect(onError).not.toHaveBeenCalled();
  });

  // ---------------------------------------------
  // stubs the paused and resize tests share
  // ---------------------------------------------

  // A renderer whose three clock the test can read and move. three's own
  // animation loop advances nodeFrame.time on every animation frame,
  // rendering or not, so a test moves it by hand to stand for that loop
  // running while the scene is paused. The stub records the time each
  // frame renders at.
  function rendererWithClock() {
    const nodeFrame = { time: 5, deltaTime: 0 };
    const timeAtRender: number[] = [];
    const gpuRenderer = {
      three: {
        render: vi.fn(() => timeAtRender.push(nodeFrame.time)),
        dispose: vi.fn(),
        domElement: document.createElement('canvas'),
        getPixelRatio: () => 1,
        setSize: vi.fn(),
        _nodes: { nodeFrame },
      },
      backend: 'webgl2' as const,
      dispose: vi.fn(),
      resize: vi.fn(),
    } as unknown as GpuRenderer;

    vi.mocked(createRenderer).mockResolvedValueOnce(gpuRenderer);

    return { gpuRenderer, nodeFrame, timeAtRender };
  }

  function captureFrames(): FrameRequestCallback[] {
    const frames: FrameRequestCallback[] = [];

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);

      return frames.length;
    });

    return frames;
  }

  const runFrames = (frames: FrameRequestCallback[], now: number) => {
    for (const frame of frames.splice(0)) frame(now);
  };

  // A child that adds a mesh to the scene, as a shader component does, so
  // the frames after it mounts have content.
  function MeshChild() {
    const shaderContext = useShaderContext();

    useEffect(() => {
      if (!shaderContext) return undefined;
      const mesh = new Object3D();

      shaderContext.scene.add(mesh);

      return () => {
        shaderContext.scene.remove(mesh);
      };
    }, [shaderContext]);

    return <div data-testid="child" />;
  }

  function stubResizeObserver(): () => void {
    const resizeCallbacks: ResizeObserverCallback[] = [];

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallbacks.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );

    return () => {
      for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);
    };
  }

  // Returns a function that tells the scene its canvas has scrolled in or
  // out of view.
  function stubIntersectionObserver(): (inView: boolean) => void {
    const intersectionCallbacks: IntersectionObserverCallback[] = [];

    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersectionCallbacks.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );

    return (inView) => {
      for (const callback of intersectionCallbacks) {
        callback(
          [{ isIntersecting: inView } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      }
    };
  }

  describe('paused', () => {
    it('draws no frames while paused, and draws again once unpaused', async () => {
      const frames = captureFrames();
      const { gpuRenderer } = rendererWithClock();
      const { getByTestId, rerender } = render(
        <ShaderScene paused>
          <div data-testid="child" />
        </ShaderScene>,
      );

      await waitFor(() => expect(getByTestId('child')).toBeInTheDocument());
      runFrames(frames, 16);
      expect(gpuRenderer.three.render).not.toHaveBeenCalled();

      rerender(
        <ShaderScene paused={false}>
          <div data-testid="child" />
        </ShaderScene>,
      );
      await waitFor(() => expect(frames.length).toBeGreaterThan(0));
      runFrames(frames, 32);
      expect(gpuRenderer.three.render).toHaveBeenCalled();
    });

    // A frozen frame stays frozen: the first frame after a resume adds none
    // of the paused time to the renderer clock, so the animation carries on
    // from the frame it stopped on.
    it('leaves the paused time out of the renderer clock on resume', async () => {
      const frames = captureFrames();
      const { nodeFrame, timeAtRender } = rendererWithClock();
      const { getByTestId, rerender } = render(
        <ShaderScene>
          <div data-testid="child" />
        </ShaderScene>,
      );

      await waitFor(() => expect(getByTestId('child')).toBeInTheDocument());
      runFrames(frames, 16);
      expect(timeAtRender).toEqual([5]);

      rerender(
        <ShaderScene paused>
          <div data-testid="child" />
        </ShaderScene>,
      );
      nodeFrame.time = 50;
      rerender(
        <ShaderScene paused={false}>
          <div data-testid="child" />
        </ShaderScene>,
      );
      await waitFor(() => expect(frames.length).toBeGreaterThan(0));
      runFrames(frames, 5000);

      expect(timeAtRender).toEqual([5, 5]);
    });
  });

  // ---------------------------------------------
  // maxFPS
  // ---------------------------------------------

  describe('maxFPS', () => {
    // Animation frame timestamps of a 120 Hz display, in milliseconds.
    const at120Hz = (frameNumber: number) => 1000 + (frameNumber * 1000) / 120;

    function drawsAcross120HzFrames(
      frames: FrameRequestCallback[],
      gpuRenderer: GpuRenderer,
      frameNumbers: number[],
    ): boolean[] {
      return frameNumbers.map((frameNumber) => {
        vi.mocked(gpuRenderer.three.render).mockClear();
        runFrames(frames, at120Hz(frameNumber));

        return vi.mocked(gpuRenderer.three.render).mock.calls.length > 0;
      });
    }

    it('draws on every other animation frame at 120 Hz with maxFPS={60}', async () => {
      const frames = captureFrames();
      const { gpuRenderer } = rendererWithClock();
      const { getByTestId } = render(
        <ShaderScene maxFPS={60}>
          <MeshChild />
        </ShaderScene>,
      );

      await waitFor(() => expect(getByTestId('child')).toBeInTheDocument());

      expect(drawsAcross120HzFrames(frames, gpuRenderer, [0, 1, 2, 3, 4])).toEqual([
        true,
        false,
        true,
        false,
        true,
      ]);
    });

    it('applies a new maxFPS on the next frame, without rebuilding the renderer', async () => {
      const frames = captureFrames();
      const { gpuRenderer } = rendererWithClock();

      vi.mocked(createRenderer).mockClear();
      const { getByTestId, rerender } = render(
        <ShaderScene>
          <MeshChild />
        </ShaderScene>,
      );

      await waitFor(() => expect(getByTestId('child')).toBeInTheDocument());
      expect(drawsAcross120HzFrames(frames, gpuRenderer, [0, 1])).toEqual([true, true]);

      rerender(
        <ShaderScene maxFPS={60}>
          <MeshChild />
        </ShaderScene>,
      );

      expect(drawsAcross120HzFrames(frames, gpuRenderer, [2, 3, 4])).toEqual([false, true, false]);
      expect(createRenderer).toHaveBeenCalledTimes(1);
    });

    // A resize clears the canvas, and the redraw is what keeps the browser
    // from painting it cleared, so the frame cap never holds the redraw back.
    it('redraws straight after a resize, however soon after the last frame', async () => {
      const fireResize = stubResizeObserver();
      const frames = captureFrames();
      const { gpuRenderer } = rendererWithClock();
      const { getByTestId } = render(
        <ShaderScene maxFPS={30}>
          <MeshChild />
        </ShaderScene>,
      );

      await waitFor(() => expect(getByTestId('child')).toBeInTheDocument());
      runFrames(frames, at120Hz(0));
      vi.mocked(gpuRenderer.three.render).mockClear();
      fireResize();

      expect(gpuRenderer.three.render).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------
  // resize
  // ---------------------------------------------

  describe('resize', () => {
    // A resize clears the canvas, so a paused scene draws its frozen frame
    // again at the new size, without letting any time pass. A scene paused
    // from its mount has no frame to redraw, and ResizeObserver fires once as
    // it starts observing, so that first callback must draw nothing.
    it('redraws the frozen frame when the canvas resizes', async () => {
      const fireResize = stubResizeObserver();
      const frames = captureFrames();
      const { gpuRenderer, nodeFrame, timeAtRender } = rendererWithClock();
      const { getByTestId, rerender } = render(
        <ShaderScene paused>
          <MeshChild />
        </ShaderScene>,
      );

      await waitFor(() => expect(getByTestId('child')).toBeInTheDocument());
      fireResize();
      expect(gpuRenderer.resize).toHaveBeenCalled();
      expect(gpuRenderer.three.render).not.toHaveBeenCalled();

      rerender(
        <ShaderScene paused={false}>
          <MeshChild />
        </ShaderScene>,
      );
      await waitFor(() => expect(frames.length).toBeGreaterThan(0));
      runFrames(frames, 16);
      rerender(
        <ShaderScene paused>
          <MeshChild />
        </ShaderScene>,
      );
      timeAtRender.length = 0;
      nodeFrame.time = 50;
      fireResize();

      expect(timeAtRender).toEqual([0]);
    });

    // A running scene's loop drew this frame before layout resized the
    // canvas, and the browser paints before the loop runs again. Without a
    // redraw in the resize callback, every frame of a continuous resize
    // paints a cleared canvas. The redraw is a draw only: it ticks no
    // scheduler client, so no phase advances twice in one frame.
    it('redraws a running scene straight after a resize, without a tick', async () => {
      const fireResize = stubResizeObserver();
      const frames = captureFrames();
      const { gpuRenderer } = rendererWithClock();
      const tick = vi.fn();

      function TickingChild() {
        const shaderContext = useShaderContext();

        useEffect(() => {
          if (!shaderContext) return undefined;
          shaderContext.scheduler.add(tick);

          return () => shaderContext.scheduler.remove(tick);
        }, [shaderContext]);

        return <MeshChild />;
      }

      const { getByTestId } = render(
        <ShaderScene>
          <TickingChild />
        </ShaderScene>,
      );

      await waitFor(() => expect(getByTestId('child')).toBeInTheDocument());
      runFrames(frames, 16);
      vi.mocked(gpuRenderer.three.render).mockClear();
      tick.mockClear();
      fireResize();

      expect(gpuRenderer.resize).toHaveBeenCalled();
      expect(gpuRenderer.three.render).toHaveBeenCalledTimes(1);
      expect(tick).not.toHaveBeenCalled();
    });

    // The scene's resize observer runs before anything a child set up, so
    // the size reaches the children's uniforms through the scene, before
    // it draws. Otherwise each frame of a resize would draw at the previous
    // frame's aspect.
    it('publishes the new size to the children before it redraws', async () => {
      const fireResize = stubResizeObserver();
      const frames = captureFrames();
      const { gpuRenderer } = rendererWithClock();
      let childWidth = 0;
      const widthAtRender: number[] = [];

      function SizedChild() {
        const resize = useResize();

        useEffect(
          () =>
            resize.on('change', ([width]) => {
              childWidth = width;
            }),
          [resize],
        );

        return <MeshChild />;
      }

      const { container, getByTestId } = render(
        <ShaderScene>
          <SizedChild />
        </ShaderScene>,
      );

      await waitFor(() => expect(getByTestId('child')).toBeInTheDocument());
      runFrames(frames, 16);
      vi.mocked(gpuRenderer.three.render).mockImplementation(async () => {
        widthAtRender.push(childWidth);
      });

      const canvas = container.querySelector('canvas');

      if (!canvas) throw new Error('ShaderScene rendered no canvas');
      Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 800 });
      Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 400 });
      fireResize();

      expect(widthAtRender).toEqual([800]);
    });

    // The loop is paused while the canvas is out of view, and a redraw no
    // one can see is wasted GPU work. The loop draws at the new size once
    // the canvas scrolls back into view.
    it('sizes the renderer but draws nothing while the canvas is out of view', async () => {
      const fireResize = stubResizeObserver();
      const frames = captureFrames();
      const { gpuRenderer } = rendererWithClock();
      const setInView = stubIntersectionObserver();
      const { getByTestId } = render(
        <ShaderScene>
          <MeshChild />
        </ShaderScene>,
      );

      await waitFor(() => expect(getByTestId('child')).toBeInTheDocument());
      runFrames(frames, 16);
      setInView(false);
      vi.mocked(gpuRenderer.three.render).mockClear();
      vi.mocked(gpuRenderer.resize).mockClear();
      fireResize();

      expect(gpuRenderer.resize).toHaveBeenCalled();
      expect(gpuRenderer.three.render).not.toHaveBeenCalled();
    });

    // A static scene has parked its loop, so on its own it would never draw
    // again after an out-of-view resize cleared its canvas. The skipped
    // redraw asks for a frame, which the loop draws once it resumes.
    it('draws a static scene resized out of view once it is back in view', async () => {
      const fireResize = stubResizeObserver();
      const frames = captureFrames();
      const { gpuRenderer } = rendererWithClock();
      const setInView = stubIntersectionObserver();

      function StaticChild() {
        const shaderContext = useShaderContext();

        useEffect(() => shaderContext?.scheduler.setIdle(true), [shaderContext]);

        return <MeshChild />;
      }

      const { getByTestId } = render(
        <ShaderScene>
          <StaticChild />
        </ShaderScene>,
      );

      await waitFor(() => expect(getByTestId('child')).toBeInTheDocument());
      runFrames(frames, 16);
      runFrames(frames, 32);
      expect(frames).toHaveLength(0);

      setInView(false);
      fireResize();
      vi.mocked(gpuRenderer.three.render).mockClear();
      setInView(true);
      runFrames(frames, 48);

      expect(gpuRenderer.three.render).toHaveBeenCalled();
    });

    // The loop renders empty frames until a child mounts its mesh. A scene
    // paused after only those has no content frame to freeze, so a resize
    // draws nothing, even once the child's mesh is in the scene.
    it('draws nothing on a resize when the loop has drawn only empty frames', async () => {
      const fireResize = stubResizeObserver();
      const frames = captureFrames();
      const { gpuRenderer } = rendererWithClock();
      const { getByTestId, rerender } = render(
        <ShaderScene>
          <div data-testid="child" />
        </ShaderScene>,
      );

      await waitFor(() => expect(getByTestId('child')).toBeInTheDocument());
      runFrames(frames, 16);
      expect(gpuRenderer.three.render).toHaveBeenCalled();

      rerender(
        <ShaderScene paused>
          <MeshChild />
        </ShaderScene>,
      );
      vi.mocked(gpuRenderer.three.render).mockClear();
      fireResize();
      runFrames(frames, 32);

      expect(gpuRenderer.three.render).not.toHaveBeenCalled();
    });
  });

  describe('scrollPush', () => {
    // Fires a one-finger touch event at the canvas center.
    const fireTouch = (canvas: HTMLCanvasElement, type: 'touchstart' | 'touchend') => {
      const touch = new Touch({ identifier: 1, target: canvas, clientX: 500, clientY: 500 });
      const down = type === 'touchstart' ? [touch] : [];

      canvas.dispatchEvent(
        new TouchEvent(type, { touches: down, changedTouches: [touch], bubbles: true }),
      );
    };

    // A child that reads the shared cursor input into `inputs`. With
    // `votesIdle`, it also votes the scene static, so the loop can park.
    function makeReader(inputs: CursorInput[], votesIdle = false) {
      return function Reader() {
        const shaderContext = useShaderContext();

        useStaticSceneHint(votesIdle);
        if (shaderContext) inputs.push(shaderContext.getCursorInput());

        return null;
      };
    }

    // Makes a canvas report a rect the test can scroll, starting at `top`.
    function scrollable(canvas: HTMLCanvasElement, top = 0) {
      let offset = 0;

      canvas.getBoundingClientRect = () =>
        ({ left: 0, top: top + offset, width: 1000, height: 1000 }) as DOMRect;

      return (next: number) => {
        offset = next;
      };
    }

    // Renders one scene with a reader, and hands back its canvas, a way to
    // scroll it, and a frame runner on the captured animation frames.
    async function renderScene({ scrollPush, votesIdle = false }: SceneOptions = {}) {
      const frames = captureFrames();
      const inputs: CursorInput[] = [];
      const Reader = makeReader(inputs, votesIdle);
      const view = render(
        <ShaderScene scrollPush={scrollPush}>
          <Reader />
        </ShaderScene>,
      );

      await waitFor(() => expect(inputs.length).toBeGreaterThan(0));
      const canvas = view.container.querySelector('canvas')!;
      const scrollTo = scrollable(canvas);
      let now = 0;
      const runFrame = () => {
        now += 16;
        runFrames(frames, now);
      };
      const runUntilParked = () => {
        for (let frame = 0; frame < 50 && frames.length > 0; frame += 1) runFrame();
      };

      // A touch, a still frame, then a 30 pixel scroll and another frame.
      const touchAndScroll = () => {
        fireTouch(canvas, 'touchstart');
        runFrame();
        scrollTo(-30);
        runFrame();
      };

      return {
        ...view,
        Reader,
        canvas,
        frames,
        input: () => inputs.at(-1)!,
        runFrame,
        runUntilParked,
        scrollTo,
        touchAndScroll,
      };
    }

    interface SceneOptions {
      scrollPush?: boolean;
      votesIdle?: boolean;
    }

    it('pushes when a touch scrolls the page over the scene', async () => {
      const scene = await renderScene({ scrollPush: true });

      scene.touchAndScroll();

      expect(scene.input().getPush()).not.toBeNull();
    });

    it('stays off by default, and turns on without rebuilding the renderer', async () => {
      vi.mocked(createRenderer).mockClear();
      const scene = await renderScene();

      scene.touchAndScroll();
      expect(scene.input().getPush()).toBeNull();

      scene.rerender(
        <ShaderScene scrollPush>
          <scene.Reader />
        </ShaderScene>,
      );
      scene.scrollTo(0);
      scene.touchAndScroll();

      expect(scene.input().getPush()).not.toBeNull();
      expect(createRenderer).toHaveBeenCalledTimes(1);
    });

    it('wakes a parked scene when a finger lands, and parks once the fling settles', async () => {
      const scene = await renderScene({ scrollPush: true, votesIdle: true });

      scene.runUntilParked();
      expect(scene.frames).toHaveLength(0);

      fireTouch(scene.canvas, 'touchstart');
      expect(scene.frames.length).toBeGreaterThan(0);

      // The finger lifts mid-scroll, and the fling carries the canvas on
      // for a few frames, then stops.
      fireTouch(scene.canvas, 'touchend');
      for (const top of [-20, -35, -45]) {
        scene.scrollTo(top);
        scene.runFrame();
        expect(scene.frames.length).toBeGreaterThan(0);
      }
      scene.runUntilParked();

      expect(scene.input().isPushing()).toBe(false);
      expect(scene.frames).toHaveLength(0);
    });

    it('never pushes one scene from a touch on another', async () => {
      const frames = captureFrames();
      const firstInputs: CursorInput[] = [];
      const secondInputs: CursorInput[] = [];
      const FirstReader = makeReader(firstInputs);
      const SecondReader = makeReader(secondInputs);
      const { container } = render(
        <>
          <ShaderScene scrollPush>
            <FirstReader />
          </ShaderScene>
          <ShaderScene scrollPush>
            <SecondReader />
          </ShaderScene>
        </>,
      );

      await waitFor(() => expect(secondInputs.length).toBeGreaterThan(0));
      const [firstCanvas, secondCanvas] = [...container.querySelectorAll('canvas')];
      const scrollFirst = scrollable(firstCanvas!, 0);
      const scrollSecond = scrollable(secondCanvas!, 1000);

      fireTouch(firstCanvas!, 'touchstart');
      runFrames(frames, 16);
      scrollFirst(-30);
      scrollSecond(-30);
      runFrames(frames, 32);

      expect(firstInputs.at(-1)!.getPush()).not.toBeNull();
      expect(secondInputs.at(-1)!.getPush()).toBeNull();
    });

    it('ends the push when the scene pauses, so the frame after the pause pushes nothing', async () => {
      const scene = await renderScene({ scrollPush: true });

      fireTouch(scene.canvas, 'touchstart');
      scene.runFrame();
      scene.rerender(
        <ShaderScene paused scrollPush>
          <scene.Reader />
        </ShaderScene>,
      );
      // The page scrolls a long way while the loop is paused.
      scene.scrollTo(-400);
      scene.rerender(
        <ShaderScene scrollPush>
          <scene.Reader />
        </ShaderScene>,
      );
      scene.runFrame();

      expect(scene.input().getPush()).toBeNull();
    });

    it('tells a push-end subscriber when a resume ends the push', async () => {
      const scene = await renderScene({ scrollPush: true });
      const onPushEnd = vi.fn();

      scene.input().onPushEnd(onPushEnd);
      fireTouch(scene.canvas, 'touchstart');
      scene.rerender(
        <ShaderScene paused scrollPush>
          <scene.Reader />
        </ShaderScene>,
      );
      expect(onPushEnd).not.toHaveBeenCalled();
      scene.rerender(
        <ShaderScene scrollPush>
          <scene.Reader />
        </ShaderScene>,
      );

      expect(onPushEnd).toHaveBeenCalledTimes(1);
    });

    it('pushes nothing on resume from a touch that landed while the scene was paused', async () => {
      const scene = await renderScene({ scrollPush: true });

      scene.rerender(
        <ShaderScene paused scrollPush>
          <scene.Reader />
        </ShaderScene>,
      );
      fireTouch(scene.canvas, 'touchstart');
      // The page scrolls a long way under the finger while the loop is paused.
      scene.scrollTo(-400);
      scene.rerender(
        <ShaderScene scrollPush>
          <scene.Reader />
        </ShaderScene>,
      );
      scene.runFrame();

      expect(scene.input().getPush()).toBeNull();
    });
  });

  describe('strokeAt', () => {
    // A point code moves, shaped like an animation signal such as Motion's
    // MotionValue.
    const createPoint = (initial: Vector2) => {
      let value = initial;
      const listeners = new Set<(next: Vector2) => void>();

      return {
        get: () => value,
        on: (_event: 'change', listener: (next: Vector2) => void) => {
          listeners.add(listener);

          return () => listeners.delete(listener);
        },
        set: (next: Vector2) => {
          value = next;
          for (const listener of listeners) listener(next);
        },
      };
    };

    type Point = ReturnType<typeof createPoint>;

    // Renders one scene that strokes along `point`, with a child that reads
    // the shared cursor input. With `votesIdle`, the child also votes the
    // scene static, so the loop can park.
    async function renderScene(point: Point | null, { votesIdle = false } = {}) {
      const frames = captureFrames();
      const inputs: CursorInput[] = [];

      function Reader() {
        const shaderContext = useShaderContext();

        useStaticSceneHint(votesIdle);
        if (shaderContext) inputs.push(shaderContext.getCursorInput());

        return null;
      }

      const view = render(
        <ShaderScene strokeAt={point}>
          <Reader />
        </ShaderScene>,
      );

      await waitFor(() => expect(inputs.length).toBeGreaterThan(0));
      let now = 0;
      const runFrame = () => {
        now += 16;
        runFrames(frames, now);
      };
      const runUntilParked = () => {
        for (let frame = 0; frame < 50 && frames.length > 0; frame += 1) runFrame();
      };

      return { ...view, Reader, frames, input: () => inputs.at(-1)!, runFrame, runUntilParked };
    }

    it('strokes the cursor input along the point, without scrollPush', async () => {
      const point = createPoint([0.2, 0.8]);
      const scene = await renderScene(point);

      scene.runFrame();
      point.set([0.3, 0.7]);
      scene.runFrame();

      expect(scene.input().getScriptedStroke()).toEqual({
        from: [0.2, 0.8],
        to: [0.3, 0.7],
        presence: 1,
      });
    });

    it('wakes a parked scene when the point moves, and parks once it rests', async () => {
      const point = createPoint([0.2, 0.8]);
      const scene = await renderScene(point, { votesIdle: true });

      scene.runUntilParked();
      expect(scene.frames).toHaveLength(0);

      point.set([0.3, 0.7]);
      expect(scene.frames.length).toBeGreaterThan(0);
      scene.runFrame();
      expect(scene.input().getScriptedStroke()).not.toBeNull();

      scene.runUntilParked();
      expect(scene.frames).toHaveLength(0);
    });

    it('starts a fresh stroke on resume, so no segment spans the pause', async () => {
      const point = createPoint([0.2, 0.8]);
      const scene = await renderScene(point);

      scene.runFrame();
      scene.rerender(
        <ShaderScene paused strokeAt={point}>
          <scene.Reader />
        </ShaderScene>,
      );
      // The point travels a long way while the loop is paused.
      point.set([0.9, 0.1]);
      scene.rerender(
        <ShaderScene strokeAt={point}>
          <scene.Reader />
        </ShaderScene>,
      );
      scene.runFrame();
      expect(scene.input().getScriptedStroke()).toBeNull();

      point.set([0.8, 0.2]);
      scene.runFrame();
      expect(scene.input().getScriptedStroke()).toEqual({
        from: [0.9, 0.1],
        to: [0.8, 0.2],
        presence: 1,
      });
    });

    // A resize clears what the stroke drew, such as CursorSmudge's field,
    // so a segment that started before it would land in a fresh field.
    it('starts a fresh stroke after the canvas resizes', async () => {
      const fireResize = stubResizeObserver();
      const point = createPoint([0.2, 0.8]);
      const scene = await renderScene(point);
      const canvas = scene.container.querySelector('canvas')!;

      scene.runFrame();
      point.set([0.3, 0.7]);
      Object.defineProperty(canvas, 'clientWidth', { value: 640, configurable: true });
      fireResize();
      scene.runFrame();

      expect(scene.input().getScriptedStroke()).toBeNull();
    });

    it('lifts the stroke when the point goes, without rebuilding the renderer', async () => {
      vi.mocked(createRenderer).mockClear();
      const point = createPoint([0.2, 0.8]);
      const scene = await renderScene(point, { votesIdle: true });

      scene.runUntilParked();
      scene.rerender(
        <ShaderScene strokeAt={null}>
          <scene.Reader />
        </ShaderScene>,
      );
      point.set([0.3, 0.7]);

      expect(scene.input().isScripting()).toBe(false);
      expect(scene.frames).toHaveLength(0);
      expect(createRenderer).toHaveBeenCalledTimes(1);
    });
  });
});
