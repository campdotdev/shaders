'use client';

import { useEffect } from 'react';

import type { HueInterpolation } from '@lovo/matter';
import { colorRamp, srgbChannelToLinear } from '@lovo/matter';
import { ShaderScene, useShaderContext } from '@lovo/matter-react';
import type { ShaderNodeObject } from 'three/tsl';
import { mix, step, uv, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { addPlaneMesh } from '@/lib/meshUtils';

// Near-antipodal hue pair (blue ~264deg, yellow ~92deg in OKLCH): the shorter
// arc runs through cyan/green, the longer arc through magenta/orange, so each
// mode lands the midpoint on a visibly different side of the wheel.
const BLUE = '#0040ff';
const YELLOW = '#ffd000';

const MODES: HueInterpolation[] = ['shorter', 'longer', 'increasing', 'decreasing'];
const ROWS = MODES.length;

/** Decode a `#rrggbb` hex string into a linear-sRGB `vec3` TSL node. */
function hexToLinear(hex: string): ShaderNodeObject<Node> {
  const cleaned = hex.replace('#', '');
  const channel = (offset: number) =>
    srgbChannelToLinear(parseInt(cleaned.slice(offset, offset + 2), 16) / 255);

  return vec3(channel(0), channel(2), channel(4));
}

/**
 * Renders one row per hue-interpolation mode (bottom row = MODES[0], since
 * uv().y is bottom-up), each a blue->yellow gradient interpolated in OKLch with
 * that mode via `colorRamp`. Mirrors the color-space probe's row-select chain.
 */
function ProbeMesh() {
  const shaderContext = useShaderContext();

  useEffect(() => {
    if (!shaderContext) return;

    const stops = [
      { color: hexToLinear(BLUE), position: 0 },
      { color: hexToLinear(YELLOW), position: 1 },
    ];
    const t = uv().x;
    const row = uv().y.mul(ROWS).floor();

    let gradient = colorRamp(t, stops, 'oklch', MODES[0]);

    MODES.forEach((mode, index) => {
      if (index === 0) return;
      const modeGradient = colorRamp(t, stops, 'oklch', mode);

      gradient = mix(gradient, modeGradient, step(index, row));
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
