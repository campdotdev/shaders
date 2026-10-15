'use client';

// A still LiquidGradient makes the cursor's directional pull and recovery
// visible. The poster captures this same scene before any pointer movement.
import type { ReactNode } from 'react';

import { CursorSmudge, LiquidGradient, ShaderScene } from '@camp-dev/shaders';

import { type CursorSmudgeParams, INITIAL } from './params';

export default function CursorSmudgeScene({
  params = INITIAL,
  children,
}: {
  params?: CursorSmudgeParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene scrollPush>
      <LiquidGradient speed={0} />
      <CursorSmudge decay={params.decay} radius={params.radius} strength={params.strength} />
      {children}
    </ShaderScene>
  );
}
