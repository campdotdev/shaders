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
  type OverlayTransform,
  ShaderContext,
  type ShaderContextValue,
} from '../../context/shader-context.js';

export interface ShaderSceneProps {
  children?: ReactNode;
  fallback?: ReactNode;
  className?: string;
  style?: CSSProperties;
  maxDPR?: number;
}

const defaultStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'block',
  width: '100%',
  height: '100%',
};

export function ShaderScene(props: ShaderSceneProps) {
  const { children, fallback, className, style, maxDPR } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<ShaderContextValue | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const setup = async () => {
      try {
        const renderer = await createRenderer(canvas, { maxDPR });

        if (cancelled) {
          renderer.dispose();

          return;
        }
        const scene = new Scene();
        const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

        camera.position.z = 1;
        const postProcessing = new PostProcessing(renderer.three);
        const scheduler = new FrameScheduler();

        const overlays = new Map<symbol, OverlayTransform>();

        const basePass = pass(scene, camera);

        const rebuildOutputNode = () => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          const seed = basePass as unknown as ShaderNodeObject<Node>;

          postProcessing.outputNode = Array.from(overlays.values()).reduce(
            (node, transform) => transform(node),
            seed,
          );
          postProcessing.needsUpdate = true;
        };

        rebuildOutputNode(); // initial: just basePass, no overlays

        const registerOverlay = (transform: OverlayTransform): (() => void) => {
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

        const onResize = () => renderer.resize();

        window.addEventListener('resize', onResize);

        cleanup = () => {
          unsubVisibility();
          unsubIntersection();
          visibility.dispose();
          intersection.dispose();
          window.removeEventListener('resize', onResize);
          scheduler.dispose();
          renderer.dispose();
        };

        setCtx({ renderer, scene, camera, scheduler, registerOverlay });
      } catch (err) {
        if (cancelled) return;
        const e = err instanceof Error ? err : new Error(String(err));

        console.error('[ShaderScene] renderer init failed:', e);
        setError(e);
      }
    };

    void setup();

    return () => {
      cancelled = true;
      cleanup?.();
      cleanup = null;
      setCtx(null);
    };
  }, [maxDPR]);

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
  } else if (ctx) {
    content = <ShaderContext.Provider value={ctx}>{children}</ShaderContext.Provider>;
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
