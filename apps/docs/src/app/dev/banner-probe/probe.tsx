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
  SelectInput,
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

const PATTERN_OPTIONS = [
  { label: 'Bayer 2x2', value: 'bayer-2x2' },
  { label: 'Bayer 4x4', value: 'bayer-4x4' },
  { label: 'Bayer 8x8', value: 'bayer-8x8' },
  { label: 'Dots', value: 'dots' },
  { label: 'Lines', value: 'lines' },
  { label: 'White noise', value: 'white-noise' },
  { label: 'Blue noise', value: 'blue-noise' },
  { label: 'Gradient noise', value: 'gradient-noise' },
] as const;

/**
 * The scene's tuning plus the probe's own lever: the canvas size. DotField
 * anchors its grid at the canvas center and Dither its tiles at the corner,
 * so half the width and half the height, modulo the Bayer tile edge, are
 * what set where each dot meets the tile (banner-scene.tsx works through
 * why). The header's box is 1728 by 200, and the sliders step by 2 so the
 * center moves a whole pixel per step.
 */
interface ProbeParams extends BannerTuning {
  canvasWidth: number;
  canvasHeight: number;
}

const INITIAL: ProbeParams = {
  ...BANNER_TUNING,
  canvasWidth: BANNER_WIDTH,
  canvasHeight: BANNER_HEIGHT,
};

/** Reads the live params and renders the scene, so only this re-renders on a drag. */
function ProbeScene() {
  const params = useSnapshot<ProbeParams>();

  return (
    <div style={{ position: 'relative', width: params.canvasWidth, height: params.canvasHeight }}>
      <BannerScene tuning={params} />
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
      <Section title="Canvas">
        <SliderInput label="Width" max={1760} min={1696} path="canvasWidth" step={2} />
        <SliderInput label="Height" max={232} min={168} path="canvasHeight" step={2} />
      </Section>
      <Section title="Wash">
        <ColorInput label="Glow color" path="glowColor" />
      </Section>
      <Section title="Dots">
        <SliderInput label="Spacing" max={64} min={8} path="spacing" step={1} />
        <SliderInput label="Dot size" max={16} min={1} path="dotSize" step={0.5} />
        <ColorInput label="Dot color" path="dotColor" />
      </Section>
      <Section title="Dither">
        <SelectInput label="Pattern" options={PATTERN_OPTIONS} path="pattern" />
        <SliderInput label="Pixel size" max={8} min={1} path="pixelSize" step={1} />
        <SliderInput label="Levels" max={8} min={2} path="levels" step={1} />
        <SliderInput label="Spread" max={2} min={0} path="spread" step={0.05} />
      </Section>
    </ControlPanel>
  );
}

export function BannerProbe() {
  const store = useMemo(() => createControlStore<ProbeParams>(INITIAL), []);

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
