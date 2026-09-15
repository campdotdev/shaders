'use client';

// The banner tuning rig: the scene in the same 1728 by 200 box the header
// uses, the title where the header puts it so contrast can be judged, and
// the docs' own control panel writing into BannerScene's `tuning` prop.
// Colors commit on release and numbers live, the demo panels' rule, and a
// color change rebuilds DotField's material, which is fine at this size.
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import {
  ColorInput,
  ControlPanel,
  ControlsProvider,
  createControlStore,
  Section,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { BANNER_HEIGHT, BANNER_WIDTH } from '@/components/section-banner/banner-geometry';
import { BANNER_TUNING, type BannerTuning } from '@/components/section-banner/banner-tuning';

// three/webgpu references `self` at module load and cannot SSR, so the scene
// is loaded client-only, the way banner-shader.tsx loads it.
const BannerScene = dynamic(() => import('@/components/section-banner/banner-scene'), {
  ssr: false,
});

/** Reads the live tuning and renders the scene, so only this re-renders on a drag. */
function ProbeScene() {
  const tuning = useSnapshot<BannerTuning>();

  return (
    <div style={{ position: 'relative', width: BANNER_WIDTH, height: BANNER_HEIGHT }}>
      <BannerScene tuning={tuning} />
      <p
        style={{
          position: 'absolute',
          left: 48,
          bottom: 32,
          margin: 0,
          fontSize: 'var(--font-size-4xl)',
          fontWeight: 'var(--font-weight-semibold)',
          lineHeight: 'var(--leading-10)',
        }}
      >
        Components
      </p>
    </div>
  );
}

function ProbeControls() {
  return (
    <ControlPanel>
      <Section title="Wash">
        <ColorInput label="Glow color" path="glowColor" />
      </Section>
      <Section title="Marks">
        <SliderInput label="Spacing" max={64} min={8} path="spacing" step={1} />
        <SliderInput label="Size" max={16} min={1} path="dotSize" step={0.1} />
        <ColorInput label="Color" path="dotColor" />
      </Section>
    </ControlPanel>
  );
}

export function BannerProbe() {
  const store = useMemo(() => createControlStore<BannerTuning>(BANNER_TUNING), []);

  return (
    <ControlsProvider store={store}>
      <div style={{ minHeight: '100vh', background: '#0b0f0d', overflowX: 'auto' }}>
        <ProbeScene />
        <div style={{ maxWidth: 480, padding: 24 }}>
          <ProbeControls />
        </div>
      </div>
    </ControlsProvider>
  );
}
