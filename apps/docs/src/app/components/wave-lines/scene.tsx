'use client';

import type { ReactNode } from 'react';

import { ShaderScene, type WaveLine, WaveLines } from '@camp-dev/shaders';

import { INITIAL, type Params } from './params';

export default function WaveLinesScene({
  params = INITIAL,
  children,
  paused,
}: {
  params?: Params;
  children?: ReactNode;
  /**
   * Freezes the scene on its current frame, passed to ShaderScene. A homepage
   * favorite pauses it once the pointer and keyboard focus have both left
   * its card.
   */
  paused?: boolean;
} = {}) {
  const lines: WaveLine[] = params.lines.map((line) => {
    const [firstColor] = line.color;

    // A single color is passed as a bare string (flat line); two or more become
    // a gradient along the line.
    return {
      color: line.color.length === 1 && firstColor !== undefined ? firstColor : line.color,
    };
  });

  return (
    <ShaderScene paused={paused}>
      <WaveLines
        amplitude={params.amplitude}
        baseline={params.baseline}
        braiding={params.braiding}
        breathing={params.breathing}
        brightness={params.brightness}
        colorDrift={params.colorDrift}
        colorSpace={params.colorSpace}
        flare={params.flare}
        flareRadius={params.flareRadius}
        frequency={params.frequency}
        lines={lines}
        opacity={params.opacity}
        softness={params.softness}
        speed={params.speed}
        thickness={params.thickness}
      />
      {children}
    </ShaderScene>
  );
}
