'use client';

import type { AnimatableProp, CursorSignal } from '@lovo/matter-react';

import { DotFieldShader } from './shader';

export interface DotFieldProps {
  spacing?: AnimatableProp<number>;
  dotSize?: AnimatableProp<number>;
  color?: string;
  reach?: AnimatableProp<number>;
  strength?: AnimatableProp<number>;
  interactive?: boolean;
  inputs?: { cursor?: CursorSignal };
}

export function DotField({
  spacing = 30,
  dotSize = 2,
  color = '#8B918C',
  reach = 100,
  strength = 1,
  interactive = true,
  inputs,
}: DotFieldProps) {
  return (
    <DotFieldShader
      color={color}
      dotSize={dotSize}
      inputs={inputs}
      interactive={interactive}
      reach={reach}
      spacing={spacing}
      strength={strength}
    />
  );
}
