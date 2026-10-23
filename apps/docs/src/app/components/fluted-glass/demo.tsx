'use client';

/**
 * Fluted Glass demo island: the interactive slice of the Fluted Glass page,
 * holding the control store, the shader preview, and the control panel. The
 * shared components/[slug] template renders this between its static header
 * and prose sections.
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

import { type FlutedGlassParams, INITIAL } from './params';

const FlutedGlassScene = dynamic(() => import('./scene'), { ssr: false });

/**
 * Reads the live params and renders the scene. Split out from the island so
 * it subscribes to the store on its own: the island never re-renders during
 * a drag, only this and the moved control do.
 */
function FlutedGlassDemo() {
  const params = useSnapshot<FlutedGlassParams>();

  return (
    <DemoPoster
      alt="Fluted Glass shader preview: a mesh gradient seen through vertical ribbed glass"
      src="/posters/fluted-glass.jpg"
    >
      <FlutedGlassScene params={params}>
        <VisualTestPause />
      </FlutedGlassScene>
    </DemoPoster>
  );
}

function FlutedGlassControls() {
  return (
    <ControlPanel>
      <Section title="Flutes">
        <SliderInput label="Width" max={160} min={4} path="width" step={1} />
        <SliderInput label="Angle" max={180} min={-180} path="angle" step={1} />
        <SliderInput label="Softness" max={1} min={0} path="softness" step={0.01} />
      </Section>
      <Section title="Glass">
        <SliderInput label="Refraction" max={1} min={0} path="refraction" step={0.01} />
        <SliderInput label="Shine" max={1} min={0} path="shine" step={0.01} />
        <SliderInput label="Shadow" max={1} min={0} path="shadow" step={0.01} />
      </Section>
      <Section title="Motion">
        <SliderInput label="Sway" max={1} min={0} path="sway" step={0.01} />
        <SliderInput label="Sway frequency" max={8} min={0} path="swayFrequency" step={0.1} />
        <SliderInput label="Speed" max={4} min={-4} path="speed" step={0.1} />
      </Section>
    </ControlPanel>
  );
}

export function FlutedGlassIsland() {
  const store = useMemo(() => createControlStore<FlutedGlassParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<FlutedGlassControls />}>
        <div data-shader-demo>
          <FlutedGlassDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
