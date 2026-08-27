'use client';

/**
 * ConicGradient demo island: the interactive slice of the ConicGradient page
 * — control store, shader preview, and control panel for the sweep's shape,
 * mixing, and its list of color stops. The shared components/[slug] template
 * renders this between its static header and prose sections.
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

const ConicGradientScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'ConicGradient' } as const;

function ConicGradientDemo() {
  const params = useSnapshot<Params>();

  return (
    <DemoPoster
      alt="Conic gradient shader preview: a magenta, purple, and blue wheel sweeping clockwise around the center"
      src="/posters/conic-gradient.jpg"
    >
      <ConicGradientScene params={params}>
        <VisualTestPause />
      </ConicGradientScene>
    </DemoPoster>
  );
}

function ConicGradientControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<ConicGradient>">
      <Section title="Motion">
        <SliderInput label="Speed" max={2} min={-2} path="speed" step={0.01} />
      </Section>
      <Section title="Shape">
        <SliderInput label="Center x" max={1} min={0} path="center.0" step={0.01} />
        <SliderInput label="Center y" max={1} min={0} path="center.1" step={0.01} />
        <SliderInput label="Angle" max={360} min={0} path="angle" step={1} />
        <SliderInput label="Repeat" max={8} min={0.1} path="repeat" step={0.1} />
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
            <SliderInput label="Position" max={1} min={0} path="position" step={0.01} />
          </>
        )}
      </ListInput>
    </ControlPanel>
  );
}

export function ConicGradientIsland() {
  const store = useMemo(() => createControlStore<Params>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<ConicGradientControls />}>
        <div data-shader-demo>
          <ConicGradientDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
