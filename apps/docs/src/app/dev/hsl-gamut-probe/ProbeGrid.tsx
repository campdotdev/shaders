'use client';

import { ShaderScene } from '@camp-dev/shaders-react';
import { LinearGradient } from '@shaders/registry/linear-gradient';

import { VisualTestPause } from '@/lib/visualTestHooks';

// The exact wide-gamut (out-of-sRGB) oklch defaults from the LinearGradient demo;
// their linear-sRGB channels fall outside [0,1], which crashed the WGSL compile
// when mixed in HSL/HSV (sRGB-transfer pow on a negative constant).
const OKLCH_STOPS = [
  { color: 'oklch(0.460 0.238 293.328)', position: 0 },
  { color: 'oklch(0.510 0.245 320)', position: 0.5 },
  { color: 'oklch(0.423 0.190 343.895)', position: 1 },
];

export default function ProbeGrid() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {(['hsl', 'hsv'] as const).map((space) => (
        <div
          data-space={space}
          key={space}
          style={{ position: 'relative', width: '100%', height: 200 }}
        >
          <ShaderScene gamut="p3">
            <LinearGradient colorSpace={space} speed={0} stops={OKLCH_STOPS} />
            <VisualTestPause />
          </ShaderScene>
        </div>
      ))}
    </div>
  );
}
