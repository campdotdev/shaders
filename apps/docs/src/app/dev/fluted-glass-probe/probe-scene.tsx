'use client';

// Probe for FlutedGlass: hard diagonal stripes seen through the glass at its
// defaults. A smooth Source hides what the glass does, but stripes show it:
// each flute holds a squeezed copy of the stripes under it, and the stripes
// jump sideways at every groove. The visual spec's pixel checks load it.
import { type CrossSectionName, FlutedGlass, LinearGradient, ShaderScene } from '@camp-dev/shaders';

import { VisualTestPause } from '@/lib/visualTestHooks';

// Each pass of the gradient is half dark and half light, with a switch at
// its middle a fraction of a pixel wide. colorRamp skips a segment of zero
// width, so the two middle stops sit 0.002 of a pass apart rather than on
// one position.
const STRIPE_STOPS = [
  { color: 'oklch(0.2 0 0)', position: 0 },
  { color: 'oklch(0.2 0 0)', position: 0.5 },
  { color: 'oklch(0.95 0 0)', position: 0.502 },
  { color: 'oklch(0.95 0 0)', position: 1 },
];

// Query params override the glass's dials, such as ?refraction=0&angle=30 or
// ?crossSection=prism, for checking one by eye. ?highlight=0&shadow=0 turns
// the light off, to see the bend alone. ?glass=none drops the glass, to
// compare against the Source alone, and ?source=none drops the stripes,
// leaving the glass over a transparent scene.

/** A value from the page's query string, or null when it is absent. */
function query(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

/** A number from the page's query string, or undefined when it is absent. */
function queryNumber(name: string): number | undefined {
  const raw = query(name);

  return raw === null ? undefined : Number(raw);
}

/** Narrows a query string value to one of the cross-section's names. */
function isCrossSectionName(value: string): value is CrossSectionName {
  return value === 'prism' || value === 'round' || value === 'flat';
}

/** The cross-section from the query string, as a name or a number. */
function queryCrossSection(): CrossSectionName | number | undefined {
  const raw = query('crossSection');

  if (raw === null) return undefined;

  return isCrossSectionName(raw) ? raw : Number(raw);
}

export default function ProbeScene() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <ShaderScene>
        {query('source') !== 'none' && (
          <LinearGradient angle={45} repeat={16} speed={0} stops={STRIPE_STOPS} />
        )}
        {query('glass') !== 'none' && (
          <FlutedGlass
            angle={queryNumber('angle')}
            crossSection={queryCrossSection()}
            fluteWidth={queryNumber('fluteWidth')}
            highlight={queryNumber('highlight')}
            lightAngle={queryNumber('lightAngle')}
            refraction={queryNumber('refraction')}
            shadow={queryNumber('shadow')}
          />
        )}
        <VisualTestPause />
      </ShaderScene>
    </div>
  );
}
