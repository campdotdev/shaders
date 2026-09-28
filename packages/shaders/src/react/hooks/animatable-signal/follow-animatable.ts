'use client';

// The write half of the animation-signal protocol: given an animatable prop,
// push its current value into a target now, then again on every signal
// tick, and wake the scene after each write. useAnimatableUniform and
// useAnimatableSpeed both call this from their own effect, so the effect
// (and its dependency list) stays in the hook while the seed, subscribe,
// and render-poke rules live in one place.
import type { FrameScheduler } from '../../../engine.js';
import { type AnimatableProp, isSignal } from './animatable-signal.js';

/**
 * Apply `value` through `apply`, and keep applying it while it is a signal.
 * Returns the signal's unsubscribe for an effect to hand back as its
 * cleanup, or `undefined` for a plain value, which needs none.
 */
export function followAnimatable<T>(
  value: AnimatableProp<T>,
  apply: (next: T) => void,
  scheduler: Pick<FrameScheduler, 'requestRender'> | undefined,
): (() => void) | undefined {
  // Every write is followed by a scheduler poke, because the scene renders
  // on demand. A component that has voted itself static, such as a gradient
  // at speed 0, parks the frame loop, and a bare uniform write then reaches
  // the GPU and is never drawn (the bare-uniform-write gotcha in
  // docs/agents/tsl.md). requestRender() returns at once unless the
  // scheduler really is idle, so a scene that is already animating pays one
  // property read. The scheduler is undefined outside a mounted
  // <ShaderScene>, where the write is all there is to do.
  const write = (next: T) => {
    apply(next);
    scheduler?.requestRender();
  };

  if (isSignal(value)) {
    // Seed from the signal's current value before subscribing: the calling
    // effect also runs when one signal is swapped for another, and the new
    // source may not tick for a while. Without the seed the target would
    // keep the previous signal's last value.
    write(value.get());

    return value.on('change', write);
  }
  write(value);

  return undefined;
}
