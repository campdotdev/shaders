'use client';

import type { ReactNode } from 'react';

import { ShaderScene, Swells } from '@camp-dev/shaders';

import { INITIAL, type SwellsParams } from './params';

export default function SwellsScene({
  params = INITIAL,
  children,
}: {
  params?: SwellsParams;
  children?: ReactNode;
} = {}) {
  const { introSeconds, introFront, introHaze } = params.tuning;

  return (
    <ShaderScene>
      <Swells
        altitude={params.altitude}
        color={params.color}
        colorSpace={params.colorSpace}
        fieldOfView={params.fieldOfView}
        haze={params.haze}
        hazeColor={params.hazeColor}
        hueInterpolation={params.hueInterpolation}
        intro={params.intro}
        // TEMPORARY (build-phase tuning only): an intro plays once per mount,
        // so a change to an intro tuning slider mounts Swells again to replay
        // it. Goes with the tuning rig at the defaults gate (SHA-327).
        key={`${introSeconds}|${introFront}|${introHaze}`}
        mirage={params.mirage}
        parallax={params.parallax}
        parallaxCenter="cursor"
        relief={params.relief}
        ripples={params.ripples}
        scale={params.scale}
        shadowColor={params.shadowColor}
        sharpness={params.sharpness}
        sheen={params.sheen}
        sheenColor={params.sheenColor}
        speed={params.speed}
        sunAngle={params.sunAngle}
        sunHeight={params.sunHeight}
        swellSpeed={params.swellSpeed}
        tilt={params.tilt}
        tuning={params.tuning}
      />
      {children}
    </ShaderScene>
  );
}
