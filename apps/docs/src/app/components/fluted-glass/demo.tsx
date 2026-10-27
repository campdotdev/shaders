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
      alt="Fluted Glass shader preview: a mesh gradient seen through vertical flutes of glass"
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
      <Section title="Glass">
        <SliderInput label="Flute width" max={160} min={4} path="fluteWidth" step={1} />
        <SliderInput label="Angle" max={360} min={0} path="angle" step={1} />
        <SliderInput label="Refraction" max={3} min={0} path="refraction" step={0.01} />
        <SliderInput label="Cross-section" max={1} min={0} path="crossSection" step={0.01} />
      </Section>
      <Section title="Tuning (dev)">
        <SliderInput
          label="Prism exponent"
          max={0.5}
          min={0.01}
          path="tuning.prismExponent"
          step={0.005}
        />
        <SliderInput label="Flat exponent" max={64} min={2} path="tuning.flatExponent" step={0.5} />
        <SliderInput
          label="Groove smoothing"
          max={4}
          min={0}
          path="tuning.grooveSmoothing"
          step={0.05}
        />
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
