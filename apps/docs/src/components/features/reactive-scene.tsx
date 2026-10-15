'use client';

/**
 * The Reactive card's live scene: its LiquidGradient, held still, and a
 * CursorSmudge that holds a smudge along the J path (reactive-smudge.ts).
 * After the scene's first frame, a scripted stroke lays the J, and the
 * still frame is ready once it lands. reactive-illustration.tsx loads this
 * module with import() from an effect, which keeps three out of the server
 * render (the SSR gotcha in docs/agents/docs-site.md).
 */
import { useEffect, useRef, useState } from 'react';

import { CursorSmudge, LiquidGradient, ShaderScene } from '@camp-dev/shaders';
import { animate, useMotionValue, useTransform } from 'motion/react';

import { EASE_OUT } from '@/lib/easing';

import { REACTIVE_GRADIENT, type ReactiveGradient } from './reactive-gradient';
import { pointOnJ, REACTIVE_SMUDGE, type ReactiveSmudge } from './reactive-smudge';

export interface ReactiveSceneProps {
  /** Fires once the J's smudge is laid and the scene shows the still frame. */
  onStillFrame: () => void;
  /** Settings in place of the card's, from the /dev/reactive-card tuning route. */
  gradient?: ReactiveGradient;
  /** Settings in place of the card's, from the /dev/reactive-card tuning route. */
  smudge?: ReactiveSmudge;
}

export default function ReactiveScene({
  onStillFrame,
  gradient = REACTIVE_GRADIENT,
  smudge = REACTIVE_SMUDGE,
}: ReactiveSceneProps) {
  const progress = useMotionValue(0);
  const point = useTransform(progress, pointOnJ);
  const [laying, setLaying] = useState(false);
  // The latest callback, so a new one from the parent doesn't restart the stroke.
  const onStillFrameRef = useRef(onStillFrame);

  useEffect(() => {
    onStillFrameRef.current = onStillFrame;
  });

  // The scene attaches the point in an effect of its own when `laying`
  // turns on, reading the J's foot as the stroke's start. A child's effects
  // run before its parent's, so the stroke never runs ahead of the attach.
  useEffect(() => {
    if (!laying) return undefined;
    const controls = animate(progress, 1, { duration: smudge.laySeconds, ease: EASE_OUT });

    void controls.then(() => {
      setLaying(false);
      onStillFrameRef.current();
    });

    return () => controls.stop();
  }, [laying, progress, smudge.laySeconds]);

  // The stroke starts on the first frame, once the scene and its cursor
  // input exist, so none of it is lost to the renderer starting up. A
  // rebuilt renderer draws a first frame of its own, and lays the J again.
  const layJ = () => {
    progress.set(0);
    setLaying(true);
  };

  return (
    <ShaderScene onFirstPaint={layJ} strokeAt={laying ? point : null}>
      {/* A literal 0 holds the flow still, so the scene parks whenever
          nothing strokes. */}
      <LiquidGradient {...gradient} speed={0} />
      {/* Decay 0 holds the smudge for good. */}
      <CursorSmudge decay={0} radius={smudge.radius} strength={smudge.strength} />
    </ShaderScene>
  );
}
