'use client';

/**
 * Bloom demo island: the interactive slice of the Bloom page, holding the
 * control store, the shader preview, and the control panel for the glow.
 * The shared components/[slug] template renders this between its static
 * header and prose sections.
 */
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import {
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

import { type BloomParams, INITIAL } from './params';

const BloomScene = dynamic(() => import('./scene'), { ssr: false });

/**
 * Reads the live params and renders the scene. Split out from the island so
 * it subscribes to the store on its own: the island never re-renders during
 * a drag, only this and the moved control do.
 */
function BloomDemo() {
  const params = useSnapshot<BloomParams>();

  return (
    <DemoPoster
      alt="Bloom shader preview: a photo of a neon motel sign at dusk, with light spilling from its yellow and blue tubes"
      src="/posters/bloom.jpg"
    >
      <BloomScene params={params}>
        <VisualTestPause />
      </BloomScene>
    </DemoPoster>
  );
}

/** The panel's controls without the panel around them. */
function BloomFields() {
  return (
    <Section title="Glow">
      <SliderInput label="Strength" max={3} min={0} path="strength" step={0.01} />
      <SliderInput label="Radius" max={1} min={0} path="radius" step={0.01} />
      <SliderInput label="Threshold" max={1.5} min={0} path="threshold" step={0.01} />
    </Section>
  );
}

function BloomControls() {
  return (
    <ControlPanel>
      <BloomFields />
    </ControlPanel>
  );
}

export function BloomIsland() {
  const store = useMemo(() => createControlStore<BloomParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<BloomControls />}>
        <div data-shader-demo>
          <BloomDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
