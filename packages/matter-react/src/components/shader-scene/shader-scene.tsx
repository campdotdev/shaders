'use client';

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';

import {
  createIntersectionWatcher,
  createRenderer,
  createVisibilityWatcher,
  FrameScheduler,
} from '@lovo/matter';
import { OrthographicCamera, Scene } from 'three';
import { pass } from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import { PostProcessing } from 'three/webgpu';
import type { Node } from 'three/webgpu';

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
}

const defaultStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'block',
  width: '100%',
  height: '100%',
};

export function ShaderScene(props: ShaderSceneProps) {
  const { children, fallback, className, style, maxDPR, gamut = 'auto' } = props;
  const resolvedGamut = useDisplayGamut(gamut);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shaderContext, setShaderContext] = useState<ShaderContextValue | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

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
        const scheduler = new FrameScheduler();

        const overlays = new Map<symbol, PostProcessTransform>();

        const basePass = pass(scene, camera);

        const rebuildOutputNode = () => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          const basePassNode = basePass as unknown as ShaderNodeObject<Node>;

          postProcessing.outputNode = Array.from(overlays.values()).reduce(
            (currentPipeline, transform) => transform(currentPipeline),
            basePassNode,
          );
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

        scheduler.add(() => postProcessing.render());
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
      cleanup?.();
      cleanup = null;
      setShaderContext(null);
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
  } else if (shaderContext) {
    content = <ShaderContext.Provider value={shaderContext}>{children}</ShaderContext.Provider>;
  } else {
    content = fallback ?? null;
  }

  return (
    <div className={className} style={{ ...defaultStyle, ...style }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {content}
    </div>
  );
}
