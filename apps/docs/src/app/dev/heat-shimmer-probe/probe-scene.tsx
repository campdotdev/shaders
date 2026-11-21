'use client';

// Probe for HeatShimmer: the docs' anthurium photo under the shimmer. The
// photo's stems and petal edges show where the shimmer moves the image, so
// the visual spec can compare two loads pixel for pixel without a baseline.
import { HeatShimmer, ShaderScene } from '@camp-dev/shaders';

import anthurium from '@/components/photo/anthurium.webp';
import { PhotoSource, usePhoto } from '@/components/photo/photo-source';
import { VisualTestPause } from '@/lib/visualTestHooks';

// Query params override the shimmer's dials, such as ?strength=0 for the
// photo exactly as it is, or ?strength=1&scale=4 for checking one by eye.

/** A number from the page's query string, or undefined when it is absent. */
function queryNumber(name: string): number | undefined {
  const raw = new URLSearchParams(window.location.search).get(name);

  return raw === null ? undefined : Number(raw);
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
        <HeatShimmer scale={queryNumber('scale')} strength={queryNumber('strength')} />
        <VisualTestPause />
      </ShaderScene>
    </div>
  );
}
