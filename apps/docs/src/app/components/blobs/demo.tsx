'use client';

/**
 * Blobs demo island: the interactive slice of the Blobs page — control store,
 * shader preview, and control panel for the goo field, surface dials,
 * placement, and palette. The shared components/[slug] template renders this
 * between its static header and prose sections.
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

export function BlobsIsland() {
  const store = useMemo(() => createControlStore<Params>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<BlobsControls />}>
        <div data-shader-demo>
          <BlobsDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
