'use client';

/**
 * Vignette demo page: shader preview plus an owned control panel for the
 * mask's shape (intensity, feather, radius, center) and color mixing.
 */
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import {
  COLOR_SPACE_OPTIONS,
  ColorInput,
  ControlPanel,
  ControlsProvider,
  createControlStore,
  DemoLayout,
  HUE_ARC_OPTIONS,
  Section,
  SelectInput,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL, type VignetteParams } from './params';

const VignetteScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'Vignette', siblings: ['<LinearGradient />'] } as const;

function VignetteDemo() {
  const params = useSnapshot<VignetteParams>();

  return (
    <DemoPoster
      alt="Vignette shader preview: a violet-to-magenta gradient darkened toward the edges"
      src="/posters/vignette.jpg"
    >
      <VignetteScene params={params}>
        <VisualTestPause />
      </VignetteScene>
    </DemoPoster>
  );
}

function VignetteControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<Vignette>">
      <Section title="Shape">
        <SliderInput label="Intensity" max={1} min={0} path="intensity" step={0.01} />
        <SliderInput label="Feather" max={1} min={0} path="feather" step={0.01} />
        <SliderInput label="Radius" max={1.5} min={0} path="radius" step={0.01} />
        <SliderInput label="Center x" max={1} min={0} path="center.0" step={0.01} />
        <SliderInput label="Center y" max={1} min={0} path="center.1" step={0.01} />
      </Section>
      <Section title="Color">
        <ColorInput label="Color" path="color" />
        <SelectInput label="Color space" options={COLOR_SPACE_OPTIONS} path="colorSpace" />
        <SelectInput label="Hue arc" options={HUE_ARC_OPTIONS} path="hueInterpolation" />
      </Section>
    </ControlPanel>
  );
}

export default function VignettePage() {
  const store = useMemo(() => createControlStore<VignetteParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <main style={{ minHeight: '100vh' }}>
        <DemoLayout controls={<VignetteControls />}>
          <div data-shader-demo style={{ position: 'relative' }}>
            <VignetteDemo />
          </div>
        </DemoLayout>
        <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
          <h1 style={{ marginTop: 0 }}>&lt;Vignette /&gt;</h1>
          <p>
            Radial darkening at the canvas edges. Stacks inside any <code>&lt;ShaderScene&gt;</code>{' '}
            on top of whatever base component you want and fades the upstream pixels toward an edge
            color along a soft radial ring. Unlike <code>&lt;Grain /&gt;</code>, which generates new
            noise from <code>uv</code>, Vignette reads the upstream pixel and mixes it toward{' '}
            <code>color</code> — the {`"read-upstream"`} half of the post-processing pipeline.
          </p>
          <p>
            <code>feather</code> controls how gradual the blend is. At <code>0</code> the ring is a
            hard cutoff; at <code>1</code> the entire canvas is in the blend (a smooth radial
            gradient from center to edge). <code>radius</code> is the outer edge of the ring;{' '}
            <code>center</code> is the bright spot in normalized UV space.
          </p>
          <pre
            style={{
              background: '#1a1a2a',
              color: '#e0e0f0',
              padding: '1rem',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
              whiteSpace: 'pre-wrap',
            }}
          >
            {`<ShaderScene>
  <LinearGradient />
  <Vignette intensity={0.5} radius={0.6} feather={0.5} />
</ShaderScene>`}
          </pre>
        </section>
      </main>
    </ControlsProvider>
  );
}
