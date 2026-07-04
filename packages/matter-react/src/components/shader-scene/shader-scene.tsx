'use client';

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';

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
import {
  type GamutPreference,
  useDisplayGamut,
} from '../../hooks/use-display-gamut/use-display-gamut.js';

export interface ShaderSceneProps {
  children?: ReactNode;
  fallback?: ReactNode;
  className?: string;
  style?: CSSProperties;
  maxDPR?: number;
  /** Output color gamut. 'auto' (default) uses the widest the display supports. */
  gamut?: GamutPreference;
  /** Fires once, on the frame after the shader's first content frame is on screen. */
  onFirstPaint?: () => void;
}

const defaultStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'block',
  width: '100%',
  height: '100%',
};

export function ShaderScene(props: ShaderSceneProps) {
  const { children, fallback, className, style, maxDPR, gamut = 'auto', onFirstPaint } = props;
  const resolvedGamut = useDisplayGamut(gamut);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shaderContext, setShaderContext] = useState<ShaderContextValue | null>(null);
  const [error, setError] = useState<Error | null>(null);
  // Stays false until the renderer has actually painted a frame containing the
  // shader. The fallback is held until then so there's no gap between dropping
  // the fallback and the first shader frame (which would otherwise flash the
  // canvas's clear state).
  const [firstFramePainted, setFirstFramePainted] = useState(false);
  const onFirstPaintRef = useRef(onFirstPaint);

  useEffect(() => {
    onFirstPaintRef.current = onFirstPaint;
  }, [onFirstPaint]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;
    let firstPaintRaf: number | null = null;

    const setup = async () => {
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
        // don't want to drop the fallback over an empty canvas. Defer the state
        // flip by one rAF so the just-submitted frame composites before the
        // fallback is removed.
        let firstPaintSignaled = false;
        const renderFrame = () => {
          const hasContent = scene.children.length > 0 || overlays.size > 0;

          // On the frame that first has something to draw, zero the clock BEFORE
          // rendering so the frame the user first sees (once the fallback drops)
          // is t=0 — matching the deterministic poster. Resetting after the
          // fallback is already gone would pop the animation backwards from
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
                setFirstFramePainted(true);
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
        const normalizedError =
          caughtError instanceof Error ? caughtError : new Error(String(caughtError));

        console.error('[ShaderScene] renderer init failed:', normalizedError);
        setError(normalizedError);
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
      // so show the fallback again until it does.
      setFirstFramePainted(false);
    };
  }, [maxDPR, resolvedGamut]);

  let content: ReactNode;

  if (error) {
    content = (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          color: '#fff',
          background: 'rgba(120, 30, 30, 0.85)',
          font: '0.85rem ui-monospace, monospace',
          whiteSpace: 'pre-wrap',
          textAlign: 'center',
        }}
      >
        ShaderScene init failed:
        {'\n'}
        {error.message}
      </div>
    );
  } else {
    // Mount the children as soon as the context exists so the shader can build
    // and paint, but keep the fallback overlaid on top until that first frame
    // lands. The children render no visible DOM of their own (they drive the
    // canvas), so the fallback sits above the canvas and is removed only once
    // the shader is actually on screen.
    content = (
      <>
        {shaderContext && (
          <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>
        )}
        {!firstFramePainted && (fallback ?? null)}
      </>
    );
  }

  return (
    <div className={className} style={{ ...defaultStyle, ...style }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {content}
    </div>
  );
}
