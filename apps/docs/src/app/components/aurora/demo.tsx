'use client';

/**
 * Aurora demo island: the interactive slice of the Aurora page — control
 * store, shader preview, and control panel. The shared components/[slug]
 * template renders this between its static header and prose sections, so
 * only this slice ships as client JavaScript. The store provider, the live
 * scene, and the controls are exported on their own too, for a second host
 * that lays out the demo itself with a store of its own: the homepage hero,
 * which turns into this demo as the page scrolls (components/home-hero).
 */
import dynamic from 'next/dynamic';
import { type ReactNode, useMemo } from 'react';

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

import styles from './demo.module.css';
import {
  type AuroraParams,
  INITIAL,
  MAX_STOPS,
  MIN_STOPS,
  type PlainColorStop,
  POSTER_SRC,
} from './params';

const AuroraScene = dynamic(() => import('./scene'), { ssr: false });

/**
 * A fresh control store at Aurora's defaults, created when the provider
 * mounts, so every host starts from INITIAL and shares no state with another.
 */
export function AuroraControlsProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createControlStore<AuroraParams>(INITIAL), []);

  return <ControlsProvider store={store}>{children}</ControlsProvider>;
}

/**
 * Aurora's scene with the nearest store's live params. This is the demo's one
 * whole-object subscriber, kept in a component with nothing under it but the
 * scene, so a slider drag re-renders only the scene, not the host and its
 * unmemoized controls (the demo-store gotcha in docs/agents/docs-site.md).
 * It fills its parent, so the host sizes the box.
 */
export function LiveAuroraScene({
  paused,
  children,
}: {
  /** Freezes the scene on its current frame, passed to ShaderScene. */
  paused?: boolean;
  children?: ReactNode;
}) {
  const params = useSnapshot<AuroraParams>();

  return (
    <AuroraScene params={params} paused={paused}>
      {children}
    </AuroraScene>
  );
}

function AuroraDemo() {
  return (
    <DemoPoster
      alt="Aurora shader preview: green and teal light curtains with a blue veil and pink fringe over a dark backdrop"
      src={POSTER_SRC}
    >
      <LiveAuroraScene>
        <VisualTestPause />
      </LiveAuroraScene>
    </DemoPoster>
  );
}

export function AuroraControls() {
  return (
    <ControlPanel>
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
        label="Stops"
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

export function AuroraIsland() {
  return (
    <AuroraControlsProvider>
      <DemoLayout controls={<AuroraControls />}>
        <div className={styles.demoBackdrop} data-shader-demo>
          <AuroraDemo />
        </div>
      </DemoLayout>
    </AuroraControlsProvider>
  );
}
