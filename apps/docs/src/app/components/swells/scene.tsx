'use client';

import type { ReactNode } from 'react';

import { LinearGradient, ShaderScene, Swells } from '@camp-dev/shaders';

import { INITIAL, type SwellsParams } from './params';

// Swells draws only the ground, so the demo mounts a still sky gradient
// beneath it: a pale blue at the horizon deepening upward.
const SKY_STOPS = [{ color: 'oklch(0.80 0.05 230)' }, { color: 'oklch(0.56 0.10 255)' }];

export default function SwellsScene({
  params = INITIAL,
  children,
}: {
  params?: SwellsParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <LinearGradient angle={90} speed={0} stops={SKY_STOPS} />
      <Swells
        altitude={params.altitude}
        color={params.color}
        colorSpace={params.colorSpace}
        fieldOfView={params.fieldOfView}
        hueInterpolation={params.hueInterpolation}
        relief={params.relief}
        ripples={params.ripples}
        scale={params.scale}
        shadowColor={params.shadowColor}
        sharpness={params.sharpness}
        sunAngle={params.sunAngle}
        sunHeight={params.sunHeight}
        tilt={params.tilt}
        tuning={params.tuning}
      />
      {children}
    </ShaderScene>
  );
}
