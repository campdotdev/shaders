'use client';

// Probe for Swells: the surface in gray, from near black on faces turned
// from the sun to near white on faces turned toward it, over a black canvas.
// With no hue and no sky, a pixel's brightness is how squarely the surface there
// faces the sun, so the visual spec's pixel checks can read the light
// straight off the canvas.
import { ShaderScene, Swells } from '@camp-dev/shaders';

import { VisualTestPause } from '@/lib/visualTestHooks';

// Query params override Swells' dials, such as ?sunAngle=180&sunHeight=10,
// ?relief=0&ripples=0 for level, smooth ground, or ?sharpness=0 for round
// swells, for checking one by eye. The sheen, the haze, and the mirage start
// at 0, so a pixel's brightness is the slope light alone, and ?sheen=1,
// ?haze=0.04, or ?mirage=1 turns one on. The haze is black, the canvas's
// own color, so hazed ground reads darker whether it blends or fades, and
// ?hazeColor=white makes it white, so blending and fading pull apart.

/** The haze's color: black, or white under ?hazeColor=white. */
function hazeColor(): string {
  const raw = new URLSearchParams(window.location.search).get('hazeColor');

  return raw === 'white' ? 'oklch(1 0 0)' : 'oklch(0 0 0)';
}

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
          haze={queryNumber('haze') ?? 0}
          hazeColor={hazeColor()}
          mirage={queryNumber('mirage') ?? 0}
          relief={queryNumber('relief')}
          ripples={queryNumber('ripples')}
          scale={queryNumber('scale')}
          shadowColor="oklch(0.15 0 0)"
          sharpness={queryNumber('sharpness')}
          sheen={queryNumber('sheen') ?? 0}
          sheenColor="oklch(1 0 0)"
          sunAngle={queryNumber('sunAngle')}
          sunHeight={queryNumber('sunHeight')}
          tilt={queryNumber('tilt')}
        />
        <VisualTestPause />
      </ShaderScene>
    </div>
  );
}
