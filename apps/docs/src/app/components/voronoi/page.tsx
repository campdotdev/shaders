'use client';

/**
 * Voronoi demo page: shader preview plus an owned control panel for the cell
 * field and palette. Sections grow as later phases land (borders, motion,
 * color depth, glow).
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
      <Section title="Tuning (dev)">
        <SliderInput label="Max gap" max={0.3} min={0.01} path="tuning.maxBorderGap" step={0.005} />
        <SliderInput
          label="Max softness"
          max={0.5}
          min={0.01}
          path="tuning.maxBorderSoftness"
          step={0.005}
        />
        <SliderInput label="Flow rate" max={1.5} min={0} path="tuning.flowRate" step={0.05} />
        <SliderInput label="Flow range" max={6} min={0} path="tuning.flowRange" step={0.1} />
        <SliderInput
          label="Shading range"
          max={6}
          min={0.5}
          path="tuning.shadingRange"
          step={0.05}
        />
        <SliderInput label="Glow range" max={6} min={0.5} path="tuning.glowRange" step={0.05} />
        <SliderInput
          label="Glow exponent"
          max={4}
          min={0.5}
          path="tuning.glowExponent"
          step={0.05}
        />
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

export default function VoronoiPage() {
  const store = useMemo(() => createControlStore<Params>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <main style={{ minHeight: '100vh' }}>
        <DemoLayout controls={<VoronoiControls />}>
          <div data-shader-demo style={{ position: 'relative' }}>
            <VoronoiDemo />
          </div>
        </DemoLayout>
        <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
          <h1 style={{ marginTop: 0 }}>&lt;Voronoi /&gt;</h1>
          <p>
            A cellular mosaic — flat color patches around scattered seed points, cut by crisp
            constant-width borders.
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
  <Voronoi />
</ShaderScene>`}
          </pre>
        </section>
      </main>
    </ControlsProvider>
  );
}
