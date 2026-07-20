'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { Grain } from '@matter/registry/grain';
import { LinearGradient } from '@matter/registry/linear-gradient';

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
      <Grain blend={params.blend} intensity={params.intensity} speed={params.speed} />
      {children}
    </ShaderScene>
  );
}
