'use client';

import { type CSSProperties, type ReactNode, useContext, useEffect, useRef, useState } from 'react';

import {
  createIntersectionWatcher,
  createRenderer,
  createVisibilityWatcher,
  dither,
  FrameScheduler,
  resetRendererClock,
} from '@lovo/matter';
import { OrthographicCamera, Scene } from 'three';
import { pass, renderOutput, vec4 } from 'three/tsl';
import { PostProcessing } from 'three/webgpu';

import {
  type PostProcessTransform,
  ShaderContext,
  type ShaderContextValue,
} from '../../context/shader-context.js';
import { MatterError } from '../../errors/matter-error.js';
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
  /** Fires once with a typed MatterError when renderer init fails. */
  onError?: (error: MatterError) => void;
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
  const [error, setError] = useState<MatterError | null>(null);
  const onFirstPaintRef = useRef(onFirstPaint);
  const onErrorRef = useRef(onError);
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

    const setup = async () => {
      setError(null);
      try {
        const renderer = await createRenderer(canvas, { maxDPR, gamut: resolvedGamut });

        if (cancelled) {
          renderer.dispose();

          return;
        }
        const scene = new Scene();
        const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

        camera.position.z = 1;
        const postProcessing = new PostProcessing(renderer.three);

        // Take ownership of the output color transform so we can dither in
        // display-encoded space (see rebuildOutputNode below).
        postProcessing.outputColorTransform = false;
        const scheduler = new FrameScheduler();

        const overlays = new Map<symbol, PostProcessTransform>();

        const basePassNode = vec4(pass(scene, camera));

        const rebuildOutputNode = () => {
          // Overlays (Grain, Vignette, ...) compose in linear working space.
          const composed = Array.from(overlays.values()).reduce(
            (currentPipeline, transform) => transform(currentPipeline),
            basePassNode,
          );

          // renderOutput applies tone mapping + the working->output color-space
          // transfer (it reads both from the context three sets because
          // outputColorTransform is false), so dither runs last, in
          // display-encoded space, right before 8-bit quantization. This breaks
          // up gradient banding uniformly across every component in the scene.
          postProcessing.outputNode = dither(renderOutput(composed));
          postProcessing.needsUpdate = true;
        };

        rebuildOutputNode(); // initial: just basePass, no overlays

        const registerOverlay = (transform: PostProcessTransform): (() => void) => {
          const key = Symbol('overlay');

          overlays.set(key, transform);
          rebuildOutputNode();

          return () => {
            overlays.delete(key);
            rebuildOutputNode();
          };
        };

        // Signal "first paint" only once the scene actually has something to
        // draw (a base shader mesh, or at least an overlay pass) — the scheduler
        // renders empty frames before the child shader mounts its mesh, and we
        // don't want to drop the enclosing poster over an empty canvas. Defer the
        // state flip by one rAF so the just-submitted frame composites before the
        // poster is removed.
        let firstPaintSignaled = false;
        const renderFrame = () => {
          const hasContent = scene.children.length > 0 || overlays.size > 0;

          // On the frame that first has something to draw, zero the clock BEFORE
          // rendering so the frame the user first sees (once the poster drops)
          // is t=0 — matching the deterministic poster. Resetting after the
          // poster is already gone would pop the animation backwards from
          // warmup-time to 0, a new visible glitch.
          if (!firstPaintSignaled && hasContent) {
            resetRendererClock(renderer.three);
          }
          postProcessing.render();

          if (!firstPaintSignaled && hasContent) {
            firstPaintSignaled = true;
            firstPaintRaf = requestAnimationFrame(() => {
              firstPaintRaf = null;
              if (!cancelled) {
                posterControls?.setShaderPainted(true);
                onFirstPaintRef.current?.();
              }
            });
          }
        };

        scheduler.add(renderFrame);
        scheduler.start();

        const visibility = createVisibilityWatcher();
        const intersection = createIntersectionWatcher(canvas);

        const updatePauseState = () => {
          const shouldRun = visibility.isVisible() && intersection.isInView();

          if (shouldRun) scheduler.resume();
          else scheduler.pause();
        };

        updatePauseState();

        const unsubVisibility = visibility.subscribe(updatePauseState);
        const unsubIntersection = intersection.subscribe(updatePauseState);

        // Track the canvas's actual box size, not just window 'resize'. The
        // canvas commonly gets its real size from layout AFTER renderer init
        // (with no window resize firing), which would otherwise leave the
        // renderer stuck at the default 300x150 and render the scene into an
        // undersized target — compressing every shader's output. ResizeObserver
        // fires once on observe() and on every subsequent box change.
        const resizeObserver = new ResizeObserver(() => renderer.resize());

        resizeObserver.observe(canvas);

        cleanup = () => {
          unsubVisibility();
          unsubIntersection();
          visibility.dispose();
          intersection.dispose();
          resizeObserver.disconnect();
          scheduler.dispose();
          renderer.dispose();
        };

        setShaderContext({ renderer, scene, camera, scheduler, registerOverlay });
      } catch (caughtError) {
        if (cancelled) return;
        const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
        const matterError = new MatterError('renderer-init', message, { cause: caughtError });

        if (process.env.NODE_ENV !== 'production') {
          console.error('[ShaderScene] renderer init failed:', matterError);
        }
        try {
          onErrorRef.current?.(matterError);
        } catch (handlerError) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[ShaderScene] onError handler threw:', handlerError);
          }
        }
        setError(matterError);
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

  let content: ReactNode;

  if (error) {
    // Init failed. Render nothing — the canvas stays transparent. A wrapping
    // ShaderPoster keeps its poster up (first paint never fired), which is the
    // intended visible degradation. Consumers observe the failure via onError.
    content = null;
  } else {
    // Mount the children as soon as the context exists so the shader can build
    // and paint. The children render no visible DOM of their own (they drive
    // the canvas); an enclosing ShaderPoster keeps its poster overlaid until
    // this scene signals its first painted content frame.
    content = shaderContext ? (
      <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>
    ) : null;
  }

  return (
    <div className={className} style={{ ...defaultStyle, ...style }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {content}
    </div>
  );
}
