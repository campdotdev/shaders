'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import {
  ControlPanel,
  ControlsProvider,
  createControlStore,
  DemoLayout,
  formatJsx,
  formatParams,
  Section,
  SelectInput,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { type GrainParams, INITIAL } from './params';

const GrainScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'Grain', siblings: ['<LinearGradient />'] } as const;

const BLEND_OPTIONS = [
  { label: 'Additive', value: 'additive' },
  { label: 'Subtractive', value: 'subtractive' },
] as const;

/**
 * Reads the live params and renders the scene. Split out from the page so it
 * subscribes to the store on its own — the page component itself never
 * re-renders during a drag, only this and the moved control do.
 */
function GrainDemo() {
  const params = useSnapshot<GrainParams>();

  return (
    <DemoPoster
      alt="Film grain shader preview: violet to magenta gradient overlaid with grain"
      src="/posters/grain.jpg"
    >
      <GrainScene params={params}>
        <VisualTestPause />
      </GrainScene>
    </DemoPoster>
  );
}

function GrainControls() {
  const params = useSnapshot<GrainParams>();

  return (
    <ControlPanel
      onCopyJsx={() => formatJsx(COPY_CONFIG, params)}
      onCopyParams={() => formatParams(params)}
      title="<Grain>"
    >
      <Section title="Grain">
        <SliderInput label="Intensity" max={1} min={0} path="intensity" step={0.01} />
        <SliderInput label="Speed" max={2} min={0} path="speed" step={0.01} />
        <SelectInput label="Blend" options={BLEND_OPTIONS} path="blend" />
      </Section>
    </ControlPanel>
  );
}

export default function GrainPage() {
  const store = useMemo(() => createControlStore<GrainParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <main style={{ minHeight: '100vh' }}>
        <DemoLayout controls={<GrainControls />}>
          <div data-shader-demo style={{ position: 'relative' }}>
            <GrainDemo />
          </div>
        </DemoLayout>
        <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
          <h1 style={{ marginTop: 0 }}>&lt;Grain /&gt;</h1>
          <p>
            Standalone film grain overlay. Stacks inside any <code>&lt;ShaderScene&gt;</code> on top
            of whatever base component you want — gradients, noise fields, mesh gradients — and
            applies a layer of animated grain via the post-processing pipeline.
          </p>
          <p>
            <strong>Additive</strong> (default) adds signed grain so half the pixels brighten and
            half darken, preserving average exposure — pure texture, no exposure shift.{' '}
            <strong>Subtractive</strong> takes the absolute value of the grain and subtracts it, so
            the image only darkens. Subtractive simulates silver-halide film stock physics, where
            exposed grain blocks light.
          </p>
          <p>
            <code>speed</code> controls the shutter cadence: <code>1</code> ≈ 60Hz (continuous
            shimmer at 60fps), <code>0.4</code> ≈ 24Hz (chunky film cadence), <code>0</code> freezes
            the grain pattern.
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
  <Grain intensity={0.45} speed={1} blend="additive" />
</ShaderScene>`}
          </pre>
        </section>
      </main>
    </ControlsProvider>
  );
}
