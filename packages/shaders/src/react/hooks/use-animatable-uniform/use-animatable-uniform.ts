'use client';

// The bridge between React props and shader uniforms — every animatable
// prop on every registry component flows through here. A prop can be a
// plain value or a "signal" (anything with get() and on('change') — Motion's
// MotionValue fits), and either way the component gets back ONE stable
// uniform whose value tracks the prop.
import { useEffect, useMemo } from 'react';

import { uniform } from 'three/tsl';

import {
  type AnimatableProp,
  type AnimatableSignal,
  isSignal,
} from '../animatable-signal/animatable-signal.js';
import { followAnimatable } from '../animatable-signal/follow-animatable.js';
import { useShaderContext } from '../use-shader-context/use-shader-context.js';

export type { AnimatableProp, AnimatableSignal };

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
  // pushed once per prop change. followAnimatable pokes the scheduler after
  // every write, so dragging a slider on a parked scene repaints it.
  useEffect(
    () =>
      followAnimatable(
        value,
        (next) => {
          uniformNode.value = next;
        },
        shaderContext?.scheduler,
      ),
    [shaderContext, value, uniformNode],
  );

  return uniformNode;
}
