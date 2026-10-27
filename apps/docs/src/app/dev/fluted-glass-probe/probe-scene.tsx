'use client';

// Probe for FlutedGlass: hard diagonal stripes, light and dark, seen through
// the glass at its defaults. A smooth Source such as MeshGradient hides what
// the glass does, but stripes show it plainly: each flute holds a squeezed
// copy of the stripes under it, and the stripes jump sideways at every
// groove. Inert glass would leave them straight and unbroken. Query params
// override the glass's dials, such as ?refraction=0&angle=30, for checking
// one by eye.
import { FlutedGlass, LinearGradient, ShaderScene } from '@camp-dev/shaders';

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

/** A number from the page's query string, or undefined when it is absent. */
function queryNumber(name: string): number | undefined {
  const raw = new URLSearchParams(window.location.search).get(name);

  return raw === null ? undefined : Number(raw);
}

export default function ProbeScene() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <ShaderScene>
        <LinearGradient angle={45} repeat={16} speed={0} stops={STRIPE_STOPS} />
        <FlutedGlass
          angle={queryNumber('angle')}
          fluteWidth={queryNumber('fluteWidth')}
          refraction={queryNumber('refraction')}
        />
        <VisualTestPause />
      </ShaderScene>
    </div>
  );
}
