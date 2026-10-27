'use client';

// Benchmark for FlutedGlass with ShaderMonitor's GPU readout (SHA-274):
// MeshGradient under FlutedGlass in the Composable card's 485 by 308
// CSS-pixel window, where the glass must add under 0.2 ms at 2x.
// `?glass=none` drops the glass, for the reading to subtract, and `?dpr=2`
// caps the canvas at two pixels per CSS pixel, anything else at one.
import { useState } from 'react';

import {
  FlutedGlass,
  MeshGradient,
  ShaderMonitor,
  ShaderScene,
  useStaticSceneHint,
} from '@camp-dev/shaders';

const WIDTH = 485;
const HEIGHT = 308;

interface Settings {
  pixelRatio: number;
  glass: boolean;
}

const readSettings = (): Settings => {
  const search = new URLSearchParams(window.location.search);

  return {
    pixelRatio: search.get('dpr') === '2' ? 2 : 1,
    glass: search.get('glass') !== 'none',
  };
};

/**
 * Votes the scene animated, so a still scene keeps drawing frames and the GPU
 * readout averages many frames instead of settling on one.
 */
function KeepDrawing() {
  useStaticSceneHint(false);

  return null;
}

// Time each reading with no other scene drawing, since a second scene
// inflates it (the skewed-readout gotcha in docs/agents/tsl.md). The links
// are full page loads, so each measurement starts from a fresh renderer.
export default function BenchmarkScene() {
  const [{ pixelRatio, glass }] = useState(readSettings);
  /** A link to this page with some settings changed. */
  const href = (changes: Partial<Settings>) => {
    const next = { pixelRatio, glass, ...changes };

    return `?dpr=${next.pixelRatio}${next.glass ? '' : '&glass=none'}`;
  };

  return (
    <main style={{ padding: 24, background: '#000', color: '#fff', minHeight: '100vh' }}>
      <p style={{ margin: '0 0 16px', font: '13px ui-monospace, monospace' }}>
        MeshGradient {glass ? 'under FlutedGlass' : 'alone'} at {WIDTH} × {HEIGHT} CSS px, pixel
        ratio capped at {pixelRatio}x. <a href={href({ pixelRatio: 1 })}>1x</a> ·{' '}
        <a href={href({ pixelRatio: 2 })}>2x</a> · <a href={href({ glass: true })}>glass</a> ·{' '}
        <a href={href({ glass: false })}>no glass</a>
      </p>
      <div style={{ position: 'relative', width: WIDTH, height: HEIGHT }}>
        <ShaderScene maxDPR={pixelRatio}>
          <MeshGradient />
          {glass && <FlutedGlass />}
          <KeepDrawing />
          <ShaderMonitor anchor="top-left" />
        </ShaderScene>
      </div>
    </main>
  );
}
