'use client';

import { useEffect } from 'react';

import type { ColorSpace } from '@lovo/matter';
import { mixColor } from '@lovo/matter';
import { ShaderScene, useShaderContext } from '@lovo/matter-react';
import { mix, screenUV, step, vec3, vec4 } from 'three/tsl';

import { addPlaneMesh } from '@/lib/meshUtils';

const SPACES: ColorSpace[] = ['linear', 'oklab', 'oklch', 'lch', 'hsl', 'hsv'];
const ROWS = SPACES.length;
const RED: [number, number, number] = [1, 0, 0];
const BLUE: [number, number, number] = [0, 0, 1];

/**
 * Renders one row per color space (top row = SPACES[0], since screenUV.y is
 * top-down), each a red->blue gradient interpolated in that space via
 * `mixColor`. Uses `screenUV` (true
 * 0..1 viewport coordinates) rather than the geometry `uv()`, whose horizontal
 * range is aspect-compressed by the scene camera. The gradient endpoints double
 * as a round-trip check: mixColor(red, blue, 0) === toLinear(fromLinear(red)).
 */
function ProbeMesh() {
  const shaderContext = useShaderContext();

  useEffect(() => {
    if (!shaderContext) return;

    const red = vec3(RED[0], RED[1], RED[2]);
    const blue = vec3(BLUE[0], BLUE[1], BLUE[2]);
    const t = screenUV.x;
    const row = screenUV.y.mul(ROWS).floor();

    // Select the row's space via a branchless step chain.
    let gradient = mixColor(red, blue, t, 'linear');

    SPACES.forEach((space, index) => {
      if (index === 0) return;
      const spaceGradient = mixColor(red, blue, t, space);

      gradient = mix(gradient, spaceGradient, step(index, row));
    });

    return addPlaneMesh(shaderContext, vec4(gradient, 1));
  }, [shaderContext]);

  return null;
}

export default function ProbeGrid() {
  return (
    <div style={{ position: 'relative', width: '100%', height: 600 }}>
      <ShaderScene>
        <ProbeMesh />
      </ShaderScene>
    </div>
  );
}
