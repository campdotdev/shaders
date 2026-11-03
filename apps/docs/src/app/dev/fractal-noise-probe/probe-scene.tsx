'use client';

// Probe for FractalNoise's angle and stretch: the demo's field, turned and
// drawn out into streaks, filling a wide viewport. The demo's own defaults
// are angle 0 and stretch 1, where the transform does nothing, so its
// baseline cannot catch a reversed turn or a lost stretch. The wide canvas
// matters too, because the transform corrects for the aspect ratio, and a
// square canvas would hide a mistake there.
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL } from '../../components/fractal-noise/params';
import FractalNoiseScene from '../../components/fractal-noise/scene';

// Query params override the two dials, such as ?angle=90&stretch=1, for
// checking one by eye. Without them the probe uses the values below, which
// the visual spec's baseline was captured at.

/** A number from the page's query string, or `fallback` when it is absent. */
function queryNumber(name: string, fallback: number): number {
  const raw = new URLSearchParams(window.location.search).get(name);

  return raw === null ? fallback : Number(raw);
}

export default function ProbeScene() {
  const params = {
    ...INITIAL,
    angle: queryNumber('angle', 30),
    stretch: queryNumber('stretch', 4),
  };

  return (
    // Fixed and stacked above the site header, as on the wave-field probe:
    // the spec screenshots the canvas element's box, and page chrome over it
    // must not be able to re-roll a shader baseline.
    <div style={{ position: 'fixed', inset: 0, zIndex: 10 }}>
      <FractalNoiseScene params={params}>
        <VisualTestPause />
      </FractalNoiseScene>
    </div>
  );
}
