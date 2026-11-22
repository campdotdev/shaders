'use client';

// Probe for HeatShimmer: the docs' anthurium photo under the shimmer. The
// photo's stems and petal edges show where the shimmer moves the image, so
// the visual spec can compare two loads pixel for pixel without a baseline.
// Outside a visual test, a motion-policy picker sits over the corner, so a
// review can check the shimmer under each policy.
import { HeatShimmer, ShaderScene } from '@camp-dev/shaders';

import anthurium from '@/components/photo/anthurium.webp';
import { PhotoSource, usePhoto } from '@/components/photo/photo-source';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { MotionPolicyPicker } from '../motion-policy-picker';

// Query params override the shimmer's dials, such as ?strength=0 for the
// photo exactly as it is, ?strength=1&scale=4 for checking one by eye, or
// ?speed=0 for a fixed warp. ?band=1 turns the band on, and
// ?bandPosition, ?bandHeight, and ?bandFeather place it, such as
// ?band=1&bandPosition=0.25&bandFeather=0 for a hard-edged band a quarter
// of the way down. ?shimmer=none drops HeatShimmer, to compare against the
// photo alone.

/** A value from the page's query string, or null when it is absent. */
function query(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

/** A number from the page's query string, or undefined when it is absent. */
function queryNumber(name: string): number | undefined {
  const raw = query(name);

  return raw === null ? undefined : Number(raw);
}

/**
 * Whether the page loaded as a visual test. The spec screenshots the canvas,
 * and the motion-policy picker would cover part of it. Under ?visualTest=1
 * the harness holds the paused policy anyway.
 */
function isVisualTest(): boolean {
  return query('visualTest') === '1';
}

export default function ProbeScene() {
  // The scene mounts once the photo has decoded, so the first frame the
  // spec waits for already shows it.
  const photo = usePhoto(anthurium);

  if (!photo) return null;

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <ShaderScene>
        <PhotoSource photo={photo} />
        {query('shimmer') !== 'none' && (
          <HeatShimmer
            band={query('band') === '1'}
            bandFeather={queryNumber('bandFeather')}
            bandHeight={queryNumber('bandHeight')}
            bandPosition={queryNumber('bandPosition')}
            scale={queryNumber('scale')}
            speed={queryNumber('speed')}
            strength={queryNumber('strength')}
          />
        )}
        <VisualTestPause />
      </ShaderScene>
      {isVisualTest() ? null : (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: 16,
            padding: '8px 12px',
            borderRadius: 6,
            background: 'rgb(0 0 0 / 0.7)',
            color: '#fafafa',
            font: '13px system-ui, sans-serif',
          }}
        >
          <MotionPolicyPicker />
        </div>
      )}
    </div>
  );
}
