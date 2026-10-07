'use client';

import type { ReactNode } from 'react';

import { Aurora, type ColorStop, ShaderScene } from '@camp-dev/shaders';

import { type AuroraParams, INITIAL } from './params';

// The most frames a second the scene draws. Both of the site's Aurora hosts
// render this scene: its component page and the homepage hero. At the
// hero's full width at 2x, Aurora takes about 5 ms of GPU time a frame on an
// M1 Max (/dev/aurora-benchmark), over SHA-203's 2 ms goal. On a 120 Hz
// display, a cap of 60 draws every other frame. The GPU's busy time drops
// by about a quarter, not half, because the GPU clocks down between frames
// (the skewed-readout gotcha in docs/agents/tsl.md). Raise it for smoother
// motion at a higher cost, or lower it for a lower cost and steppier motion.
const MAX_FPS = 60;

export default function AuroraScene({
  params = INITIAL,
  children,
  paused,
}: {
  params?: AuroraParams;
  children?: ReactNode;
  /**
   * Freezes the scene on its current frame, passed to ShaderScene. The
   * homepage hero pauses it while a favorite plays (home-hero/hero-pause.ts).
   */
  paused?: boolean;
} = {}) {
  const stops: ColorStop[] = params.stops.map((stop) => ({
    color: stop.color,
    position: stop.position,
  }));

  return (
    <ShaderScene maxFPS={MAX_FPS} paused={paused}>
      <Aurora
        colorSpace={params.colorSpace}
        coverage={params.coverage}
        hueInterpolation={params.hueInterpolation}
        intensity={params.intensity}
        speed={params.speed}
        stops={stops}
        waviness={params.waviness}
      />
      {children}
    </ShaderScene>
  );
}
