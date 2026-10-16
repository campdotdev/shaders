'use client';

/**
 * The Reactive card's live scene: its LiquidGradient, held still, and a
 * CursorSmudge that holds a smudge along the J path (reactive-smudge.ts).
 * After the scene's first frame, a scripted stroke lays the J, and the
 * still frame is ready once it lands. The illustration sets the smudge's
 * decay for its story, and can stroke it too, as the arrow flies. With
 * scroll push on, a touch that scrolls the page over the card stirs the
 * smudge, and the scene reports each push's start and end. A resize while
 * the card rests lays the J again.
 * reactive-illustration.tsx loads this module with import() from an
 * effect, which keeps three out of the server render (the SSR gotcha in
 * docs/agents/docs-site.md).
 */
import { useEffect, useRef, useState } from 'react';

import { CursorSmudge, LiquidGradient, ShaderScene, useShaderContext } from '@camp-dev/shaders';
import { animate, type MotionValue, useMotionValue, useTransform } from 'motion/react';

import { EASE_OUT } from '@/lib/easing';

import { REACTIVE_GRADIENT } from './reactive-gradient';
import { pointOnJ, REACTIVE_SMUDGE } from './reactive-smudge';

export interface ReactiveSceneProps {
  /**
   * Fires with true once the J's smudge is laid and the scene shows the
   * still frame, and with false whenever it lays the J again: after a new
   * renderer's first frame, or a resize while the card rests.
   */
  onStillFrameChange: (ready: boolean) => void;
  /** CursorSmudge's decay. 0 holds the smudge, as the still frame does. */
  decay: number;
  /**
   * A point that strokes the smudge, in 0..1 canvas units, or null while
   * nothing scripted strokes. The J's own stroke takes over while it lays.
   */
  strokeAt: MotionValue<[number, number]> | null;
  /** Whether the card rests on its still frame, so a resize lays the J again. */
  resting: boolean;
  /**
   * Fire when a touch that scrolls the page over the card first pushes the
   * smudge, and when its fling settles. A tap that never scrolls fires
   * neither.
   */
  onPushStart: () => void;
  onPushEnd: () => void;
}

/**
 * Passes the scene's scroll pushes on, from a push's first stroke to its
 * end. A child of the scene, because only the scene's own context reaches
 * its cursor input. A push under way when the scene goes, as a renderer
 * rebuild takes it, ends with it.
 */
function PushEvents({ onStart, onEnd }: { onStart: () => void; onEnd: () => void }) {
  const context = useShaderContext();
  const callbacksRef = useRef({ onStart, onEnd });

  useEffect(() => {
    callbacksRef.current = { onStart, onEnd };
  });

  useEffect(() => {
    if (!context) return undefined;
    const { scheduler } = context;
    const input = context.getCursorInput();
    let contact = false;
    let pushing = false;
    const end = () => {
      contact = false;
      if (!pushing) return;
      pushing = false;
      callbacksRef.current.onEnd();
    };
    // Runs after the input's own tick, which works out the frame's push.
    const watch = () => {
      if (!contact || pushing || !input.getPush()) return;
      pushing = true;
      callbacksRef.current.onStart();
    };
    const stopWatchingStart = input.onPushStart(() => {
      contact = true;
    });
    const stopWatchingEnd = input.onPushEnd(end);

    scheduler.add(watch);

    return () => {
      stopWatchingStart();
      stopWatchingEnd();
      scheduler.remove(watch);
      end();
    };
  }, [context]);

  return null;
}

/**
 * Lays the J again when the canvas resizes while the card rests: a resize
 * clears CursorSmudge's field, and with it the still frame's smudge.
 */
function RelayOnResize({ resting, relay }: { resting: boolean; relay: () => void }) {
  const context = useShaderContext();
  const latestRef = useRef({ resting, relay });

  useEffect(() => {
    latestRef.current = { resting, relay };
  });

  useEffect(() => {
    if (!context) return undefined;

    return context.canvasSize.on('change', () => {
      if (latestRef.current.resting) latestRef.current.relay();
    });
  }, [context]);

  return null;
}

export default function ReactiveScene({
  onStillFrameChange,
  decay,
  strokeAt,
  resting,
  onPushStart,
  onPushEnd,
}: ReactiveSceneProps) {
  const progress = useMotionValue(0);
  const point = useTransform(progress, pointOnJ);
  const [laying, setLaying] = useState(false);
  // The latest callback, so a new one from the parent doesn't restart the stroke.
  const onStillFrameChangeRef = useRef(onStillFrameChange);

  useEffect(() => {
    onStillFrameChangeRef.current = onStillFrameChange;
  });

  // The scene attaches the point in an effect of its own when `laying`
  // turns on, reading the J's foot as the stroke's start. A child's effects
  // run before its parent's, so the stroke never runs ahead of the attach.
  useEffect(() => {
    if (!laying) return undefined;
    const controls = animate(progress, 1, {
      duration: REACTIVE_SMUDGE.laySeconds,
      ease: EASE_OUT,
    });

    void controls.then(() => {
      setLaying(false);
      onStillFrameChangeRef.current(true);
    });

    return () => controls.stop();
  }, [laying, progress]);

  // The stroke starts on the first frame, once the scene and its cursor
  // input exist, so none of it is lost to the renderer starting up. A
  // rebuilt renderer draws a first frame of its own, and lays the J again,
  // as a resize does while the card rests.
  const layJ = () => {
    onStillFrameChangeRef.current(false);
    progress.set(0);
    setLaying(true);
  };

  return (
    <ShaderScene onFirstPaint={layJ} scrollPush strokeAt={laying ? point : strokeAt}>
      {/* A literal 0 holds the flow still, so the scene parks whenever
          nothing strokes. */}
      <LiquidGradient {...REACTIVE_GRADIENT} speed={0} />
      <CursorSmudge
        decay={decay}
        radius={REACTIVE_SMUDGE.radius}
        strength={REACTIVE_SMUDGE.strength}
      />
      <PushEvents onEnd={onPushEnd} onStart={onPushStart} />
      <RelayOnResize relay={layJ} resting={resting && !laying} />
    </ShaderScene>
  );
}
