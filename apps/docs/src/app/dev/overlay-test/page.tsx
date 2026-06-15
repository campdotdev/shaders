'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

import type { FilmGrainBlend } from '@matter/registry/film-grain';

const ShaderScene = dynamic(() => import('@lovo/matter-react').then((m) => m.ShaderScene), {
  ssr: false,
});
const MeshGradient = dynamic(
  () => import('@matter/registry/mesh-gradient').then((m) => m.MeshGradient),
  { ssr: false },
);

const FilmGrain = dynamic(() => import('@matter/registry/film-grain').then((m) => m.FilmGrain), {
  ssr: false,
});

export default function OverlayTestPage() {
  const [intensity, setIntensity] = useState(0.3);
  const [speed, setSpeed] = useState(1);
  const [grainBlend, setGrainBlend] = useState<FilmGrainBlend>('additive');

  return (
    <div
      style={{
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <h1>Overlay test (dev only)</h1>
      <p style={{ color: 'var(--fg-muted)' }}>
        Validation page for the overlay registration pipeline. FilmGrain should appear as a layer of
        noise on top of MeshGradient. Drag intensity to confirm the uniform reads through; drag
        speed to feel the shutter-rate quantization (low speed = chunky 24Hz cadence). Toggle mode
        to compare additive (brightness-preserving, half pixels brighten) vs. subtractive
        (silver-emulsion, only darkens).
      </p>
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <label>
          Intensity: {intensity.toFixed(2)}{' '}
          <input
            max={1}
            min={0}
            onChange={(e) => setIntensity(Number(e.target.value))}
            step={0.01}
            type="range"
            value={intensity}
          />
        </label>
        <label>
          Speed: {speed.toFixed(2)}{' '}
          <input
            max={1}
            min={0}
            onChange={(e) => setSpeed(Number(e.target.value))}
            step={0.01}
            type="range"
            value={speed}
          />
        </label>
        <button
          onClick={() => setGrainBlend((m) => (m === 'additive' ? 'subtractive' : 'additive'))}
        >
          Mode: {grainBlend}
        </button>
      </div>
      <div style={{ position: 'relative', width: '100%', height: '400px' }}>
        <ShaderScene>
          <MeshGradient />
          <FilmGrain grainBlend={grainBlend} intensity={intensity} speed={speed} />
        </ShaderScene>
      </div>
    </div>
  );
}
