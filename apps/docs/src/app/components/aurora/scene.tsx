'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { Aurora } from '@matter/registry/aurora';

import type { AuroraParams } from './params';

export default function AuroraScene({
  children,
}: {
  params?: AuroraParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <Aurora />
      {children}
    </ShaderScene>
  );
}
