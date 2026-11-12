'use client';

// Probe for Swells: the sand in gray, from near black on faces turned from
// the sun to near white on faces turned toward it, over a black canvas. With
// no hue and no sky, a pixel's brightness is how squarely the sand there
// faces the sun, so the visual spec's pixel checks can read the light
// straight off the canvas.
import { ShaderScene, Swells } from '@camp-dev/shaders';

import { VisualTestPause } from '@/lib/visualTestHooks';

// Query params override Swells' dials, such as ?sunAngle=180&sunHeight=10,
// or ?relief=0&ripples=0 for level, smooth sand, for checking one by eye.

/** A number from the page's query string, or undefined when it is absent. */
function queryNumber(name: string): number | undefined {
  const raw = new URLSearchParams(window.location.search).get(name);

  return raw === null ? undefined : Number(raw);
}

export default function ProbeScene() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <ShaderScene>
        <Swells
          altitude={queryNumber('altitude')}
          color="oklch(0.95 0 0)"
          fieldOfView={queryNumber('fieldOfView')}
          relief={queryNumber('relief')}
          ripples={queryNumber('ripples')}
          scale={queryNumber('scale')}
          shadowColor="oklch(0.15 0 0)"
          sunAngle={queryNumber('sunAngle')}
          sunHeight={queryNumber('sunHeight')}
          tilt={queryNumber('tilt')}
        />
        <VisualTestPause />
      </ShaderScene>
    </div>
  );
}
