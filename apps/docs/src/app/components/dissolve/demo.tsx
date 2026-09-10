'use client';

/**
 * Dissolve demo island: the interactive slice of the Dissolve page, holding
 * the control store, the shader preview, and the control panel. The shared
 * components/[slug] template renders this between its static header and
 * prose sections.
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

import { type DissolveParams, INITIAL } from './params';

const DissolveScene = dynamic(() => import('./scene'), { ssr: false });

/**
 * Reads the live params and renders the scene. Split out from the island so
 * it subscribes to the store on its own: the island never re-renders during
 * a drag, only this and the moved control do.
 */
function DissolveDemo() {
  const params = useSnapshot<DissolveParams>();

  return (
    <DemoPoster
      alt="Dissolve shader preview: a gradient half shown as a scatter of blocks"
      src="/posters/dissolve.jpg"
    >
      <DissolveScene params={params}>
        <VisualTestPause />
      </DissolveScene>
    </DemoPoster>
  );
}

function DissolveControls() {
  return (
    <ControlPanel>
      <Section title="Dissolve">
        <SliderInput label="Progress" max={1} min={0} path="progress" step={0.01} />
        <SliderInput label="Pixel size" max={32} min={1} path="pixelSize" step={1} />
      </Section>
      <Section title="Tuning (dev)">
        <SliderInput
          label="Fade width"
          max={0.3}
          min={0.005}
          path="tuning.fadeWidth"
          step={0.005}
        />
        <SliderInput label="Grain" max={1} min={0} path="tuning.grain" step={0.01} />
        <SliderInput
          label="Noise frequency"
          max={8}
          min={0.5}
          path="tuning.noiseFrequency"
          step={0.25}
        />
      </Section>
    </ControlPanel>
  );
}

export function DissolveIsland() {
  const store = useMemo(() => createControlStore<DissolveParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<DissolveControls />}>
        <div data-shader-demo>
          <DissolveDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
