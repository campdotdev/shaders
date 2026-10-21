'use client';

/**
 * The Reactive card's live scene: its LiquidGradient, held still, and a
 * CursorSmudge that holds a smudge along the J path (reactive-smudge.ts).
 * After the scene's first frame, a scripted stroke lays the J, and the
 * still frame is ready once it lands. The illustration sets the smudge's
 * decay for its story, and can stroke it too, as the arrow flies. With
 * scroll push on, a touch that scrolls the page over the card stirs the
 * smudge, and the scene reports each push's start and end. A resize while
 * the card rests lays the J again. The J's stroke pauses with the scene's
 * loop (scene-pause.ts), and the scene reports each pause, so the
 * illustration's own timed legs can pause with it too.
 * reactive-illustration.tsx loads this module with import() from an
 * effect, which keeps three out of the server render (the SSR gotcha in
 * docs/agents/docs-site.md).
 */
import { useEffect, useRef, useState } from 'react';

import { CursorSmudge, LiquidGradient, ShaderScene, useShaderContext } from '@camp-dev/shaders';
import { animate, type MotionValue, motionValue } from 'motion/react';

import { EASE_OUT } from '@/lib/easing';

import { REACTIVE_GRADIENT } from './reactive-gradient';
import { pointOnJ, REACTIVE_SMUDGE } from './reactive-smudge';
import { createScenePause } from './scene-pause';

export interface ReactiveSceneProps {
  /**
   * Fires with true once the J's smudge is laid and the scene shows the
   * still frame, and with false whenever it lays the J again: after a new
   * renderer's first frame, or a resize while the card rests. Fires with
   * false as the scene unmounts, too.
   */
  onStillFrameChange: (ready: boolean) => void;
  /**
   * Fires with true when the scene pauses its loop, off screen or in a
   * hidden tab, and with false when it resumes. Fires with false as the
   * scene unmounts, so a pause never outlives it.
   */
  onPausedChange: (paused: boolean) => void;
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
 * Passes the scene's pauses on. A child of the scene, because only the
 * scene's own context reaches its scheduler.
 */
function PauseEvents({ onChange }: { onChange: (paused: boolean) => void }) {
  const context = useShaderContext();
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!context) return undefined;
    const report = (paused: boolean) => onChangeRef.current(paused);
    const stopWatching = context.scheduler.onPauseChange(report);

    return () => {
      stopWatching();
      report(false);
    };
  }, [context]);

  return null;
}

/**
 * Lays the J again when the canvas resizes while the card rests: a resize
 * clears CursorSmudge's field, and with it the still frame's smudge. That
 * includes a resize while the J lays, which clears what it has laid so far.
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
  onPausedChange,
  decay,
  strokeAt,
  resting,
  onPushStart,
  onPushEnd,
}: ReactiveSceneProps) {
  // The point of the J's stroke under way, or null while none lays. Each
  // lay has a point of its own, so a lay that starts over attaches a fresh
  // stroke at the J's foot rather than going on from where the last left
  // off.
  const [layPoint, setLayPoint] = useState<MotionValue<[number, number]> | null>(null);
  const [scenePause] = useState(createScenePause);
  // The latest callbacks, so a new one from the parent doesn't restart the stroke.
  const callbacksRef = useRef({ onStillFrameChange, onPausedChange });

  useEffect(() => {
    callbacksRef.current = { onStillFrameChange, onPausedChange };
  });

  // The scene attaches the point in an effect of its own when the lay
  // starts, reading the J's foot as the stroke's start. A child's effects
  // run before its parent's, so the stroke never runs ahead of the attach.
  useEffect(() => {
    if (!layPoint) return undefined;
    const controls = animate(0, 1, {
      duration: REACTIVE_SMUDGE.laySeconds,
      ease: EASE_OUT,
      onUpdate: (progress) => layPoint.set(pointOnJ(progress)),
    });

    void controls.then(() => {
      setLayPoint(null);
      callbacksRef.current.onStillFrameChange(true);
    });

    return scenePause.hold(controls);
  }, [layPoint, scenePause]);

  // A scene that unmounts takes its still frame with it, so a scene that
  // mounts later keeps the image up until it lays its own J.
  useEffect(() => {
    const dropStillFrame = () => callbacksRef.current.onStillFrameChange(false);

    return dropStillFrame;
  }, []);

  // The stroke starts on the first frame, once the scene and its cursor
  // input exist, so none of it is lost to the renderer starting up. A
  // rebuilt renderer draws a first frame of its own, and lays the J again,
  // as a resize does while the card rests.
  const layJ = () => {
    callbacksRef.current.onStillFrameChange(false);
    setLayPoint(motionValue(pointOnJ(0)));
  };

  // The J's stroke pauses with the scene, and the illustration hears of it.
  const reportPause = (paused: boolean) => {
    scenePause.setPaused(paused);
    callbacksRef.current.onPausedChange(paused);
  };

  return (
    <ShaderScene onFirstPaint={layJ} scrollPush strokeAt={layPoint ?? strokeAt}>
      {/* A literal 0 holds the flow still, so the scene parks whenever
          nothing strokes. */}
      <LiquidGradient {...REACTIVE_GRADIENT} speed={0} />
      <CursorSmudge
        decay={decay}
        radius={REACTIVE_SMUDGE.radius}
        strength={REACTIVE_SMUDGE.strength}
      />
      <PushEvents onEnd={onPushEnd} onStart={onPushStart} />
      <PauseEvents onChange={reportPause} />
      <RelayOnResize relay={layJ} resting={resting} />
    </ShaderScene>
  );
}
