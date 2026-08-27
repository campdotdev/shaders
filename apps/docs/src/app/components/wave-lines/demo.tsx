'use client';

/**
 * WaveLines demo island: the interactive slice of the WaveLines page —
 * control store, shader preview, and control panel for motion, shape, and
 * light, plus a nested list of lines, each with its own color stops. The
 * shared components/[slug] template renders this between its static header
 * and prose sections.
 *
 * The legacy page rendered a live usage snippet (formatJsx over the store's
 * params) in its prose section. The template's Usage section is a server
 * component outside this island's store, so that snippet is a static string
 * for now; the Usage-section issue (SHA-114) decides whether a live one
 * comes back.
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
  ListInput,
  Section,
  SelectInput,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';
import { VisualTestPause } from '@/lib/visualTestHooks';

import styles from './demo.module.css';
import {
  INITIAL,
  MAX_LINES,
  MAX_STOPS,
  MIN_LINES,
  MIN_STOPS,
  type Params,
  type WaveLineParams,
} from './params';

const WaveLinesScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'WaveLines' } as const;

const FALLBACK_COLOR = 'oklch(0.6 0.15 250)';

/** New lines and new stops clone the last one so the addition is visible. */
const createLine = (lines: readonly WaveLineParams[]): WaveLineParams => {
  const last = lines[lines.length - 1];

  return { color: last !== undefined ? [...last.color] : [FALLBACK_COLOR] };
};

const createStop = (colors: readonly string[]): string =>
  colors[colors.length - 1] ?? FALLBACK_COLOR;

function WaveLinesDemo() {
  const params = useSnapshot<Params>();

  return (
    <DemoPoster
      alt="WaveLines shader preview: an eight-line blue-to-violet wave bundle braiding and breathing over a dark field"
      src="/posters/wave-lines.jpg"
    >
      <WaveLinesScene params={params}>
        <VisualTestPause />
      </WaveLinesScene>
    </DemoPoster>
  );
}

function WaveLinesControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<WaveLines>">
      <Section title="Motion">
        <SliderInput label="Speed" max={4} min={0} path="speed" step={0.05} />
        <SliderInput label="Amplitude" max={0.5} min={0} path="amplitude" step={0.005} />
        <SliderInput label="Frequency" max={10} min={0.1} path="frequency" step={0.05} />
        <SliderInput label="Braiding" max={2} min={0} path="braiding" step={0.01} />
        <SliderInput label="Breathing" max={1} min={0} path="breathing" step={0.01} />
      </Section>
      <Section title="Shape">
        <SliderInput label="Thickness" max={8} min={0.01} path="thickness" step={0.01} />
        <SliderInput label="Softness" max={1} min={0} path="softness" step={0.01} />
        <SliderInput label="Baseline" max={1} min={-1} path="baseline" step={0.01} />
        <SliderInput label="Flare" max={6} min={0} path="flare" step={0.05} />
        <SliderInput label="Flare radius" max={1.5} min={0.05} path="flareRadius" step={0.01} />
      </Section>
      <Section title="Light">
        <SliderInput label="Brightness" max={2} min={0} path="brightness" step={0.01} />
        <SliderInput label="Opacity" max={1} min={0} path="opacity" step={0.001} />
        <SliderInput label="Color drift" max={1} min={0} path="colorDrift" step={0.01} />
        <SelectInput label="Color space" options={COLOR_SPACE_OPTIONS} path="colorSpace" />
      </Section>
      <ListInput<WaveLineParams>
        createItem={createLine}
        itemLabel="line"
        label="Lines"
        max={MAX_LINES}
        min={MIN_LINES}
        path="lines"
      >
        {() => (
          <ListInput<string>
            createItem={createStop}
            itemLabel="stop"
            label="Colors"
            max={MAX_STOPS}
            min={MIN_STOPS}
            path="color"
          >
            {() => <ColorInput label="Color" path="" />}
          </ListInput>
        )}
      </ListInput>
    </ControlPanel>
  );
}

export function WaveLinesIsland() {
  const store = useMemo(() => createControlStore<Params>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<WaveLinesControls />}>
        <div className={styles.demoBackdrop} data-shader-demo>
          <WaveLinesDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
