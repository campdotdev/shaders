'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { DotField } from '@matter/registry/dot-field';

import { INITIAL, type Params } from './params';

export default function DotFieldScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <DotField color={params.color} dotSize={params.dotSize} spacing={params.spacing} />
      {children}
    </ShaderScene>
  );
}
