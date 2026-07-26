'use client';

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

import { INITIAL, MAX_STOPS, MIN_STOPS } from './params';
import type { Params, Stop } from './params';

const LinearGradientScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'LinearGradient' } as const;

/**
 * A new stop duplicates the last stop's color so it's visible immediately, and
 * slots in halfway between the last position and 1.0.
 */
const createStop = (stops: readonly Stop[]): Stop => {
  const last = stops[stops.length - 1];

  return {
    color: last?.color ?? 'oklch(0.6 0 0)',
    position: last !== undefined ? (last.position + 1) / 2 : 1,
  };
};

function LinearGradientDemo() {
  const params = useSnapshot<Params>();

  return (
    <DemoPoster
      alt="Linear gradient shader preview: vertical gradient from violet to purple to magenta"
      src="/posters/linear-gradient.png"
    >
      <LinearGradientScene params={params}>
        <VisualTestPause />
      </LinearGradientScene>
    </DemoPoster>
  );
}

function LinearGradientControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<LinearGradient>">
      <Section title="Motion">
        <SliderInput label="Angle" max={360} min={0} path="angle" step={1} />
        <SliderInput label="Speed" max={2} min={0} path="speed" step={0.01} />
        <SliderInput label="Center x" max={1} min={0} path="center.0" step={0.01} />
        <SliderInput label="Center y" max={1} min={0} path="center.1" step={0.01} />
      </Section>
      <Section title="Mixing">
        <SelectInput label="Color space" options={COLOR_SPACE_OPTIONS} path="colorSpace" />
        <SelectInput label="Hue arc" options={HUE_ARC_OPTIONS} path="hueInterpolation" />
      </Section>
      <ListInput<Stop>
        createItem={createStop}
        itemLabel="stop"
        label="Color stops"
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

export default function LinearGradientPage() {
  const store = useMemo(() => createControlStore<Params>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <main style={{ minHeight: '100vh' }}>
        <DemoLayout controls={<LinearGradientControls />}>
          <div data-shader-demo style={{ position: 'relative' }}>
            <LinearGradientDemo />
          </div>
        </DemoLayout>
        <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
          <h1 style={{ marginTop: 0 }}>&lt;LinearGradient /&gt;</h1>
          <p>Animated linear gradient. The simplest, foundational Matter component.</p>
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
</ShaderScene>`}
          </pre>
        </section>
      </main>
    </ControlsProvider>
  );
}
