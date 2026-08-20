'use client';

/**
 * SimplexNoise demo page: shader preview plus an owned control panel for
 * the field's shape, color ramp, and mixing.
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
  ListInput,
  Section,
  SelectInput,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL, MAX_STOPS, MIN_STOPS, type Params, type PlainColorStop } from './params';

const SimplexNoiseScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'SimplexNoise' } as const;

/** A new ramp color clones the last one so the addition is visible. */
const createStop = (stops: readonly PlainColorStop[]): PlainColorStop => {
  const last = stops[stops.length - 1];

  return { color: last?.color ?? 'oklch(0.6 0.15 250)' };
};

function SimplexNoiseDemo() {
  const params = useSnapshot<Params>();

  return (
    <DemoPoster
      alt="Simplex noise shader preview: posterized organic noise pattern in blue, violet, magenta, and teal"
      src="/posters/simplex-noise.png"
    >
      <SimplexNoiseScene params={params}>
        <VisualTestPause />
      </SimplexNoiseScene>
    </DemoPoster>
  );
}

function SimplexNoiseControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<SimplexNoise>">
      <Section title="Field">
        <SliderInput label="Scale" max={30} min={0.5} path="scale" step={0.1} />
        <SliderInput label="Speed" max={2} min={0} path="speed" step={0.01} />
        <SliderInput label="Contrast" max={4} min={0} path="contrast" step={0.01} />
        <SliderInput label="Balance" max={1} min={0} path="balance" step={0.01} />
        <SliderInput label="Softness" max={1} min={0} path="softness" step={0.01} />
        <SliderInput label="Seed" max={100} min={0} path="seed" step={1} />
      </Section>
      <Section title="Mixing">
        <SelectInput label="Color space" options={COLOR_SPACE_OPTIONS} path="colorSpace" />
        <SelectInput label="Hue arc" options={HUE_ARC_OPTIONS} path="hueInterpolation" />
      </Section>
      <ListInput<PlainColorStop>
        createItem={createStop}
        itemLabel="color"
        label="Colors"
        max={MAX_STOPS}
        min={MIN_STOPS}
        path="stops"
      >
        {() => <ColorInput label="Color" path="color" />}
      </ListInput>
    </ControlPanel>
  );
}

export default function SimplexNoisePage() {
  const store = useMemo(() => createControlStore<Params>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <main style={{ minHeight: '100vh' }}>
        <DemoLayout controls={<SimplexNoiseControls />}>
          <div data-shader-demo style={{ position: 'relative' }}>
            <SimplexNoiseDemo />
          </div>
        </DemoLayout>
        <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
          <h1 style={{ marginTop: 0 }}>&lt;SimplexNoise /&gt;</h1>
          <pre
            style={{
              background: '#1a1a2a',
              color: '#e0e0f0',
              padding: '1rem',
              borderRadius: '0.5rem',
              overflow: 'auto',
              fontSize: '0.85rem',
            }}
          >
            {`import { ShaderScene } from '@mattermix/shaders-react'
import { SimplexNoise } from '@/components/matter/simplex-noise'

<ShaderScene>
  <SimplexNoise />
</ShaderScene>`}
          </pre>
        </section>
      </main>
    </ControlsProvider>
  );
}
