'use client';

// Mode 1's heart. <ShaderScene> owns everything the shader components can't
// own themselves: the canvas, the renderer (WebGPU with WebGL2 fallback),
// ONE three.js scene that all children mount their meshes into, the
// post-process chain overlays register with, the render-on-demand frame
// loop, and the pause behaviors (hidden tab, off-screen canvas). Children
// receive all of it through ShaderContext and render no DOM of their own —
// composition is stacking children, painting into this one scene.
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
import type { ShaderNodeObject } from 'three/tsl';
import { pass, passTexture, renderOutput, uv, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { PostProcessing } from 'three/webgpu';

import {
  type PostProcessTransform,
  ShaderContext,
  type ShaderContextValue,
  type UvTransform,
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

    const setup = async () => {
      try {
        const renderer = await createRenderer(canvas, { maxDPR, gamut: resolvedGamut });

        if (cancelled) {
          renderer.dispose();

          return;
        }
        // A flat orthographic view spanning -1..1 both ways — the reason
        // every registry component's 2x2 plane exactly fills the canvas.
        const scene = new Scene();
        const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

        camera.position.z = 1;
        const postProcessing = new PostProcessing(renderer.three);

        // Take ownership of the output color transform so we can dither in
        // display-encoded space (see rebuildOutputNode below).
        postProcessing.outputColorTransform = false;
        const scheduler = new FrameScheduler();

        // The post-process chain: base pass first (the children's meshes
        // rendered to a texture), then each registered overlay transform in
        // MOUNT ORDER — a Map iterates in insertion order, so <Grain> after
        // <Vignette> grains the vignetted image. UV transforms warp where
        // the base pass texture is sampled (e.g. <Dither>'s pixel snap) and
        // compose in mount order too.
        const overlays = new Map<symbol, PostProcessTransform>();
        const uvTransforms = new Map<symbol, UvTransform>();

        const scenePass = pass(scene, camera);

        const rebuildOutputNode = () => {
          // With no UV transforms the pass node samples itself at the screen
          // coordinate as before. With any registered, resample its texture
          // at the warped coordinate — uv() here is the output quad's 0..1
          // screen position.
          // passTexture wraps the pass's color texture in a sampleable
          // TextureNode (getTextureNode's typing is too loose to chain .uv
          // from); its setup() still builds the pass itself, so the scene
          // renders even though only its texture appears in the graph.
          const scenePassTexture = passTexture(scenePass, scenePass.getTexture('output'));
          const basePassNode =
            uvTransforms.size === 0
              ? vec4(scenePass)
              : vec4(
                  scenePassTexture.uv(
                    Array.from(uvTransforms.values()).reduce<ShaderNodeObject<Node>>(
                      (coordinate, transform) => transform(coordinate),
                      uv(),
                    ),
                  ),
                );

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

        const registerBaseUvTransform = (transform: UvTransform): (() => void) => {
          const key = Symbol('uv-transform');

          uvTransforms.set(key, transform);
          rebuildOutputNode();

          return () => {
            uvTransforms.delete(key);
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
        // fires once on observe() and on every subsequent box change. Its
        // disconnect lives in the deferred `cleanup` closure below, not in a
        // direct effect return, because renderer init is async — which is
        // beyond the static analyzer's reach, hence the suppression.
        // react-doctor-disable-next-line react-doctor/effect-observer-needs-disconnect
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

        // Publishing the context is what lets children mount their meshes —
        // until this state lands, every child hook sees null and no-ops.
        setShaderContext({
          renderer,
          scene,
          camera,
          scheduler,
          registerOverlay,
          registerBaseUvTransform,
        });
      } catch (caughtError) {
        if (cancelled) return;
        const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
        const matterError = new MatterError('renderer-init', message, { cause: caughtError });

        if (process.env.NODE_ENV !== 'production') {
          console.error('[ShaderScene] renderer init failed:', matterError);
        }
        if (!errorFiredRef.current) {
          errorFiredRef.current = true;
          try {
            onErrorRef.current?.(matterError);
          } catch (handlerError) {
            if (process.env.NODE_ENV !== 'production') {
              console.error('[ShaderScene] onError handler threw:', handlerError);
            }
          }
        }
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
