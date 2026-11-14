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
