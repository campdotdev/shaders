'use client';

import type { ReactNode } from 'react';

import { Dunes, LinearGradient, ShaderScene } from '@camp-dev/shaders';

import { type DunesParams, INITIAL } from './params';

// Dunes draws only the ground, so the demo mounts a still sky gradient
// beneath it: a pale blue at the horizon deepening upward.
const SKY_STOPS = [{ color: 'oklch(0.80 0.05 230)' }, { color: 'oklch(0.56 0.10 255)' }];

export default function DunesScene({
  params = INITIAL,
  children,
}: {
  params?: DunesParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <LinearGradient angle={90} speed={0} stops={SKY_STOPS} />
      <Dunes
        altitude={params.altitude}
        fieldOfView={params.fieldOfView}
        tilt={params.tilt}
        tuning={params.tuning}
      />
      {children}
    </ShaderScene>
  );
}
