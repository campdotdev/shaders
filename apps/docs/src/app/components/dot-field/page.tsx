'use client';

/**
 * DotField demo page: shader preview plus an owned control panel for the
 * ripple's motion, grid, and color.
 */
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import {
  ColorInput,
  ControlPanel,
  ControlsProvider,
  createControlStore,
  DemoLayout,
  Section,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL, type Params } from './params';

const DotFieldScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'DotField' } as const;

function DotFieldDemo() {
  const params = useSnapshot<Params>();

  return (
    <DemoPoster
      alt="Dot field shader preview: a sparse grid of small gray dots on a dark background"
      pixelSize={[2048, 1280]}
      src="/posters/dot-field.png"
    >
      <DotFieldScene params={params}>
        <VisualTestPause />
      </DotFieldScene>
    </DemoPoster>
  );
}

function DotFieldControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<DotField>">
      <Section title="Motion">
        <SliderInput label="Speed" max={4} min={0} path="speed" step={0.05} />
        <SliderInput label="Amplitude" max={0.9} min={0} path="amplitude" step={0.01} />
        <SliderInput label="Wavelength" max={400} min={20} path="wavelength" step={5} />
        <SliderInput label="Decay" max={5} min={0} path="decay" step={0.05} />
      </Section>
      <Section title="Grid">
        <SliderInput label="Spacing" max={80} min={8} path="spacing" step={1} />
        <SliderInput label="Dot size" max={8} min={1} path="dotSize" step={0.5} />
        <SliderInput label="Center x" max={1} min={0} path="center.0" step={0.01} />
        <SliderInput label="Center y" max={1} min={0} path="center.1" step={0.01} />
      </Section>
      <Section title="Color">
        <ColorInput label="Color" path="color" />
      </Section>
    </ControlPanel>
  );
}

export default function DotFieldPage() {
  const store = useMemo(() => createControlStore<Params>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <main style={{ minHeight: '100vh' }}>
        <DemoLayout controls={<DotFieldControls />}>
          <div data-shader-demo style={{ position: 'relative', background: '#0a0a14' }}>
            <DotFieldDemo />
          </div>
        </DemoLayout>
        <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
          <h1 style={{ marginTop: 0 }}>&lt;DotField /&gt;</h1>
          <pre
            style={{
              background: '#1a1a2a',
              color: '#e0e0f0',
              padding: '1rem',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
            }}
          >
            {`<ShaderScene>
  <DotField spacing={30} dotSize={3} color="oklch(0.65 0.01 150)" speed={0.45} amplitude={0.15} />
</ShaderScene>`}
          </pre>
        </section>
      </main>
    </ControlsProvider>
  );
}
