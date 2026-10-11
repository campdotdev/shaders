'use client';

// Benchmark for SwirlGradient with ShaderMonitor's GPU readout (SHA-223).
// `?size=card` renders it in the Reactive card's 312 by 309 CSS-pixel
// window, where it must stay under 0.4 ms at 2x; `?size=full` renders it at
// 1440 by 900. `?dpr=2` caps the canvas at two pixels per CSS pixel, and
// anything else at one. The links between settings are full page loads, so
// each measurement starts from a fresh renderer.
import { useState } from 'react';

import { ShaderMonitor, ShaderScene, SwirlGradient, useStaticSceneHint } from '@camp-dev/shaders';

const SIZES = {
  card: { width: 312, height: 309 },
  full: { width: 1440, height: 900 },
} as const;

type SizeName = keyof typeof SIZES;

const readSettings = (): { size: SizeName; pixelRatio: number } => {
  const search = new URLSearchParams(window.location.search);

  return {
    size: search.get('size') === 'full' ? 'full' : 'card',
    pixelRatio: search.get('dpr') === '2' ? 2 : 1,
  };
};

/**
 * Votes the scene animated, so a still SwirlGradient keeps drawing frames
 * and the GPU readout averages many frames instead of settling on one.
 */
function KeepDrawing() {
  useStaticSceneHint(false);

  return null;
}

export default function BenchmarkScene() {
  const [{ size, pixelRatio }] = useState(readSettings);
  const { width, height } = SIZES[size];

  return (
    <main style={{ padding: 24, background: '#000', color: '#fff', minHeight: '100vh' }}>
      <p style={{ margin: '0 0 16px', font: '13px ui-monospace, monospace' }}>
        SwirlGradient at {width} × {height} CSS px, pixel ratio capped at {pixelRatio}x.{' '}
        <a href={`?size=card&dpr=${pixelRatio}`}>card</a> ·{' '}
        <a href={`?size=full&dpr=${pixelRatio}`}>full</a> · <a href={`?size=${size}&dpr=1`}>1x</a> ·{' '}
        <a href={`?size=${size}&dpr=2`}>2x</a>
      </p>
      <div style={{ position: 'relative', width, height }}>
        <ShaderScene maxDPR={pixelRatio}>
          <SwirlGradient />
          <KeepDrawing />
          <ShaderMonitor anchor="top-left" />
        </ShaderScene>
      </div>
    </main>
  );
}
