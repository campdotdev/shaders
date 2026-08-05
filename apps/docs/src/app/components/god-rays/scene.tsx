'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { GodRays } from '@matter/registry/god-rays';

import { type GodRaysParams, INITIAL } from './params';

export default function GodRaysScene({
  params = INITIAL,
  children,
}: {
  params?: GodRaysParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <GodRays center={[params.centerX, params.centerY]} intensity={params.intensity} />
      {children}
    </ShaderScene>
  );
}
