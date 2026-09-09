'use client';

/**
 * LED Wall demo island: the interactive slice of the LED Wall page, holding
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

import { INITIAL, type LedWallParams } from './params';

const LedWallScene = dynamic(() => import('./scene'), { ssr: false });

/**
 * Reads the live params and renders the scene. Split out from the island so
 * it subscribes to the store on its own: the island never re-renders during
 * a drag, only this and the moved control do.
 */
function LedWallDemo() {
  const params = useSnapshot<LedWallParams>();

  return (
    <DemoPoster
      alt="LED Wall shader preview: a gradient screened into a grid of square lit dots"
      src="/posters/led-wall.jpg"
    >
      <LedWallScene params={params}>
        <VisualTestPause />
      </LedWallScene>
    </DemoPoster>
  );
}

function LedWallControls() {
  return (
    <ControlPanel>
      <Section title="Grid">
        <SliderInput label="Spacing" max={24} min={2} path="spacing" step={1} />
        <SliderInput label="Dot size" max={24} min={1} path="dotSize" step={1} />
        <SliderInput label="Bleed" max={1} min={0} path="bleed" step={0.01} />
      </Section>
      <Section title="Reveal">
        <SliderInput label="Progress" max={1} min={0} path="progress" step={0.01} />
        <SliderInput label="Center X" max={1} min={0} path="centerX" step={0.01} />
        <SliderInput label="Center Y" max={1} min={0} path="centerY" step={0.01} />
        <SliderInput label="Waviness" max={1} min={0} path="waviness" step={0.01} />
      </Section>
      <Section title="Motion">
        <SliderInput label="Flicker" max={1} min={0} path="flicker" step={0.01} />
        <SliderInput label="Speed" max={8} min={0} path="speed" step={0.1} />
      </Section>
      <Section title="Tuning (dev)">
        <SliderInput
          label="Fade width"
          max={0.3}
          min={0.005}
          path="tuning.fadeWidth"
          step={0.005}
        />
        <SliderInput label="Jitter" max={0.5} min={0} path="tuning.jitter" step={0.01} />
        <SliderInput label="Warp amount" max={1.5} min={0} path="tuning.warpAmount" step={0.05} />
        <SliderInput
          label="Warp frequency"
          max={8}
          min={0.5}
          path="tuning.warpFrequency"
          step={0.25}
        />
        <SliderInput label="Variance" max={0.9} min={0} path="tuning.variance" step={0.01} />
      </Section>
    </ControlPanel>
  );
}

export function LedWallIsland() {
  const store = useMemo(() => createControlStore<LedWallParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<LedWallControls />}>
        <div data-shader-demo>
          <LedWallDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
