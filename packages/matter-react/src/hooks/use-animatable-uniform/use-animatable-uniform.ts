'use client';

// The bridge between React props and shader uniforms — every animatable
// prop on every registry component flows through here. A prop can be a
// plain value or a "signal" (anything with get() and on('change') — Motion's
// MotionValue fits), and either way the component gets back ONE stable
// uniform whose value tracks the prop.
import { useEffect, useMemo } from 'react';

import { uniform } from 'three/tsl';

import { useShaderContext } from '../use-shader-context/use-shader-context.js';

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
  // Null outside a mounted <ShaderScene> (Mode 2, or a bare unit test), in
  // which case there is no scheduler to poke and the writes below are all
  // this hook does.
  const shaderContext = useShaderContext();

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
  //
  // Every write is followed by a scheduler poke, because the scene renders on
  // demand. A component that has voted itself static — a gradient at speed 0,
  // say — parks the frame loop, and then a bare uniform write reaches the GPU
  // and is never drawn: the new value sits there until something else happens
  // to trigger a frame. Dragging a slider would change the number and repaint
  // nothing. requestRender() returns immediately unless the scheduler really
  // is idle, so a scene that is already animating pays one property read.
  useEffect(() => {
    const scheduler = shaderContext?.scheduler;

    if (isSignal(value)) {
      return value.on('change', (next) => {
        uniformNode.value = next;
        scheduler?.requestRender();
      });
    }
    uniformNode.value = value;
    scheduler?.requestRender();

    return undefined;
  }, [shaderContext, value, uniformNode]);

  return uniformNode;
}
