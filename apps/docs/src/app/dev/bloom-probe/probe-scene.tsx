'use client';

// Probe for Bloom while it is built in phases (SHA-91): a photo of a neon
// motel sign at dusk, or Swells with ?source=swells, under Bloom, with a
// slider for each dial. The sign's tubes are small, hard lights against a
// dark sky, which is what Bloom acts on. The photo is 8-bit, so its
// luminance stops at 1. Swells adds light, so its glints pass 1 and show
// what a threshold above 1 keeps.
import { useState } from 'react';

import { Bloom, ShaderScene, Swells } from '@camp-dev/shaders';

import neonMotel from '@/components/photo/neon-motel.webp';
import { PhotoSource, usePhoto } from '@/components/photo/photo-source';

// ?bloom=none drops Bloom, to compare against the image alone.

/** A value from the page's query string, or null when it is absent. */
function query(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

interface SliderProps {
  label: string;
  max: number;
  value: number;
  onChange: (value: number) => void;
}

/** One dial: its name, a range input from 0 to `max`, and its value. */
function Slider({ label, max, value, onChange }: SliderProps) {
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ width: 80 }}>{label}</span>
      <input
        max={max}
        min={0}
        onChange={(event) => onChange(Number(event.target.value))}
        step={0.01}
        type="range"
        value={value}
      />
      {value.toFixed(2)}
    </label>
  );
}

export default function ProbeScene() {
  const [threshold, setThreshold] = useState(0.7);
  const [radius, setRadius] = useState(0.5);
  // The scene mounts once the photo has decoded, so its first frame
  // already shows it.
  const photo = usePhoto(neonMotel);
  const overSwells = query('source') === 'swells';

  if (!photo) return null;

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <ShaderScene>
        {overSwells ? <Swells /> : <PhotoSource photo={photo} />}
        {query('bloom') !== 'none' && <Bloom radius={radius} threshold={threshold} />}
      </ShaderScene>
      <div
        style={{
          position: 'fixed',
          top: 72,
          left: 16,
          display: 'grid',
          gap: 6,
          padding: '8px 12px',
          borderRadius: 6,
          background: 'rgb(0 0 0 / 0.7)',
          color: '#fafafa',
          font: '13px ui-monospace, monospace',
        }}
      >
        <Slider label="threshold" max={2} onChange={setThreshold} value={threshold} />
        <Slider label="radius" max={1} onChange={setRadius} value={radius} />
      </div>
    </div>
  );
}
