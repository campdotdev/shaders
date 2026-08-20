'use client';

import { useEffect } from 'react';

import type { ColorSpace } from '@mattermix/shaders';
import { mixColor } from '@mattermix/shaders';
import { ShaderScene, useShaderContext } from '@mattermix/shaders-react';
import { mix, step, uv, vec3, vec4 } from 'three/tsl';

import { addPlaneMesh } from '@/lib/meshUtils';
import { VisualTestPause } from '@/lib/visualTestHooks';

const SPACES: ColorSpace[] = ['linear', 'oklab', 'oklch', 'lch', 'hsl', 'hsv'];
const ROWS = SPACES.length;
// Yellow exercises the RED and GREEN channels; blue exercises BLUE — so the
// endpoint round-trip covers all three. (Red->blue, the old pair, never touched
// green, which is why the LCH green-coefficient bug slipped past this probe.)
const YELLOW: [number, number, number] = [1, 1, 0];
const BLUE: [number, number, number] = [0, 0, 1];

/**
 * Renders one row per color space (bottom row = SPACES[0], since uv().y is
 * bottom-up), each a yellow->blue gradient interpolated in that space via
 * `mixColor`. Uses geometry `uv()`, which spans the full 0..1 on the fullscreen
 * plane once the renderer is correctly sized (see the resize fix). `screenUV`
 * was avoided here because it breaks the docs static-export build. The gradient
 * endpoints double as a round-trip check: mixColor(yellow, blue, 0) === toLinear(fromLinear(yellow)).
 */
function ProbeMesh() {
  const shaderContext = useShaderContext();

  useEffect(() => {
    if (!shaderContext) return;

    const yellow = vec3(YELLOW[0], YELLOW[1], YELLOW[2]);
    const blue = vec3(BLUE[0], BLUE[1], BLUE[2]);
    const t = uv().x;
    const row = uv().y.mul(ROWS).floor();

    // Select the row's space via a branchless step chain.
    let gradient = mixColor(yellow, blue, t, 'linear');

    SPACES.forEach((space, index) => {
      if (index === 0) return;
      const spaceGradient = mixColor(yellow, blue, t, space);

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
        <VisualTestPause />
      </ShaderScene>
    </div>
  );
}
