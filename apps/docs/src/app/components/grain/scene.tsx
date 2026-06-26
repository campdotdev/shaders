'use client';

import { ShaderScene } from '@lovo/matter-react';
import { Grain } from '@matter/registry/grain';
import { LinearGradient } from '@matter/registry/linear-gradient';
import type { ReactNode } from 'react';

import { type GrainParams, INITIAL } from './params';

export default function GrainScene({
  params = INITIAL,
  children,
}: {
  params?: GrainParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <LinearGradient />
      <Grain grainBlend={params.grainBlend} intensity={params.intensity} speed={params.speed} />
      {children}
    </ShaderScene>
  );
}
