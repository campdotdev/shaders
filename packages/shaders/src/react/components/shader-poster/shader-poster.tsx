'use client';

import { type CSSProperties, type ReactNode, useMemo, useState } from 'react';

import { PosterContext, type PosterContextValue } from './poster-context.js';

export interface ShaderPosterProps {
  /**
   * Static stand-in (typically an image) shown until the shader's first
   * content frame is on screen, and again whenever the renderer is rebuilt.
   * Rendered inside an absolutely-positioned wrapper covering the boundary,
   * so a next/image with `fill` works as-is and a plain <img> only needs
   * width/height 100%.
   */
  poster: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * SSR-safe fallback boundary for shader scenes. Renders the poster in the
 * initial HTML (this module imports no three/webgpu, so it survives SSR while
 * the scene loads behind a dynamic import) and removes it when the enclosed
 * ShaderScene signals its first painted content frame via PosterContext.
 *
 * If the renderer never initializes (e.g. no WebGPU support), no paint signal
 * fires and the poster stays up permanently — that is deliberate: the poster
 * doubles as the graceful-degradation path. Check the console for the
 * underlying ShaderScene init error when diagnosing a poster that never
 * dismisses.
 */
export function ShaderPoster({ poster, children, className, style }: ShaderPosterProps) {
  const [shaderPainted, setShaderPainted] = useState(false);
  const posterControls = useMemo<PosterContextValue>(() => ({ setShaderPainted }), []);

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', ...style }}
    >
      <PosterContext.Provider value={posterControls}>{children}</PosterContext.Provider>
      {!shaderPainted && <div style={{ position: 'absolute', inset: 0 }}>{poster}</div>}
    </div>
  );
}
