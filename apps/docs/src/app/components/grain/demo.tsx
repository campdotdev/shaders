'use client';

/**
 * Grain demo island: the interactive slice of the Grain page — control
 * store, shader preview, and control panel for the noise's intensity,
 * animation speed, and blend mode. The shared components/[slug] template
 * renders this between its static header and prose sections.
 */
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import {
  ControlPanel,
  ControlsProvider,
  createControlStore,
  DemoLayout,
  Section,
  SelectInput,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { type GrainParams, INITIAL } from './params';

const GrainScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'Grain', siblings: ['<LinearGradient />'] } as const;

const BLEND_OPTIONS = [
  { label: 'Additive', value: 'additive' },
  { label: 'Subtractive', value: 'subtractive' },
] as const;

/**
 * Reads the live params and renders the scene. Split out from the island so
 * it subscribes to the store on its own — the island component itself never
 * re-renders during a drag, only this and the moved control do.
 */
function GrainDemo() {
  const params = useSnapshot<GrainParams>();

  return (
    <DemoPoster
      alt="Film grain shader preview: violet to magenta gradient overlaid with grain"
      src="/posters/grain.jpg"
    >
      <GrainScene params={params}>
        <VisualTestPause />
      </GrainScene>
    </DemoPoster>
  );
}

function GrainControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<Grain>">
      <Section title="Grain">
        <SliderInput label="Intensity" max={1} min={0} path="intensity" step={0.01} />
        <SliderInput label="Speed" max={2} min={0} path="speed" step={0.01} />
        <SelectInput label="Blend" options={BLEND_OPTIONS} path="blend" />
      </Section>
    </ControlPanel>
  );
}

export function GrainIsland() {
  const store = useMemo(() => createControlStore<GrainParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<GrainControls />}>
        <div data-shader-demo>
          <GrainDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
