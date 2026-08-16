'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

import { ShaderPoster } from '@lovo/matter-react/poster';

export interface DemoPosterProps {
  src: string;
  alt: string;
  /**
   * CSS size (width, height) the poster was captured at. Set it for shaders
   * that size their pattern in real pixels (e.g. DotField's 30px grid):
   * those posters must render at exactly their capture size — centered and
   * cropped by the demo box — because any rescale changes the pattern's
   * on-screen pitch and the poster no longer matches the shader that
   * replaces it. Omit for resolution-independent shaders, which cover-scale.
   */
  pixelSize?: readonly [number, number];
  children?: ReactNode;
}

/**
 * Demo-page poster boundary: bakes in the next/image conventions every shader
 * demo uses (fill, priority, viewport sizes, cover). The image renders in the
 * initial HTML and drops when the enclosed ShaderScene paints its first frame.
 * Pixel-locked posters (see `pixelSize`) swap cover-scaling for a centered
 * crop, mirroring how a pixel-sized shader anchors its pattern to the canvas
 * center at any canvas size.
 */
export function DemoPoster({ src, alt, pixelSize, children }: DemoPosterProps) {
  return (
    <ShaderPoster
      poster={
        pixelSize ? (
          <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            <Image
              alt={alt}
              height={pixelSize[1]}
              priority
              src={src}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                // The capture's CSS size, not the file's pixel size: the file
                // carries 2x pixels for retina sharpness. maxWidth: none opts
                // out of any global img max-width that would rescale it.
                width: pixelSize[0],
                height: pixelSize[1],
                maxWidth: 'none',
              }}
              width={pixelSize[0]}
            />
          </div>
        ) : (
          <Image alt={alt} fill priority sizes="100vw" src={src} style={{ objectFit: 'cover' }} />
        )
      }
    >
      {children}
    </ShaderPoster>
  );
}
