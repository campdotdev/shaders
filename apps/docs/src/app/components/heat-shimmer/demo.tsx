'use client';

/**
 * Heat Shimmer demo island: the interactive slice of the Heat Shimmer page,
 * holding the control store, the shader preview, and the control panel for
 * the shimmer and the temporary tuning rig. The shared components/[slug]
 * template renders this between its static header and prose sections.
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

import { type HeatShimmerParams, INITIAL } from './params';

const HeatShimmerScene = dynamic(() => import('./scene'), { ssr: false });

/**
 * Reads the live params and renders the scene. Split out from the island so
 * it subscribes to the store on its own: the island never re-renders during
 * a drag, only this and the moved control do.
 */
function HeatShimmerDemo() {
  const params = useSnapshot<HeatShimmerParams>();

  return (
    <DemoPoster
      alt="Heat Shimmer shader preview: a photo of two anthurium flowers in a glass vase, wavering as if seen through hot air"
      src="/posters/heat-shimmer.jpg"
    >
      <HeatShimmerScene params={params}>
        <VisualTestPause />
      </HeatShimmerScene>
    </DemoPoster>
  );
}

/** The panel's controls without the panel around them. */
function HeatShimmerFields() {
  return (
    <>
      <Section title="Shimmer">
        <SliderInput label="Strength" max={1} min={0} path="strength" step={0.01} />
        <SliderInput label="Scale" max={40} min={1} path="scale" step={0.1} />
      </Section>
      <Section title="Tuning (dev)">
        <SliderInput label="Fold limit" max={1} min={0} path="tuning.foldLimit" step={0.005} />
        <SliderInput label="Stretch" max={4} min={0.25} path="tuning.stretch" step={0.05} />
      </Section>
    </>
  );
}

function HeatShimmerControls() {
  return (
    <ControlPanel>
      <HeatShimmerFields />
    </ControlPanel>
  );
}

export function HeatShimmerIsland() {
  const store = useMemo(() => createControlStore<HeatShimmerParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<HeatShimmerControls />}>
        <div data-shader-demo>
          <HeatShimmerDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
