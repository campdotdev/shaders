'use client';

// Benchmark for Swells' GPU time with ShaderMonitor (SHA-327, SHA-341):
// Swells at its defaults over a LinearGradient, at the composition page's
// 1636 by 696 CSS pixels. `?dpr=2` draws at two pixels per CSS pixel,
// `?still` holds the swells in place, and `?baseline` draws the
// LinearGradient alone. Read after the intro lands, about 3 seconds in.
import { useState } from 'react';

import {
  LinearGradient,
  ShaderMonitor,
  ShaderScene,
  Swells,
  useStaticSceneHint,
} from '@camp-dev/shaders';

const WIDTH = 1636;
const HEIGHT = 696;

interface Settings {
  pixelRatio: number;
  still: boolean;
  baseline: boolean;
}

const readSettings = (): Settings => {
  const search = new URLSearchParams(window.location.search);

  return {
    pixelRatio: search.get('dpr') === '2' ? 2 : 1,
    still: search.has('still'),
    baseline: search.has('baseline'),
  };
};

/**
 * Votes the scene animated, so the LinearGradient baseline, which is still
 * on its own, keeps drawing frames and the GPU readout averages many frames
 * instead of settling on one.
 */
function KeepDrawing() {
  useStaticSceneHint(false);

  return null;
}

/** The query string that loads the page at `dpr`. */
const query = (dpr: number) => `?dpr=${dpr}`;

export default function BenchmarkScene() {
  const [{ pixelRatio, still, baseline }] = useState(readSettings);

  return (
    <div style={{ padding: 24, background: '#000', color: '#fff', minHeight: '100vh' }}>
      <p style={{ margin: '0 0 16px', font: '13px ui-monospace, monospace' }}>
        {baseline ? 'LinearGradient baseline' : 'Swells over a LinearGradient'}
        {still ? ' (swellSpeed 0)' : ''} at {WIDTH} × {HEIGHT} CSS px, pixel ratio capped at{' '}
        {pixelRatio}x. <a href={query(1)}>1x</a> · <a href={query(2)}>2x</a> ·{' '}
        <a href={`${query(pixelRatio)}&still`}>still</a> ·{' '}
        <a href={`${query(pixelRatio)}&baseline`}>baseline</a>
      </p>
      <div style={{ position: 'relative', width: WIDTH, height: HEIGHT }}>
        <ShaderScene maxDPR={pixelRatio}>
          <LinearGradient />
          {baseline ? null : <Swells swellSpeed={still ? 0 : undefined} />}
          <KeepDrawing />
          <ShaderMonitor anchor="top-left" />
        </ShaderScene>
      </div>
    </div>
  );
}
