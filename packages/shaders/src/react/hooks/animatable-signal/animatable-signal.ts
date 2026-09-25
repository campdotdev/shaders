'use client';

// The animation-signal protocol, shared by every animatable hook. Shaders
// never depends on an animation library: a "signal" is anything carrying
// callable get/on, which is a shape Motion's MotionValue happens to have.
// Keeping the protocol here means the scalar hook and the point hook agree
// on what counts as a signal, and there is one place to change if it grows.

export interface AnimatableSignal<T> {
  get(): T;
  on(event: 'change', cb: (value: T) => void): () => void;
}

export type AnimatableProp<T> = T | AnimatableSignal<T>;

/**
 * A prop that names a point on the canvas, such as `center`: an `[x, y]`
 * pair, an animation signal carrying one, or the string `'cursor'`, which
 * follows the pointer through the scene's shared cursor. Every position
 * prop shares this one type so they all accept the same inputs.
 */
export type PositionProp = AnimatableProp<readonly [number, number]> | 'cursor';

// Duck-type check rather than instanceof, which is what lets foreign objects
// like Motion's MotionValue qualify without Shaders importing anything.
export const isSignal = <T>(value: AnimatableProp<T>): value is AnimatableSignal<T> => {
  if (typeof value !== 'object' || value === null) return false;

  return (
    'get' in value &&
    typeof value.get === 'function' &&
    'on' in value &&
    typeof value.on === 'function'
  );
};
