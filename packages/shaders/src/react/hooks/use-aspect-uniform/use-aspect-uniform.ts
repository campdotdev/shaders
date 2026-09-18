'use client';

// The canvas aspect ratio (width / height) as ONE stable float uniform, for
// the shaders that keep circles round and grids square on a wide canvas.
// Every aspect-corrected component reads it from here rather than wiring
// useResize to a uniform by hand, because that wiring hides a
// render-on-demand trap: the resize signal is a stub on a component's first
// effect pass and materializes one render later, by which time a scene
// hinted static has drawn its last frame at the 16:9 fallback. A bare
// uniform write then repaints nothing, so the fallback stays on screen. The
// Components banner, a 12:1 canvas rendered as 16:9, is how it was found.
import { useEffect, useMemo } from 'react';

import { uniform } from 'three/tsl';

import { type ResizeValue, useResize } from '../use-resize/use-resize.js';
import { useShaderContext } from '../use-shader-context/use-shader-context.js';

/**
 * The ratio assumed until the canvas reports a size. A collapsed canvas
 * reports 0 for both dimensions, and a 16:9 guess is closer to most layouts
 * than the NaN a divide by zero would produce.
 */
const FALLBACK_ASPECT = 16 / 9;

export function useAspectUniform(): ReturnType<typeof uniform<number>> {
  // Null outside a mounted <ShaderScene>, where there is no scheduler to
  // poke and the writes below are all this hook does.
  const shaderContext = useShaderContext();
  const resize = useResize();

  // Created once and never replaced: the material captures this node when it
  // compiles, so its identity has to survive re-renders. Seeded from the
  // current size when the canvas has one, and the fallback when it reports 0.
  const [initialWidth, initialHeight] = resize.get();
  const aspectUniform = useMemo(
    () => uniform(initialHeight > 0 ? initialWidth / initialHeight : FALLBACK_ASPECT),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Re-read on every pass, then follow every resize. Each write is followed
  // by a scheduler poke, for the reason at the top of the file; requestRender
  // returns at once unless the scheduler really is idle, so an animating
  // scene pays one property read. The zero guard skips the nonsense ratio a
  // collapsed canvas would produce.
  useEffect(() => {
    const scheduler = shaderContext?.scheduler;
    const write = ([width, height]: ResizeValue) => {
      if (width <= 0 || height <= 0) return;
      aspectUniform.value = width / height;
      scheduler?.requestRender();
    };

    write(resize.get());

    return resize.on('change', write);
  }, [shaderContext, resize, aspectUniform]);

  return aspectUniform;
}
