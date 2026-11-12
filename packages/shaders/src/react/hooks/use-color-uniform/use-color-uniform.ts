'use client';

// A color prop as ONE stable vec3 uniform in linear RGB, for every
// component that takes a solid color. The material captures the uniform when
// it compiles, so the uniform is created once and each new color is written
// into it, and a color change never rebuilds the material. Each write asks
// for a frame, because on a scene hinted static a bare uniform write repaints
// nothing (the bare-uniform-write gotcha in docs/agents/tsl.md).
import { useEffect, useMemo } from 'react';

import { uniform } from 'three/tsl';
import { Vector3 } from 'three/webgpu';

import { parseColorString } from '../../../engine.js';
import { useShaderContext } from '../use-shader-context/use-shader-context.js';

/**
 * Decodes `color` (hex, `oklch()`, or `oklab()`) into a vec3 uniform in
 * linear RGB, and writes each new color into the same uniform.
 */
export function useColorUniform(color: string): ReturnType<typeof uniform<Vector3>> {
  // Null outside a mounted <ShaderScene>, where there is no scheduler to poke.
  const shaderContext = useShaderContext();

  // Created once, seeded with the first color, so the first compile already
  // reads it.
  const colorUniform = useMemo(
    () => uniform(new Vector3(...parseColorString(color))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    colorUniform.value.set(...parseColorString(color));
    shaderContext?.scheduler.requestRender();
  }, [color, colorUniform, shaderContext]);

  return colorUniform;
}
