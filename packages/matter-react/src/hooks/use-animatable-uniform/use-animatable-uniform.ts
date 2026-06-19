'use client';

import { useEffect, useMemo } from 'react';

import { uniform } from 'three/tsl';

export interface AnimatableSignal<T> {
  get(): T;
  on(event: 'change', cb: (value: T) => void): () => void;
}

export type AnimatableProp<T> = T | AnimatableSignal<T>;

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
  const uniformNode = useMemo(() => {
    const initial = isSignal(value) ? value.get() : value;

    return uniform(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
