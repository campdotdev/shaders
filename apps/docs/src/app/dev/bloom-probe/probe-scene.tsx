'use client';

// Probe for Bloom: a photo of a neon motel sign at dusk, or Swells with
// ?source=swells, under Bloom, with a slider for each dial. The visual spec
// compares loads of this page with each other, with no baseline. The sign's tubes are small, hard lights against a
// dark sky, which is what Bloom acts on. The photo is 8-bit, so its
// luminance stops at 1. Swells adds light, so its glints pass 1 and show
// what a threshold above 1 keeps.
import { useState } from 'react';

import { Bloom, DotField, ShaderMonitor, ShaderScene, Swells } from '@camp-dev/shaders';

import neonMotel from '@/components/photo/neon-motel.webp';
import { PhotoSource, usePhoto } from '@/components/photo/photo-source';
import { VisualTestPause } from '@/lib/visualTestHooks';

// Query params set where the dials start, such as ?strength=0 for the image
// exactly as it is, or ?threshold=0&radius=1 to bloom everything as far as
// the glow reaches. ?bloom=none drops Bloom, to compare against the image
// alone. ?source=dots draws DotField, which leaves the canvas transparent
// between its dots, over a mid-gray page, to show the glow landing where the
// scene drew nothing. The monitor
// in the corner shows the scene's GPU time per frame, so the same page with
// and without Bloom gives Bloom's cost.

/** A value from the page's query string, or null when it is absent. */
function query(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

/** A number from the page's query string, or `fallback` when it is absent. */
function queryNumber(name: string, fallback: number): number {
  const raw = query(name);

  return raw === null ? fallback : Number(raw);
}

/**
 * Whether the page loaded as a visual test. The spec screenshots the
 * canvas, and the sliders and the monitor would cover part of it.
 */
function isVisualTest(): boolean {
  return query('visualTest') === '1';
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
  const [threshold, setThreshold] = useState(() => queryNumber('threshold', 0.7));
  const [radius, setRadius] = useState(() => queryNumber('radius', 0.5));
  const [strength, setStrength] = useState(() => queryNumber('strength', 0.5));
  // The scene mounts once the photo has decoded, so its first frame
  // already shows it.
  const photo = usePhoto(neonMotel);
  const source = query('source');
  const visualTest = isVisualTest();

  if (!photo) return null;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: source === 'dots' ? '#6b7280' : '#000',
      }}
    >
      <ShaderScene>
        {source === 'swells' ? <Swells /> : null}
        {source === 'dots' ? <DotField /> : null}
        {source === null ? <PhotoSource photo={photo} /> : null}
        {query('bloom') !== 'none' && (
          <Bloom radius={radius} strength={strength} threshold={threshold} />
        )}
        {visualTest ? null : <ShaderMonitor anchor="bottom-right" />}
        <VisualTestPause />
      </ShaderScene>
      <div
        hidden={visualTest}
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
        <Slider label="strength" max={3} onChange={setStrength} value={strength} />
      </div>
    </div>
  );
}
