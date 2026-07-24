'use client';

// The bridge between React props and shader uniforms — every animatable
// prop on every registry component flows through here. A prop can be a
// plain value or a "signal" (anything with get() and on('change') — Motion's
// MotionValue fits), and either way the component gets back ONE stable
// uniform whose value tracks the prop.
import { useEffect, useMemo } from 'react';

import { uniform } from 'three/tsl';

export interface AnimatableSignal<T> {
  get(): T;
  on(event: 'change', cb: (value: T) => void): () => void;
}

export type AnimatableProp<T> = T | AnimatableSignal<T>;

// Duck-type check: a signal is anything carrying callable get/on. A protocol
// check (rather than instanceof) is what lets foreign objects like Motion's
// MotionValue qualify without Matter depending on any animation library.
const isSignal = <T>(value: AnimatableProp<T>): value is AnimatableSignal<T> => {
  if (typeof value !== 'object' || value === null) return false;

  return (
    'get' in value &&
    typeof value.get === 'function' &&
    'on' in value &&
    typeof value.on === 'function'
  );
};

export function useAnimatableUniform<T>(value: AnimatableProp<T>): ReturnType<typeof uniform<T>> {
  // Created once and NEVER replaced: materials capture this node when they
  // compile, so its identity has to survive re-renders — a fresh uniform per
  // render would force a material rebuild every time.
  const uniformNode = useMemo(() => {
    const initial = isSignal(value) ? value.get() : value;

    return uniform(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the uniform current. Signal values stream in through the
  // subscription — writes go straight to uniformNode.value with no React
  // re-render, which is what makes 60Hz animation cheap. Static values are
  // pushed once per prop change.
  useEffect(() => {
    if (isSignal(value)) {
      const unsub = value.on('change', (next) => {
        uniformNode.value = next;
      });

      return unsub;
    }
    uniformNode.value = value;

    return undefined;
  }, [value, uniformNode]);

  return uniformNode;
}
