'use client';

// The vec2 sibling of useAnimatableUniform. A shader uniform holding a point
// needs a Vector2 mutated in place - assigning a fresh [x, y] array to
// .value, which is what the scalar hook does, would not reach the GPU. So
// this hook owns one Vector2 for the lifetime of the component and writes
// incoming pairs into it. It also resolves the `'cursor'` shorthand every
// position prop accepts, by reading the scene's shared cursor through
// useCursor.
import { useEffect, useMemo } from 'react';

import { uniform } from 'three/tsl';
import { Vector2 } from 'three/webgpu';

import { isSignal, type PositionProp } from '../animatable-signal/animatable-signal.js';
import { useCursor } from '../use-cursor/use-cursor.js';
import { useShaderContext } from '../use-shader-context/use-shader-context.js';

export interface AnimatablePointOptions {
  /**
   * Treat the incoming pair as a screen-style point - `[0, 0]` at the
   * top-left, y growing downward, like CSS - and convert it into uv space,
   * where v grows upward. Off by default: this is a general hook for
   * animatable pairs, not a `center` hook, so it does not presume a
   * coordinate convention.
   */
  screenOrigin?: boolean;
  /**
   * Where a `'cursor'` point sits before the pointer first moves, in the
   * same frame as the pair itself. Read once, at mount. Ignored for a
   * tuple or a signal. Defaults to the canvas center, `[0.5, 0.5]`.
   */
  cursorInitial?: readonly [number, number];
}

// Where a `'cursor'` point starts when the caller passes no cursorInitial:
// the middle of the canvas, in the 0..1 frame the pair itself uses.
const CANVAS_CENTER = [0.5, 0.5] as const;

export function useAnimatablePoint(
  value: PositionProp,
  options?: AnimatablePointOptions,
): ReturnType<typeof uniform<Vector2>> {
  // Null outside a mounted <ShaderScene> (Mode 2, or a bare unit test), in
  // which case there is no scheduler to poke.
  const shaderContext = useShaderContext();
  const scheduler = shaderContext?.scheduler;
  const screenOrigin = options?.screenOrigin ?? false;
  const cursorInitial = options?.cursorInitial ?? CANVAS_CENTER;

  // The `'cursor'` shorthand. Hooks cannot be called conditionally, so every
  // point calls useCursor, and `enabled` is what keeps it free: a tuple or a
  // signal attaches no listener and joins no frame loop. The cursor signal
  // then goes through the same path as any other signal below, so the
  // screenOrigin conversion and the scheduler poke apply to it unchanged.
  const followsCursor = value === 'cursor';
  const cursor = useCursor({ enabled: followsCursor, initial: cursorInitial });

  // Split the prop into a signal reference and two plain numbers. The effect
  // below depends on these rather than on `value` itself, because a wrapper's
  // `center = [0.5, 0.5]` default allocates a new array on every render - and
  // depending on that identity would re-subscribe, and wake an idle scene, on
  // every unrelated re-render (gotcha 16).
  const pair = followsCursor ? cursor : value;
  const signal = isSignal(pair) ? pair : null;
  const [staticX, staticY] = isSignal(pair) ? [0, 0] : pair;

  // Created once and NEVER replaced: materials capture this node when they
  // compile, so a fresh uniform per render would force a rebuild every time.
  // The conversion has to happen here as well as in the effect - this is the
  // value the first frame draws with.
  const pointVec = useMemo(() => {
    const initial = isSignal(pair) ? pair.get() : pair;

    return new Vector2(initial[0], screenOrigin ? 1 - initial[1] : initial[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uniformNode = useMemo(() => uniform(pointVec), [pointVec]);

  // Keep the vector current. Signal values stream in through the
  // subscription with no React re-render, which is what makes 60Hz animation
  // cheap. Every write is followed by a scheduler poke because the scene
  // renders on demand: a component that has parked its frame loop would
  // otherwise take the new value and never draw it.
  useEffect(() => {
    const write = (next: readonly [number, number]) => {
      pointVec.set(next[0], screenOrigin ? 1 - next[1] : next[1]);
      scheduler?.requestRender();
    };

    if (signal) {
      // Seed from the signal's current value before subscribing: this effect
      // also runs when one signal is swapped for another, and the new source
      // may not tick for a while - without the seed the uniform would keep
      // showing the previous signal's last value.
      write(signal.get());

      return signal.on('change', write);
    }
    write([staticX, staticY]);

    return undefined;
  }, [scheduler, signal, staticX, staticY, pointVec, screenOrigin]);

  return uniformNode;
}
