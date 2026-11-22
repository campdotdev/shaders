'use client';

// Benchmark for Swells' GPU time with ShaderMonitor (SHA-327, SHA-341):
// Swells at its defaults over a LinearGradient, at the composition page's
// 1636 by 696 CSS pixels. `?dpr=2` draws at two pixels per CSS pixel,
// `?still` holds the swells in place, and `?baseline` draws the
// LinearGradient alone. `?shimmer` mounts HeatShimmer above Swells with its
// band on Swells' horizon (SHA-344): its own cost is this page with the flag
// less the page without it. Read after the intro lands, about 3 seconds in.
import { useState } from 'react';

import {
  HeatShimmer,
  LinearGradient,
  ShaderMonitor,
  ShaderScene,
  Swells,
  useStaticSceneHint,
} from '@camp-dev/shaders';

const WIDTH = 1636;
const HEIGHT = 696;

/** Degrees to radians. */
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Where Swells' horizon sits at its defaults, a `tilt` of 12 degrees and a
 * `fieldOfView` of 32, as a share of the canvas's height from the top:
 * 0.129. The formula is the one in HeatShimmer's `bandPosition` JSDoc.
 */
const SWELLS_HORIZON = 0.5 - Math.tan(radians(12)) / (2 * Math.tan(radians(32 / 2)));

interface Settings {
  pixelRatio: number;
  still: boolean;
  baseline: boolean;
  shimmer: boolean;
}

const readSettings = (): Settings => {
  const search = new URLSearchParams(window.location.search);

  return {
    pixelRatio: search.get('dpr') === '2' ? 2 : 1,
    still: search.has('still'),
    baseline: search.has('baseline'),
    shimmer: search.has('shimmer'),
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
  const [{ pixelRatio, still, baseline, shimmer }] = useState(readSettings);

  return (
    <div style={{ padding: 24, background: '#000', color: '#fff', minHeight: '100vh' }}>
      <p style={{ margin: '0 0 16px', font: '13px ui-monospace, monospace' }}>
        {baseline ? 'LinearGradient baseline' : 'Swells over a LinearGradient'}
        {still ? ' (swellSpeed 0)' : ''}
        {shimmer ? ' under a HeatShimmer band on the horizon' : ''} at {WIDTH} × {HEIGHT} CSS px,
        pixel ratio capped at {pixelRatio}x. <a href={query(1)}>1x</a> · <a href={query(2)}>2x</a> ·{' '}
        <a href={`${query(pixelRatio)}&still`}>still</a> ·{' '}
        <a href={`${query(pixelRatio)}&baseline`}>baseline</a> ·{' '}
        <a href={`${query(pixelRatio)}&shimmer`}>shimmer</a>
      </p>
      <div style={{ position: 'relative', width: WIDTH, height: HEIGHT }}>
        <ShaderScene maxDPR={pixelRatio}>
          <LinearGradient />
          {baseline ? null : <Swells swellSpeed={still ? 0 : undefined} />}
          {shimmer ? <HeatShimmer band bandPosition={SWELLS_HORIZON} /> : null}
          <KeepDrawing />
          <ShaderMonitor anchor="top-left" />
        </ShaderScene>
      </div>
    </div>
  );
}
