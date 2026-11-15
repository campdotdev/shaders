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
// ?background=white turns the canvas white, so a transparent sky reads
// white and an opaque black one can't pass for it. ?speed, ?swellSpeed, and
// ?parallax set the motion dials. ?parallaxCenter=cursor sways the camera
// toward the pointer, and ?parallaxCenter=0.85,0.5 toward a fixed point.
// The intro starts off, so a check under ?reducedMotion=off, where the intro
// would play, never catches the surface mid-rise; ?intro=1 turns it on.

/** The haze's color: black, or white under ?hazeColor=white. */
function hazeColor(): string {
  const raw = new URLSearchParams(window.location.search).get('hazeColor');

  return raw === 'white' ? 'oklch(1 0 0)' : 'oklch(0 0 0)';
}

/** The canvas's color: black, or white under ?background=white. */
function background(): string {
  const raw = new URLSearchParams(window.location.search).get('background');

  return raw === 'white' ? '#fff' : '#000';
}

/**
 * The point the camera sways toward: the pointer under ?parallaxCenter=cursor,
 * or a fixed point under ?parallaxCenter=x,y, 0..1 from the top-left.
 */
function parallaxCenter(): 'cursor' | [number, number] | undefined {
  const raw = new URLSearchParams(window.location.search).get('parallaxCenter');

  if (raw === null) return undefined;
  if (raw === 'cursor') return 'cursor';

  const [x, y] = raw.split(',').map(Number);

  return x === undefined || y === undefined ? undefined : [x, y];
}

/** A number from the page's query string, or undefined when it is absent. */
function queryNumber(name: string): number | undefined {
  const raw = new URLSearchParams(window.location.search).get(name);

  return raw === null ? undefined : Number(raw);
}

/** Whether a flag is on in the page's query string, as `?name=1`. */
function queryFlag(name: string): boolean {
  return new URLSearchParams(window.location.search).get(name) === '1';
}

export default function ProbeScene() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: background() }}>
      <ShaderScene>
        <Swells
          altitude={queryNumber('altitude')}
          color="oklch(0.95 0 0)"
          fieldOfView={queryNumber('fieldOfView')}
          haze={queryNumber('haze') ?? 0}
          hazeColor={hazeColor()}
          intro={queryFlag('intro')}
          mirage={queryNumber('mirage') ?? 0}
          parallax={queryNumber('parallax')}
          parallaxCenter={parallaxCenter()}
          relief={queryNumber('relief')}
          ripples={queryNumber('ripples')}
          scale={queryNumber('scale')}
          shadowColor="oklch(0.15 0 0)"
          sharpness={queryNumber('sharpness')}
          sheen={queryNumber('sheen') ?? 0}
          sheenColor="oklch(1 0 0)"
          speed={queryNumber('speed')}
          sunAngle={queryNumber('sunAngle')}
          sunHeight={queryNumber('sunHeight')}
          swellSpeed={queryNumber('swellSpeed')}
          tilt={queryNumber('tilt')}
        />
        <VisualTestPause />
      </ShaderScene>
    </div>
  );
}
