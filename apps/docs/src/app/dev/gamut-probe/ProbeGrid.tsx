'use client';

import { useEffect } from 'react';

import { ShaderScene, useShaderContext } from '@mattermix/shaders-react';
import { oklchToLinearSrgb } from '@mattermix/shaders/color';
import { vec3, vec4 } from 'three/tsl';

import { addPlaneMesh } from '@/lib/meshUtils';
import { VisualTestPause } from '@/lib/visualTestHooks';

// A vivid green well outside sRGB: chroma 0.34 exceeds sRGB green's ~0.295 max at
// this hue, so its linear-sRGB channels fall outside [0,1]. On a P3 output it
// renders as a saturated P3 green; on an sRGB output it clamps to the duller
// sRGB-gamut edge.
const VIVID_GREEN = oklchToLinearSrgb(0.87, 0.34, 142);

function ProbeMesh() {
  const shaderContext = useShaderContext();

  useEffect(() => {
    if (!shaderContext) return;

    const color = vec3(VIVID_GREEN[0], VIVID_GREEN[1], VIVID_GREEN[2]);

    return addPlaneMesh(shaderContext, vec4(color, 1));
  }, [shaderContext]);

  return null;
}

export default function ProbeGrid() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div data-gamut="srgb" style={{ position: 'relative', width: '100%', height: 300 }}>
        <ShaderScene gamut="srgb">
          <ProbeMesh />
          <VisualTestPause />
        </ShaderScene>
      </div>
      <div data-gamut="p3" style={{ position: 'relative', width: '100%', height: 300 }}>
        <ShaderScene gamut="p3">
          <ProbeMesh />
          <VisualTestPause />
        </ShaderScene>
      </div>
    </div>
  );
}
