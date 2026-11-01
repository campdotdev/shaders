'use client';

/**
 * Radial Wipe demo island: the interactive slice of the Radial Wipe page,
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

import { INITIAL, type RadialWipeParams } from './params';

const RadialWipeScene = dynamic(() => import('./scene'), { ssr: false });

/**
 * Reads the live params and renders the scene. Split out from the island so
 * it subscribes to the store on its own: the island never re-renders during
 * a drag, only this and the moved control do.
 */
function RadialWipeDemo() {
  const params = useSnapshot<RadialWipeParams>();

  return (
    <DemoPoster
      alt="Radial Wipe shader preview: a gradient half revealed from the bottom center by a feathered front"
      src="/posters/radial-wipe.jpg"
    >
      <RadialWipeScene params={params}>
        <VisualTestPause />
      </RadialWipeScene>
    </DemoPoster>
  );
}

/**
 * The panel's controls without the panel around them. A composition's All
 * props section mounts them under a stack entry's id, so each path lands in
 * that entry's props.
 */
export function RadialWipeFields() {
  return (
    <>
      <Section title="Wipe">
        <SliderInput label="Progress" max={1} min={0} path="progress" step={0.01} />
        <SliderInput label="Center X" max={1} min={0} path="center.0" step={0.01} />
        <SliderInput label="Center Y" max={1} min={0} path="center.1" step={0.01} />
        <SliderInput label="Feather" max={1} min={0} path="feather" step={0.01} />
      </Section>
    </>
  );
}

function RadialWipeControls() {
  return (
    <ControlPanel>
      <RadialWipeFields />
    </ControlPanel>
  );
}

export function RadialWipeIsland() {
  const store = useMemo(() => createControlStore<RadialWipeParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<RadialWipeControls />}>
        <div data-shader-demo>
          <RadialWipeDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
