'use client';

/**
 * Voronoi demo island: the interactive slice of the Voronoi page — control
 * store, shader preview, and control panel for the cell field and palette.
 * The shared components/[slug] template renders this between its static
 * header and prose sections.
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

const VoronoiScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'Voronoi' } as const;

/** A new palette color clones the last one so the addition is visible. */
const createStop = (stops: readonly PlainColorStop[]): PlainColorStop => {
  const last = stops[stops.length - 1];

  return { color: last?.color ?? 'oklch(0.6 0.15 250)' };
};

function VoronoiDemo() {
  const params = useSnapshot<Params>();

  return (
    <DemoPoster
      alt="Voronoi shader preview: a mosaic of flat blue, violet, and purple cells"
      src="/posters/voronoi.jpg"
    >
      <VoronoiScene params={params}>
        <VisualTestPause />
      </VoronoiScene>
    </DemoPoster>
  );
}

function VoronoiControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<Voronoi>">
      <Section title="Cells">
        <SliderInput label="Scale" max={20} min={1} path="scale" step={0.1} />
        <SliderInput label="Seed" max={100} min={0} path="seed" step={1} />
        <SliderInput label="Steps" max={4} min={0} path="steps" step={1} />
        <SliderInput label="Shading" max={1} min={0} path="shading" step={0.01} />
      </Section>
      <Section title="Mixing">
        <SelectInput label="Color space" options={COLOR_SPACE_OPTIONS} path="colorSpace" />
        <SelectInput label="Hue arc" options={HUE_ARC_OPTIONS} path="hueInterpolation" />
      </Section>
      <Section title="Motion">
        <SliderInput label="Speed" max={2} min={0} path="speed" step={0.01} />
        <SliderInput label="Irregularity" max={1} min={0} path="irregularity" step={0.01} />
        <SliderInput label="Drift" max={1} min={0} path="drift" step={0.01} />
      </Section>
      <Section title="Border">
        <ColorInput label="Color" path="borderColor" />
        <SliderInput label="Width" max={1} min={0} path="borderWidth" step={0.01} />
        <SliderInput label="Softness" max={1} min={0} path="borderSoftness" step={0.01} />
      </Section>
      <Section title="Glow">
        <SliderInput label="Glow" max={1} min={0} path="glow" step={0.01} />
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

export function VoronoiIsland() {
  const store = useMemo(() => createControlStore<Params>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<VoronoiControls />}>
        <div data-shader-demo>
          <VoronoiDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
