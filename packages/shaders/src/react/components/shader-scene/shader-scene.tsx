'use client';

// Mode 1's heart. <ShaderScene> owns everything the shader components can't
// own themselves: the canvas, the renderer (WebGPU with WebGL2 fallback),
// ONE three.js scene that all children mount their meshes into, the
// post-process chain overlays register with, the render-on-demand frame
// loop, and the pause behaviors (hidden tab, off-screen canvas). Children
// receive all of it through ShaderContext and render no DOM of their own —
// composition is stacking children, painting into this one scene. One effect
// owns that whole lifecycle; the helpers below the component are its steps.
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
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
  type OutputStage,
  resetRendererClock,
} from '../../../engine.js';
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
  maxDPR?: number;
  /** Output color gamut. 'auto' (default) uses the widest the display supports. */
  gamut?: GamutPreference;
  /** Fires once, on the frame after the shader's first content frame is on screen. */
  onFirstPaint?: () => void;
  /** Fires once with a typed ShadersError when renderer init fails. */
  onError?: (error: ShadersError) => void;
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
  gamut = 'auto',
  onFirstPaint,
  onError,
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

        scheduler.add(
          createFrameRenderer(renderer, scene, outputStage, scheduler, signalFirstPaint),
        );
        scheduler.start();

        const stopWatchingCanvas = watchCanvas(canvas, renderer, scheduler);
        const cursorInput = createLazyCursorInput(canvas);

        cleanup = () => {
          stopWatchingCanvas();
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
          getCursorInput: cursorInput.get,
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
  }, [maxDPR, resolvedGamut, posterControls]);

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

/**
 * The callback the scheduler runs each frame. It calls `onFirstContentFrame`
 * once, on the first frame that has something to draw: a base shader mesh, or
 * at least an overlay pass. The scheduler renders empty frames before the
 * child shader mounts its mesh, and the enclosing poster must not drop over an
 * empty canvas.
 */
function createFrameRenderer(
  renderer: GpuRenderer,
  scene: Scene,
  outputStage: OutputStage,
  scheduler: FrameScheduler,
  onFirstContentFrame: () => void,
): () => void {
  let firstPaintSignaled = false;

  return () => {
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
}

// ----------------------------------------------------------------------------
// Watching the canvas: visibility pauses the loop, box size drives the renderer
// ----------------------------------------------------------------------------

/**
 * Parks the loop while the tab is hidden or the canvas is out of view, and
 * keeps the renderer sized to the canvas. Returns the function that stops both.
 */
function watchCanvas(
  canvas: HTMLCanvasElement,
  renderer: GpuRenderer,
  scheduler: FrameScheduler,
): () => void {
  const pauseWatcher = createPauseWatcher(canvas, scheduler);

  // Track the canvas's actual box size, not just window 'resize'. The
  // canvas commonly gets its real size from layout AFTER renderer init
  // (with no window resize firing), which would otherwise leave the
  // renderer stuck at the default 300x150 and render the scene into an
  // undersized target — compressing every shader's output. ResizeObserver
  // fires once on observe() and on every subsequent box change.
  const resizeObserver = new ResizeObserver(() => renderer.resize());

  resizeObserver.observe(canvas);

  return () => {
    pauseWatcher.dispose();
    resizeObserver.disconnect();
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
