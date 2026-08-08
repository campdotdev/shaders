'use client';

/**
 * Aurora demo page: shader preview plus an owned control panel for the
 * curtain's motion, shape, and color mixing.
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
import { createStop, newStopIndex } from '@/lib/stops';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { type AuroraParams, INITIAL, MAX_STOPS, MIN_STOPS, type PlainColorStop } from './params';

const AuroraScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'Aurora' } as const;

function AuroraDemo() {
  const params = useSnapshot<AuroraParams>();

  return (
    <DemoPoster
      alt="Aurora shader preview: green and teal light curtains with a blue veil and pink fringe over a dark backdrop"
      src="/posters/aurora.jpg"
    >
      <AuroraScene params={params}>
        <VisualTestPause />
      </AuroraScene>
    </DemoPoster>
  );
}

function AuroraControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<Aurora>">
      <Section title="Motion">
        <SliderInput label="Speed" max={3} min={0} path="speed" step={0.01} />
        <SliderInput label="Waviness" max={3} min={0} path="waviness" step={0.01} />
      </Section>
      <Section title="Shape">
        <SliderInput label="Intensity" max={3} min={0} path="intensity" step={0.01} />
        <SliderInput label="Coverage" max={1} min={0} path="coverage" step={0.01} />
      </Section>
      <Section title="Mixing">
        <SelectInput label="Color space" options={COLOR_SPACE_OPTIONS} path="colorSpace" />
        <SelectInput label="Hue arc" options={HUE_ARC_OPTIONS} path="hueInterpolation" />
      </Section>
      <ListInput<PlainColorStop>
        createItem={createStop}
        insertIndex={newStopIndex}
        itemLabel="stop"
        label="Stops (low to high altitude)"
        max={MAX_STOPS}
        min={MIN_STOPS}
        path="stops"
      >
        {() => (
          <>
            <ColorInput label="Color" path="color" />
            <SliderInput label="Position" max={1} min={0} path="position" step={0.01} />
          </>
        )}
      </ListInput>
    </ControlPanel>
  );
}

export default function AuroraPage() {
  const store = useMemo(() => createControlStore<AuroraParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <main style={{ minHeight: '100vh' }}>
        <DemoLayout controls={<AuroraControls />}>
          <div
            data-shader-demo
            style={{
              position: 'relative',
              // sRGB approximation of the reference sky the aurora was tuned
              // against — the component itself is transparent.
              background: 'linear-gradient(to top, #193157, #1b2138)',
            }}
          >
            <AuroraDemo />
          </div>
        </DemoLayout>
        <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
          <h1 style={{ marginTop: 0 }}>&lt;Aurora /&gt;</h1>
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
  <Aurora intensity={1} stops={[...]} />
</ShaderScene>`}
          </pre>
          <p>
            The aurora fills its scene; compose with the container. For a curtain band hanging in a
            wide dark sky, place a short ShaderScene near the top of a taller dark section.{' '}
            <code>coverage</code> reveals the curtain from the bottom up — 1 covers the canvas, 0
            hides it.
          </p>
        </section>
      </main>
    </ControlsProvider>
  );
}
