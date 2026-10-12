'use client';

/**
 * LiquidGradient demo island: the interactive slice of the LiquidGradient
 * page — control store, shader preview, and control panel for the bands,
 * the current that streaks them, mixing, and the color stops. The shared
 * components/[slug] template renders this between its static header and
 * prose sections.
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

const LiquidGradientScene = dynamic(() => import('./scene'), { ssr: false });

function LiquidGradientDemo() {
  const params = useSnapshot<Params>();

  return (
    <DemoPoster
      alt="Liquid gradient shader preview: blue, violet, and purple streaked along curling currents"
      src="/posters/liquid-gradient.jpg"
    >
      <LiquidGradientScene params={params}>
        <VisualTestPause />
      </LiquidGradientScene>
    </DemoPoster>
  );
}

function LiquidGradientControls() {
  return (
    <ControlPanel>
      <Section title="Bands">
        <SliderInput label="Angle" max={360} min={0} path="angle" step={1} />
        <SliderInput label="Repeat" max={8} min={1} path="repeat" step={0.1} />
        <SliderInput label="Softness" max={1} min={0} path="softness" step={0.01} />
      </Section>
      <Section title="Flow">
        <SliderInput label="Swirl" max={2} min={0} path="swirl" step={0.01} />
        <SliderInput label="Scale" max={4} min={0.5} path="scale" step={0.1} />
        <SliderInput label="Speed" max={2} min={0} path="speed" step={0.01} />
        <SliderInput label="Seed" max={100} min={0} path="seed" step={1} />
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
    </ControlPanel>
  );
}

export function LiquidGradientIsland() {
  const store = useMemo(() => createControlStore<Params>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<LiquidGradientControls />}>
        <div data-shader-demo>
          <LiquidGradientDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
