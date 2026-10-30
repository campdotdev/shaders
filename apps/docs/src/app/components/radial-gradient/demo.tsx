'use client';

/**
 * RadialGradient demo island: the interactive slice of the RadialGradient
 * page — control store, shader preview, and control panel for the gradient's
 * shape, mixing, and its list of color stops. The shared components/[slug]
 * template renders this between its static header and prose sections.
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
  NumberInput,
  Section,
  SelectInput,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';
import { createStop, newStopIndex } from '@/lib/stops';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL, MAX_STOPS, MIN_STOPS } from './params';
import type { Params, Stop } from './params';

const RadialGradientScene = dynamic(() => import('./scene'), { ssr: false });

function RadialGradientDemo() {
  const params = useSnapshot<Params>();

  return (
    <DemoPoster
      alt="Radial gradient shader preview: a pink core fading through purple into deep blue at the edges"
      src="/posters/radial-gradient.jpg"
    >
      <RadialGradientScene params={params}>
        <VisualTestPause />
      </RadialGradientScene>
    </DemoPoster>
  );
}

/**
 * The panel's controls without the panel around them. A composition's All
 * props section mounts them under a stack entry's id, so each path lands in
 * that entry's props.
 */
export function RadialGradientFields() {
  return (
    <>
      <Section title="Motion">
        <SliderInput label="Speed" max={2} min={0} path="speed" step={0.01} />
      </Section>
      <Section title="Shape">
        <SliderInput label="Radius" max={2} min={0.01} path="radius" step={0.01} />
        <SliderInput label="Center x" max={1} min={0} path="center.0" step={0.01} />
        <SliderInput label="Center y" max={1} min={0} path="center.1" step={0.01} />
        <SliderInput label="Stretch" max={4} min={0.05} path="stretch" step={0.01} />
        <SliderInput label="Angle" max={360} min={0} path="angle" step={1} />
        <SliderInput label="Repeat" max={8} min={1} path="repeat" step={0.1} />
      </Section>
      <Section title="Mixing">
        <SelectInput label="Color space" options={COLOR_SPACE_OPTIONS} path="colorSpace" />
        <SelectInput label="Hue arc" options={HUE_ARC_OPTIONS} path="hueInterpolation" />
      </Section>
      <ListInput<Stop>
        createItem={createStop}
        insertIndex={newStopIndex}
        itemLabel="stop"
        label="Color stops"
        max={MAX_STOPS}
        min={MIN_STOPS}
        path="stops"
      >
        {() => (
          <>
            <ColorInput label="Color" path="color" />
            <NumberInput
              label="Position"
              max={1}
              min={0}
              path="position"
              scale={100}
              step={0.01}
              unit="%"
            />
          </>
        )}
      </ListInput>
    </>
  );
}

function RadialGradientControls() {
  return (
    <ControlPanel>
      <RadialGradientFields />
    </ControlPanel>
  );
}

export function RadialGradientIsland() {
  const store = useMemo(() => createControlStore<Params>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<RadialGradientControls />}>
        <div data-shader-demo>
          <RadialGradientDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
