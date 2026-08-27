'use client';

/**
 * SimplexNoise demo island: the interactive slice of the SimplexNoise page —
 * control store, shader preview, and control panel for the field's shape,
 * color ramp, and mixing. The shared components/[slug] template renders this
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

export function SimplexNoiseIsland() {
  const store = useMemo(() => createControlStore<Params>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<SimplexNoiseControls />}>
        <div data-shader-demo>
          <SimplexNoiseDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
