'use client';

/**
 * Aurora demo island: the interactive slice of the Aurora page — control
 * store, shader preview, and control panel. The shared components/[slug]
 * template renders this between its static header and prose sections, so
 * only this slice ships as client JavaScript.
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

import styles from './demo.module.css';
import { type AuroraParams, INITIAL, MAX_STOPS, MIN_STOPS, type PlainColorStop } from './params';

const AuroraScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'Aurora' } as const;

function AuroraDemo() {
  const params = useSnapshot<AuroraParams>();

  return (
    <DemoPoster
      alt="Aurora shader preview: green and teal light curtains with a blue veil and pink fringe over a dark backdrop"
      src="/posters/aurora.jpg"
    >
      <AuroraScene params={params}>
        <VisualTestPause />
      </AuroraScene>
    </DemoPoster>
  );
}

function AuroraControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<Aurora>">
      <Section title="Motion">
        <SliderInput label="Speed" max={3} min={0} path="speed" step={0.01} />
        <SliderInput label="Waviness" max={3} min={0} path="waviness" step={0.01} />
      </Section>
      <Section title="Shape">
        <SliderInput label="Intensity" max={3} min={0} path="intensity" step={0.01} />
        <SliderInput label="Coverage" max={1} min={0} path="coverage" step={0.01} />
      </Section>
      <Section title="Mixing">
        <SelectInput label="Color space" options={COLOR_SPACE_OPTIONS} path="colorSpace" />
        <SelectInput label="Hue arc" options={HUE_ARC_OPTIONS} path="hueInterpolation" />
      </Section>
      <ListInput<PlainColorStop>
        createItem={createStop}
        insertIndex={newStopIndex}
        itemLabel="stop"
        label="Stops (low to high altitude)"
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

export function AuroraIsland() {
  const store = useMemo(() => createControlStore<AuroraParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<AuroraControls />}>
        <div className={styles.demoBackdrop} data-shader-demo>
          <AuroraDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
