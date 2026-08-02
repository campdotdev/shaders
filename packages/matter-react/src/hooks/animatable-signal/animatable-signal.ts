'use client';

// The animation-signal protocol, shared by every animatable hook. Matter
// never depends on an animation library: a "signal" is anything carrying
// callable get/on, which is a shape Motion's MotionValue happens to have.
// Keeping the protocol here means the scalar hook and the point hook agree
// on what counts as a signal, and there is one place to change if it grows.

export interface AnimatableSignal<T> {
  get(): T;
  on(event: 'change', cb: (value: T) => void): () => void;
}

export type AnimatableProp<T> = T | AnimatableSignal<T>;

// Duck-type check rather than instanceof, which is what lets foreign objects
// like Motion's MotionValue qualify without Matter importing anything.
export const isSignal = <T>(value: AnimatableProp<T>): value is AnimatableSignal<T> => {
  if (typeof value !== 'object' || value === null) return false;

  return (
    'get' in value &&
    typeof value.get === 'function' &&
    'on' in value &&
    typeof value.on === 'function'
  );
};
