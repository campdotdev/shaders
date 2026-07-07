'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

import { ShaderPoster } from '@lovo/matter-react/poster';

export interface DemoPosterProps {
  src: string;
  alt: string;
  children?: ReactNode;
}

/**
 * Demo-page poster boundary: bakes in the next/image conventions every shader
 * demo uses (fill, priority, viewport sizes, cover). The image renders in the
 * initial HTML and drops when the enclosed ShaderScene paints its first frame.
 */
export function DemoPoster({ src, alt, children }: DemoPosterProps) {
  return (
    <ShaderPoster
      poster={
        <Image alt={alt} fill priority sizes="100vw" src={src} style={{ objectFit: 'cover' }} />
      }
    >
      {children}
    </ShaderPoster>
  );
}
