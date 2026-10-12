'use client';

// Benchmark for LiquidGradient with ShaderMonitor's GPU readout (SHA-223).
// `?size=card` renders it in the Reactive card's 312 by 309 CSS-pixel
// window, where it must stay under 0.4 ms at 2x; `?size=full` renders it at
// 1440 by 900. `?dpr=2` caps the canvas at two pixels per CSS pixel, and
// anything else at one. `?still` sets speed to 0, the Reactive card's
// parked case, while the scene keeps drawing. `?baseline` renders a
// LinearGradient instead: it reads about 0.12 ms in the card window at 2x
// on the M1 Max, so a higher reading means another tab or app is sharing
// the GPU and every reading beside it is inflated (the skewed-readout
// gotcha in docs/agents/tsl.md). The links are full page loads, so each
// measurement starts from a fresh renderer.
import { useState } from 'react';

import {
  LinearGradient,
  LiquidGradient,
  ShaderMonitor,
  ShaderScene,
  useStaticSceneHint,
} from '@camp-dev/shaders';

const SIZES = {
  card: { width: 312, height: 309 },
  full: { width: 1440, height: 900 },
} as const;

type SizeName = keyof typeof SIZES;

interface Settings {
  size: SizeName;
  pixelRatio: number;
  still: boolean;
  baseline: boolean;
}

const readSettings = (): Settings => {
  const search = new URLSearchParams(window.location.search);

  return {
    size: search.get('size') === 'full' ? 'full' : 'card',
    pixelRatio: search.get('dpr') === '2' ? 2 : 1,
    still: search.has('still'),
    baseline: search.has('baseline'),
  };
};

/**
 * Votes the scene animated, so a still gradient keeps drawing frames and the
 * GPU readout averages many frames instead of settling on one.
 */
function KeepDrawing() {
  useStaticSceneHint(false);

  return null;
}

export default function BenchmarkScene() {
  const [{ size, pixelRatio, still, baseline }] = useState(readSettings);
  const { width, height } = SIZES[size];
  const query = (overrides: Partial<Record<'size' | 'dpr', string>>) =>
    `?size=${overrides.size ?? size}&dpr=${overrides.dpr ?? pixelRatio}`;

  return (
    <main style={{ padding: 24, background: '#000', color: '#fff', minHeight: '100vh' }}>
      <p style={{ margin: '0 0 16px', font: '13px ui-monospace, monospace' }}>
        {baseline ? 'LinearGradient baseline' : 'LiquidGradient'}
        {still ? ' (still)' : ''} at {width} × {height} CSS px, pixel ratio capped at {pixelRatio}x.{' '}
        <a href={query({ size: 'card' })}>card</a> · <a href={query({ size: 'full' })}>full</a> ·{' '}
        <a href={query({ dpr: '1' })}>1x</a> · <a href={query({ dpr: '2' })}>2x</a> ·{' '}
        <a href={`${query({})}&still`}>still</a> · <a href={`${query({})}&baseline`}>baseline</a>
      </p>
      <div style={{ position: 'relative', width, height }}>
        <ShaderScene maxDPR={pixelRatio}>
          {baseline ? <LinearGradient /> : <LiquidGradient speed={still ? 0 : undefined} />}
          <KeepDrawing />
          <ShaderMonitor anchor="top-left" />
        </ShaderScene>
      </div>
    </main>
  );
}
