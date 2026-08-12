'use client';

/**
 * Blobs demo page: shader preview plus an owned control panel for the goo
 * field and palette. Sections grow as later phases land (surface dials,
 * tuning rig).
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

const BlobsScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'Blobs' } as const;

/** A new palette color clones the last one so the addition is visible. */
const createStop = (stops: readonly PlainColorStop[]): PlainColorStop => {
  const last = stops[stops.length - 1];

  return { color: last?.color ?? 'oklch(0.6 0.15 250)' };
};

function BlobsDemo() {
  const params = useSnapshot<Params>();

  return (
    <DemoPoster
      alt="Blobs shader preview: soft blue and violet blobs merging into goo over a dark gradient"
      src="/posters/blobs.jpg"
    >
      <BlobsScene params={params}>
        <VisualTestPause />
      </BlobsScene>
    </DemoPoster>
  );
}

function BlobsControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<Blobs>">
      <Section title="Blobs">
        <SliderInput label="Count" max={20} min={1} path="count" step={0.1} />
        <SliderInput label="Size" max={1} min={0} path="size" step={0.01} />
        <SliderInput label="Size variation" max={1} min={0} path="sizeVariation" step={0.01} />
        <SliderInput label="Spread" max={1} min={0} path="spread" step={0.01} />
        <SliderInput label="Seed" max={100} min={0} path="seed" step={1} />
      </Section>
      <Section title="Surface">
        <SliderInput label="Softness" max={1} min={0} path="softness" step={0.01} />
        <SliderInput label="Shading" max={1} min={0} path="shading" step={0.01} />
      </Section>
      <Section title="Placement">
        <SliderInput label="Center x" max={1} min={0} path="center.0" step={0.01} />
        <SliderInput label="Center y" max={1} min={0} path="center.1" step={0.01} />
      </Section>
      <Section title="Motion">
        <SliderInput label="Speed" max={2} min={0} path="speed" step={0.01} />
      </Section>
      <Section title="Mixing">
        <SelectInput label="Color space" options={COLOR_SPACE_OPTIONS} path="colorSpace" />
        <SelectInput label="Hue arc" options={HUE_ARC_OPTIONS} path="hueInterpolation" />
      </Section>
      <Section title="Tuning (dev)">
        <SliderInput label="Threshold" max={0.9} min={0.05} path="tuning.threshold" step={0.01} />
        <SliderInput label="Field reach" max={4} min={0.5} path="tuning.fieldReach" step={0.05} />
        <SliderInput label="Exponent max" max={80} min={10} path="tuning.exponentMax" step={1} />
        <SliderInput label="Exponent span" max={60} min={5} path="tuning.exponentSpan" step={1} />
        <SliderInput label="Roam extent" max={0.8} min={0.1} path="tuning.roamExtent" step={0.01} />
        <SliderInput label="Min roam" max={1} min={0} path="tuning.minRoam" step={0.01} />
        <SliderInput label="Fast weight" max={1} min={0} path="tuning.fastWeight" step={0.01} />
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

export default function BlobsPage() {
  const store = useMemo(() => createControlStore<Params>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <main style={{ minHeight: '100vh' }}>
        <DemoLayout controls={<BlobsControls />}>
          <div data-shader-demo style={{ position: 'relative' }}>
            <BlobsDemo />
          </div>
        </DemoLayout>
        <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
          <h1 style={{ marginTop: 0 }}>&lt;Blobs /&gt;</h1>
          <p>
            Soft organic blobs that drift around the center, merging into gooey shapes and splitting
            apart. The space between blobs is transparent — stack Blobs over a gradient or any other
            layer and it shows through.
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
  <Blobs />
</ShaderScene>`}
          </pre>
        </section>
      </main>
    </ControlsProvider>
  );
}
