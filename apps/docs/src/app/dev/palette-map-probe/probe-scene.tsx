'use client';

// Probe for PaletteMap: a gray noise field mapped onto composition 2's
// six-color heat palette, under an LED wall. The gray Source is what the
// composition will feed the map, and the wall shows whether each cell lands
// on exactly one palette color. A slider sets the map's spread.
import { useState } from 'react';

import { FractalNoise, LedWall, PaletteMap, ShaderScene } from '@camp-dev/shaders';

import { VisualTestPause } from '@/lib/visualTestHooks';

// Composition 2's palette, cold to hot, from SHA-304's rough version.
const HEAT_COLORS = [
  'oklch(0.99 0 0)',
  'oklch(0.26 0.039 271)',
  'oklch(0.54 0.18 270)',
  'oklch(0.82 0.158 85)',
  'oklch(0.92 0.215 120)',
  'oklch(0.61 0.195 31)',
];

// Black to white. FractalNoise mixes in OKLab by default, so the field's
// lightness rises evenly with its noise value.
const GRAY_STOPS = [{ color: 'oklch(0 0 0)' }, { color: 'oklch(1 0 0)' }];

// Query params, for checking one part by eye: ?map=none drops the palette
// map to show the gray field, ?wall=none drops the wall to show the map per
// pixel, and ?spacing=16 sets the wall's cell pitch and the map's pixelSize
// with it. ?spread=0.5 sets the slider's starting value.

/** A value from the page's query string, or null when it is absent. */
function query(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

export default function ProbeScene() {
  const spacing = Number(query('spacing') ?? 8);
  const [spread, setSpread] = useState(() => Number(query('spread') ?? 0.5));

  return (
    <div style={{ padding: 24, background: '#888', minHeight: '100vh' }}>
      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          marginBottom: 16,
          color: '#000',
          font: '13px ui-monospace, monospace',
        }}
      >
        spread
        <input
          max={2}
          min={0}
          onChange={(event) => setSpread(Number(event.target.value))}
          step={0.05}
          type="range"
          value={spread}
        />
        {spread.toFixed(2)}
      </label>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 1636,
          aspectRatio: '1636 / 696',
          background: '#fff',
        }}
      >
        <ShaderScene>
          <FractalNoise
            balance={0.5}
            contrast={2.2}
            detail={0.45}
            octaves={6}
            scale={2.5}
            speed={0.05}
            stops={GRAY_STOPS}
          />
          {query('map') !== 'none' && (
            <PaletteMap colors={HEAT_COLORS} pixelSize={spacing} spread={spread} />
          )}
          {query('wall') !== 'none' && (
            <LedWall
              bleed={0}
              dotSize={spacing - 1}
              flicker={0}
              panelColor="#ffffff"
              spacing={spacing}
              swell={0}
              variation={0}
            />
          )}
          <VisualTestPause />
        </ShaderScene>
      </div>
    </div>
  );
}
