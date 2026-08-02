'use client';

// Turns the animatable `speed` prop into a phase uniform by integrating on
// the CPU: every scheduler tick adds speed x delta to a running total, and
// the shader reads that total instead of multiplying elapsed time by speed.
// The product form (time x speed) re-evaluates the whole elapsed history
// whenever speed changes, so the pattern visibly snaps; the integral form
// changes only the growth rate, so a speed change accelerates the pattern
// smoothly from wherever it is (MAT-66).
import { useEffect, useMemo, useRef } from 'react';

import { getReducedMotionTimeScale } from '@lovo/matter';
import type { SchedulerTick } from '@lovo/matter';
import { uniform } from 'three/tsl';

import { type AnimatableProp, isSignal } from '../animatable-signal/animatable-signal.js';
import { useShaderContext } from '../use-shader-context/use-shader-context.js';

// Longest slice of time one tick may contribute, in seconds. The scheduler
// reports real wall-clock deltas, so the first tick after a parked scene or
// a hidden tab carries the whole gap — accumulating it would snap the
// pattern forward by minutes at once, the exact jump this hook exists to
// remove. Normal frames (16-33ms) never come near the cap.
const MAX_DELTA = 0.1;

export function useAnimatableSpeed(
  speed: AnimatableProp<number>,
): ReturnType<typeof uniform<number>> {
  // Null outside a mounted <ShaderScene> (Mode 2, or a bare unit test).
  // No scheduler means no ticks, so the phase simply stays where it is.
  const shaderContext = useShaderContext();

  // Created once and NEVER replaced: materials capture this node when they
  // compile, so its identity has to survive re-renders — a fresh uniform
  // per render would force a material rebuild every time. Phase starts at
  // 0, which is also what time x speed evaluated to on a scene's first
  // frame, so first-paint output is unchanged.
  const phaseUniform = useMemo(() => uniform(0), []);

  // The current speed value, held in a ref so signal ticks land at
  // animation frequency without re-rendering anything. The integrator
  // below reads it fresh on every scheduler tick.
  const speedRef = useRef(isSignal(speed) ? speed.get() : speed);

  // Keep the ref current — subscribe when the prop is a signal, write once
  // when it is a plain number. A speed change needs no phase correction
  // (continuity is the construction), but every write still pokes the
  // scheduler so a signal driving speed on an idle scene wakes it for
  // exactly the frames the signal ticks — the same render-on-demand
  // contract useAnimatableUniform keeps.
  useEffect(() => {
    const scheduler = shaderContext?.scheduler;

    if (isSignal(speed)) {
      const write = (next: number) => {
        speedRef.current = next;
        scheduler?.requestRender();
      };

      // Seed from the signal's current value before subscribing: this
      // effect also runs when one signal is swapped for another, and the
      // new source may not tick for a while.
      write(speed.get());

      return speed.on('change', write);
    }
    speedRef.current = speed;
    scheduler?.requestRender();

    return undefined;
  }, [shaderContext, speed]);

  // The integrator: one scheduler client advancing the phase each frame.
  // Multiplying by the reduced-motion scale preserves the engine's
  // prefers-reduced-motion contract — the GPU path is time x scale, and
  // this is the same scale applied to the same increment. Reading it fresh
  // every tick means a mid-session policy flip changes the tempo smoothly
  // instead of snapping the pattern (the old product form snapped here
  // too, for the same reason speed changes did).
  useEffect(() => {
    const scheduler = shaderContext?.scheduler;

    if (!scheduler) return undefined;

    const scale = getReducedMotionTimeScale();
    const accumulate = ({ delta }: SchedulerTick) => {
      phaseUniform.value += speedRef.current * Math.min(delta, MAX_DELTA) * scale.value;
    };

    scheduler.add(accumulate);

    return () => scheduler.remove(accumulate);
  }, [shaderContext, phaseUniform]);

  return phaseUniform;
}
