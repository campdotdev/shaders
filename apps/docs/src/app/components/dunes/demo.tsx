'use client';

/**
 * Dunes demo island: the interactive slice of the Dunes page, with its
 * control store, shader preview, and control panel for the camera and the
 * temporary tuning rig. The shared components/[slug] template renders this
 * between its static header and prose sections.
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

import { type DunesParams, INITIAL } from './params';

const DunesScene = dynamic(() => import('./scene'), { ssr: false });

function DunesDemo() {
  const params = useSnapshot<DunesParams>();

  return (
    <DemoPoster
      alt="Dunes shader preview: rolling sand-colored terrain lit from the left, running to a horizon under a pale blue sky"
      src="/posters/dunes.jpg"
    >
      <DunesScene params={params}>
        <VisualTestPause />
      </DunesScene>
    </DemoPoster>
  );
}

/** The panel's controls without the panel around them. */
function DunesFields() {
  return (
    <>
      <Section title="Camera">
        <SliderInput label="Altitude" max={4} min={0.5} path="altitude" step={0.01} />
        <SliderInput label="Tilt" max={60} min={-10} path="tilt" step={0.5} />
        <SliderInput label="Field of view" max={100} min={20} path="fieldOfView" step={1} />
      </Section>
      <Section title="Tuning (dev)">
        <SliderInput label="Frequency" max={1.5} min={0.05} path="tuning.frequency" step={0.01} />
        <SliderInput
          label="Terrain height"
          max={2}
          min={0}
          path="tuning.terrainHeight"
          step={0.01}
        />
        <SliderInput label="Step scale" max={1} min={0.1} path="tuning.stepScale" step={0.01} />
        <SliderInput label="Max distance" max={120} min={5} path="tuning.maxDistance" step={1} />
      </Section>
    </>
  );
}

function DunesControls() {
  return (
    <ControlPanel>
      <DunesFields />
    </ControlPanel>
  );
}

export function DunesIsland() {
  const store = useMemo(() => createControlStore<DunesParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<DunesControls />}>
        <div data-shader-demo>
          <DunesDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
