'use client';

// A dark blue-gray ramp, so the trail's added light shows at every point.
// The poster captures this same scene before any pointer movement.
import type { ReactNode } from 'react';

import { CursorTrail, LinearGradient, ShaderScene } from '@camp-dev/shaders';

import { type CursorTrailParams, INITIAL } from './params';

const DARK_STOPS = [{ color: 'oklch(0.18 0.03 260)' }, { color: 'oklch(0.28 0.05 250)' }];

export default function CursorTrailScene({
  params = INITIAL,
  children,
}: {
  params?: CursorTrailParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <LinearGradient stops={DARK_STOPS} />
      <CursorTrail
        decay={params.decay}
        grow={params.grow}
        hold={params.hold}
        intensity={params.intensity}
        radius={params.radius}
        smoothing={params.smoothing}
      />
      {children}
    </ShaderScene>
  );
}
