'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { Grain } from '@matter/registry/grain';
import { LinearGradient } from '@matter/registry/linear-gradient';

import { type GrainParams, INITIAL } from './params';

export default function GrainScene({
  params = INITIAL,
  onFirstPaint,
  children,
}: {
  params?: GrainParams;
  onFirstPaint?: () => void;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene onFirstPaint={onFirstPaint}>
      <LinearGradient />
      <Grain grainBlend={params.grainBlend} intensity={params.intensity} speed={params.speed} />
      {children}
    </ShaderScene>
  );
}
