'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import {
  COLOR_SPACE_OPTIONS,
  ColorInput,
  ControlPanel,
  ControlsProvider,
  createControlStore,
  DemoLayout,
  formatJsx,
  ListInput,
  Section,
  SelectInput,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';
import { VisualTestPause } from '@/lib/visualTestHooks';

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

/**
 * The prose section's live usage snippet. Split out so it alone subscribes to
 * the store -- it re-renders on every drag tick, which is correct here since
 * it sits below the fold and doesn't drag the control panel with it.
 */
function WaveLinesUsage() {
  const params = useSnapshot<Params>();

  return (
    <pre
      style={{
        background: '#1a1a2a',
        color: '#e0e0f0',
        padding: '1rem',
        borderRadius: '0.5rem',
        fontSize: '0.85rem',
        whiteSpace: 'pre-wrap',
      }}
    >
      {formatJsx(COPY_CONFIG, params)}
    </pre>
  );
}

export default function WaveLinesPage() {
  const store = useMemo(() => createControlStore<Params>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <main style={{ minHeight: '100vh' }}>
        <DemoLayout controls={<WaveLinesControls />}>
          <div data-shader-demo style={{ position: 'relative', background: '#0a0a14' }}>
            <WaveLinesDemo />
          </div>
        </DemoLayout>
        <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
          <h1 style={{ marginTop: 0 }}>&lt;WaveLines /&gt;</h1>
          <p>
            A coherent bundle of glowing wave ribbons in an analogous blue-to-violet run. The lines
            share one wave and braid, breathe, and fray wide toward the canvas edges; each line
            takes a flat color or a gradient.
          </p>
          <WaveLinesUsage />
        </section>
      </main>
    </ControlsProvider>
  );
}
