'use client';

// Mode 1's heart. <ShaderScene> owns everything the shader components can't
// own themselves: the canvas, the renderer (WebGPU with WebGL2 fallback),
// ONE three.js scene that all children mount their meshes into, the
// post-process chain overlays register with, the render-on-demand frame
// loop and its frame cap, and the pause behaviors (hidden tab, off-screen
// canvas, and the `paused` prop). Children receive all of it through
// ShaderContext and render no DOM of their own — composition is stacking
// children, painting into this one scene. One effect owns that whole
// lifecycle; the helpers below the component are its steps.
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { OrthographicCamera, Scene } from 'three';

import {
  createOutputStage,
  createPauseWatcher,
  createRenderer,
  CursorInput,
  FrameScheduler,
  type GpuRenderer,
  holdRendererClock,
  type OutputStage,
  resetRendererClock,
} from '../../../engine.js';
import { createCanvasSize, type ResizeSignal } from '../../../inputs/canvas-size/canvas-size.js';
import { ShaderContext, type ShaderContextValue } from '../../context/shader-context.js';
import { ShadersError } from '../../errors/shaders-error.js';
import {
  type GamutPreference,
  useDisplayGamut,
} from '../../hooks/use-display-gamut/use-display-gamut.js';
import { PosterContext } from '../shader-poster/poster-context.js';

export interface ShaderSceneProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /**
   * The most canvas pixels the scene draws along each side of a CSS pixel.
   * A display with a higher pixel ratio gets this one, and the browser
   * scales the canvas up. A change rebuilds the renderer. Defaults to 2.
   */
  maxDPR?: number;
  /**
   * Sets the frame cap, the most frames per second the scene draws. Pick a
   * divisor of the display's refresh rate, such as 60 on a 120 Hz display,
   * which draws every other frame. A cap up to a tenth below a divisor draws
   * at the divisor. A change applies from the next frame. Defaults to no
   * frame cap, which draws at the display's refresh rate.
   */
  maxFPS?: number;
  /** Output color gamut. 'auto' (default) uses the widest the display supports. */
  gamut?: GamutPreference;
  /** Fires once, on the frame after the shader's first content frame is on screen. */
  onFirstPaint?: () => void;
  /** Fires once with a typed ShadersError when renderer init fails. */
  onError?: (error: ShadersError) => void;
  /**
   * Freezes the scene on its current frame. Time stops while the scene is
   * paused, so it resumes from the frame it stopped on. A scene paused before
   * its first frame draws nothing until it resumes. Defaults to false.
   */
  paused?: boolean;
}

const defaultStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'block',
  width: '100%',
  height: '100%',
};

export function ShaderScene({
  children,
  className,
  style,
  maxDPR,
  maxFPS,
  gamut = 'auto',
  onFirstPaint,
  onError,
  paused = false,
}: ShaderSceneProps) {
  const resolvedGamut = useDisplayGamut(gamut);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shaderContext, setShaderContext] = useState<ShaderContextValue | null>(null);
  const onFirstPaintRef = useRef(onFirstPaint);
  const onErrorRef = useRef(onError);
  // onError's "fires once" contract holds per scene instance: the setup effect
  // re-runs on dep changes (gamut, maxDPR), and a persistently failing init
  // would otherwise re-notify on every re-run.
  const errorFiredRef = useRef(false);
  const pausedProp = useLiveProp(paused, applyPaused);
  const maxFPSProp = useLiveProp(maxFPS, applyMaxFPS);
  // Poster boundary controls, when a ShaderPoster wraps this scene. The value
  // is memoized stable by ShaderPoster, so listing it in the setup effect's
  // deps does not cause renderer rebuilds. Null (a no-op below) when the
  // scene is used without a poster.
  const posterControls = useContext(PosterContext);

  useEffect(() => {
    onFirstPaintRef.current = onFirstPaint;
  }, [onFirstPaint]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;
    let firstPaintRaf: number | null = null;

    // Runs once the frame loop has submitted the first frame with content in
    // it. Defer the poster drop and onFirstPaint by one rAF so that frame
    // composites before the poster is removed.
    const signalFirstPaint = () => {
      firstPaintRaf = requestAnimationFrame(() => {
        firstPaintRaf = null;
        if (!cancelled) {
          posterControls?.setShaderPainted(true);
          onFirstPaintRef.current?.();
        }
      });
    };

    const setup = async () => {
      try {
        const renderer = await createRenderer(canvas, { maxDPR, gamut: resolvedGamut });

        if (cancelled) {
          renderer.dispose();

          return;
        }
        const { scene, camera } = createFullScreenView();
        // The output stage owns the base pass, the post-process chain the
        // overlays register with, and the full-screen quad that writes the
        // canvas. output-stage.ts says why it is ours rather than three's
        // PostProcessing.
        const outputStage = createOutputStage(renderer.three, scene, camera);
        const scheduler = new FrameScheduler();
        const detachMaxFPSProp = maxFPSProp.attach(scheduler);

        const frameRenderer = createFrameRenderer(
          renderer,
          scene,
          outputStage,
          scheduler,
          signalFirstPaint,
        );

        scheduler.add(frameRenderer.render);
        scheduler.start();

        const pausedClock = holdClockWhilePaused(renderer, scheduler);
        const canvasWatch = watchCanvas(
          canvas,
          renderer,
          scheduler,
          createRedrawer(frameRenderer, pausedClock, outputStage),
        );

        const detachPausedProp = pausedProp.attach(canvasWatch);
        const cursorInput = createLazyCursorInput(canvas);

        cleanup = () => {
          detachMaxFPSProp();
          detachPausedProp();
          pausedClock.stop();
          canvasWatch.stop();
          cursorInput.dispose();
          scheduler.dispose();
          outputStage.dispose();
          renderer.dispose();
        };

        // Publishing the context is what lets children mount their meshes —
        // until this state lands, every child hook sees null and no-ops.
        setShaderContext({
          renderer,
          scene,
          camera,
          scheduler,
          registerOverlay: outputStage.registerOverlay,
          registerBaseUvTransform: outputStage.registerBaseUvTransform,
          registerPrePass: outputStage.registerPrePass,
          getCursorInput: cursorInput.get,
          canvasSize: canvasWatch.canvasSize,
          timeGpu: outputStage.timeGpu,
        });
      } catch (caughtError) {
        if (cancelled) return;
        reportInitFailure(caughtError, errorFiredRef, onErrorRef);
      }
    };

    void setup();

    return () => {
      cancelled = true;
      if (firstPaintRaf !== null) {
        cancelAnimationFrame(firstPaintRaf);
        firstPaintRaf = null;
      }
      cleanup?.();
      cleanup = null;
      setShaderContext(null);
      // A fresh renderer (e.g. on gamut change) must re-prove its first paint,
      // so re-arm the enclosing poster until it does.
      posterControls?.setShaderPainted(false);
    };
  }, [maxDPR, resolvedGamut, posterControls, pausedProp, maxFPSProp]);

  // Mount the children as soon as the context exists so the shader can build
  // and paint. The children render no visible DOM of their own (they drive
  // the canvas); an enclosing ShaderPoster keeps its poster overlaid until
  // this scene signals its first painted content frame.
  //
  // On init failure the context never materializes, so this stays null and the
  // canvas stays transparent. A wrapping ShaderPoster keeps its poster up
  // (first paint never fired), which is the intended visible degradation.
  // Consumers observe the failure via onError.
  const content: ReactNode = shaderContext ? (
    <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>
  ) : null;

  return (
    <div className={className} style={{ ...defaultStyle, ...style }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {content}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Props the running scene takes without a rebuild: `paused` and `maxFPS`
// ----------------------------------------------------------------------------

interface LiveProp<Target> {
  attach: (target: Target) => () => void;
}

/**
 * Carries a prop to a part of the scene that the setup effect builds, such
 * as the canvas watcher, without rebuilding the renderer when the prop
 * changes. `attach` applies the current value to a new part and keeps it
 * current through later prop changes, and the function it returns lets go.
 * `apply` must keep its identity across renders, as the module-level
 * functions below do.
 */
function useLiveProp<Target, Value>(
  value: Value,
  apply: (target: Target, value: Value) => void,
): LiveProp<Target> {
  const valueRef = useRef(value);
  const targetRef = useRef<Target | null>(null);

  useEffect(() => {
    valueRef.current = value;
    if (targetRef.current !== null) apply(targetRef.current, value);
  }, [value, apply]);

  return useMemo(
    () => ({
      attach(target) {
        apply(target, valueRef.current);
        targetRef.current = target;

        return () => {
          targetRef.current = null;
        };
      },
    }),
    [apply],
  );
}

const applyPaused = (canvasWatch: CanvasWatch, paused: boolean) => canvasWatch.setPaused(paused);

const applyMaxFPS = (scheduler: FrameScheduler, maxFPS: number | undefined) =>
  scheduler.setMaxFPS(maxFPS);

// ----------------------------------------------------------------------------
// The view: one scene and a camera that frames it edge to edge
// ----------------------------------------------------------------------------

/**
 * A flat orthographic view spanning -1..1 both ways — the reason every
 * registry component's 2x2 plane exactly fills the canvas.
 */
function createFullScreenView(): { scene: Scene; camera: OrthographicCamera } {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

  camera.position.z = 1;

  return { scene, camera };
}

// ----------------------------------------------------------------------------
// The frame loop's one job: render, and spot the first frame with content
// ----------------------------------------------------------------------------

interface FrameRenderer {
  /** The callback the scheduler runs each frame. */
  render: () => void;
  /**
   * Whether the loop has rendered a frame with content yet, which is what a
   * resize redraws. A scene paused from its mount, or paused after only the
   * empty frames before its child mounted, has none.
   */
  hasRenderedContent: () => boolean;
}

/**
 * The scheduler's per-frame callback. It calls `onFirstContentFrame` once,
 * on the first frame that has something to draw: a base shader mesh, or at
 * least an overlay pass. The scheduler renders empty frames before the child
 * shader mounts its mesh, and the enclosing poster must not drop over an
 * empty canvas.
 */
function createFrameRenderer(
  renderer: GpuRenderer,
  scene: Scene,
  outputStage: OutputStage,
  scheduler: FrameScheduler,
  onFirstContentFrame: () => void,
): FrameRenderer {
  let firstPaintSignaled = false;

  const render = () => {
    const hasContent = scene.children.length > 0 || outputStage.hasOverlays();

    // On the frame that first has something to draw, rewind BOTH time
    // sources BEFORE rendering so the frame the user first sees (once
    // the poster drops) is t=0 — matching the deterministic poster:
    // the renderer clock (elapsedTime) and the CPU-side phase
    // accumulators (useAnimatableSpeed), which integrate wall-clock
    // deltas from mount and would otherwise carry the renderer's init
    // latency into the first visible pose (sharp-geometry shaders like
    // Voronoi make that drift read as a poster that "doesn't line
    // up"). Resetting after the poster is already gone would pop the
    // animation backwards from warmup-time to 0, a new visible glitch.
    if (!firstPaintSignaled && hasContent) {
      resetRendererClock(renderer.three);
      scheduler.resetPhases();
    }
    outputStage.render();

    if (!firstPaintSignaled && hasContent) {
      firstPaintSignaled = true;
      onFirstContentFrame();
    }
  };

  return { render, hasRenderedContent: () => firstPaintSignaled };
}

// ----------------------------------------------------------------------------
// Paused time: hold three's clock while the loop is paused
// ----------------------------------------------------------------------------

/**
 * three runs its own animation loop, which advances its clock on every
 * animation frame whether this scene renders or not. The scheduler leaves
 * paused time out of its own ticks, and this holds three's clock at the time
 * the scene paused, so a resume, or a frame redrawn while paused, carries on
 * from the frame the scene stopped on. `restore` puts the held
 * time back, and does nothing while the scene runs.
 */
function holdClockWhilePaused(
  renderer: GpuRenderer,
  scheduler: FrameScheduler,
): { restore: () => void; stop: () => void } {
  let restoreHeldClock: (() => void) | null = null;

  const stop = scheduler.onPauseChange((nowPaused) => {
    if (nowPaused) {
      restoreHeldClock = holdRendererClock(renderer.three);

      return;
    }
    restoreHeldClock?.();
    restoreHeldClock = null;
  });

  return { restore: () => restoreHeldClock?.(), stop };
}

/**
 * Draws the scene's current frame again, for the canvas watcher to call
 * after a resize clears the canvas. A paused scene draws the frame it
 * stopped on, at the held time. A running scene draws at the current time,
 * and ticks no scheduler client, so no animation phase advances twice in
 * one frame. A scene whose loop drew no content yet has no frame to draw.
 */
function createRedrawer(
  frameRenderer: FrameRenderer,
  pausedClock: { restore: () => void },
  outputStage: OutputStage,
): () => void {
  return () => {
    if (!frameRenderer.hasRenderedContent()) return;
    pausedClock.restore();
    outputStage.render();
  };
}

// ----------------------------------------------------------------------------
// Watching the canvas: visibility and the `paused` prop pause the loop, box
// size drives the renderer
// ----------------------------------------------------------------------------

interface CanvasWatch {
  /** The canvas size, updated before each redraw, for the shader context. */
  canvasSize: ResizeSignal;
  /** Pause the loop for the `paused` prop, or hand it back to visibility. */
  setPaused: (paused: boolean) => void;
  /** Stop watching visibility and size, and drop the size's listeners. */
  stop: () => void;
}

/**
 * Pauses the loop while the tab is hidden, the canvas is out of view, or the
 * `paused` prop is set, and keeps the renderer and `canvasSize` sized to the
 * canvas. `redraw` renders one frame outside the loop, because a resize
 * clears the canvas.
 */
function watchCanvas(
  canvas: HTMLCanvasElement,
  renderer: GpuRenderer,
  scheduler: FrameScheduler,
  redraw: () => void,
): CanvasWatch {
  const canvasSize = createCanvasSize(canvas);
  // Subscribed before the pause watcher exists, because it pauses the loop
  // as it starts when the canvas is already out of view.
  let loopPaused = false;
  const stopWatchingLoop = scheduler.onPauseChange((nowPaused) => {
    loopPaused = nowPaused;
  });
  const pauseWatcher = createPauseWatcher(canvas, scheduler);
  let pausedByProp = false;

  // Track the canvas's actual box size, not just window 'resize'. The
  // canvas commonly gets its real size from layout AFTER renderer init
  // (with no window resize firing), which would otherwise leave the
  // renderer stuck at the default 300x150 and render the scene into an
  // undersized target — compressing every shader's output. ResizeObserver
  // fires once on observe() and on every subsequent box change.
  //
  // The browser runs this callback after layout and before it paints, and
  // the resize has just cleared the canvas. The loop's frame for this
  // animation frame ran before layout, so without a redraw here the browser
  // paints the cleared canvas, and a continuous resize, such as a window
  // drag or a scroll-driven size change, paints one on every frame. So the
  // scene redraws straight away, running or paused. canvasSize updates
  // first: the children's size and aspect uniforms are written from it, so
  // the redraw has them at the new size.
  //
  // A loop paused only because the canvas is out of view or the tab is
  // hidden skips the redraw, since no one can see it. It asks for a frame
  // instead, which the loop draws at the new size once it resumes: a static
  // scene's loop has parked and would otherwise never draw again. A scene
  // paused by its prop has no loop to draw it, so it redraws even out of
  // view.
  const resizeObserver = new ResizeObserver(() => {
    renderer.resize();
    canvasSize.update();
    if (loopPaused && !pausedByProp) {
      scheduler.requestRender();

      return;
    }
    redraw();
  });

  resizeObserver.observe(canvas);

  return {
    canvasSize: canvasSize.signal,
    setPaused(paused) {
      pausedByProp = paused;
      pauseWatcher.setPaused(paused);
    },
    stop() {
      pauseWatcher.dispose();
      stopWatchingLoop();
      resizeObserver.disconnect();
      canvasSize.dispose();
    },
  };
}

// ----------------------------------------------------------------------------
// The pointer: one cursor Input per scene, built on first ask
// ----------------------------------------------------------------------------

/**
 * The scene's one pointer Input, normalized to this canvas, so every useCursor
 * call inside reads the same pointer. `get` creates it on the first ask, so a
 * scene with no cursor consumer never attaches a window listener. `dispose`
 * releases it if it was ever created.
 */
function createLazyCursorInput(canvas: HTMLCanvasElement): {
  get: () => CursorInput;
  dispose: () => void;
} {
  let cursorInput: CursorInput | null = null;

  return {
    get: () => {
      cursorInput ??= new CursorInput({ element: canvas });

      return cursorInput;
    },
    dispose: () => cursorInput?.dispose(),
  };
}

// ----------------------------------------------------------------------------
// Init failure: log it, and tell onError once per scene
// ----------------------------------------------------------------------------

/**
 * Wraps a renderer init failure in a typed ShadersError, logs it outside
 * production, and hands it to onError unless this scene already has. A
 * throwing onError handler is logged and swallowed.
 */
function reportInitFailure(
  caughtError: unknown,
  errorFiredRef: RefObject<boolean>,
  onErrorRef: RefObject<((error: ShadersError) => void) | undefined>,
): void {
  const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
  const matterError = new ShadersError('renderer-init', message, { cause: caughtError });

  if (process.env.NODE_ENV !== 'production') {
    console.error('[ShaderScene] renderer init failed:', matterError);
  }
  if (errorFiredRef.current) return;
  errorFiredRef.current = true;
  try {
    onErrorRef.current?.(matterError);
  } catch (handlerError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ShaderScene] onError handler threw:', handlerError);
    }
  }
}
