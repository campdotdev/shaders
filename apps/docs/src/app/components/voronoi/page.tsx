'use client';

/**
 * Voronoi demo page: shader preview plus an owned control panel for the cell
 * field and palette. Sections grow as later phases land (borders, motion,
 * color depth, glow).
 */
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import {
  ColorInput,
  ControlPanel,
  ControlsProvider,
  createControlStore,
  DemoLayout,
  ListInput,
  Section,
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
