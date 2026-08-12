'use client';

/**
 * FractalNoise demo page: shader preview plus an owned control panel for the
 * layered noise field and palette. Sections grow as later phases land
 * (style folds, ramp shaping).
 */
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef } from 'react';

import type { FractalNoiseStyle } from '@matter/registry/fractal-noise';
import { STYLE_DIAL_DEFAULTS } from '@matter/registry/fractal-noise/style-dial-defaults';

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
  usePropValue,
  useSetProp,
  useSnapshot,
} from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL, MAX_STOPS, MIN_STOPS, type Params, type PlainColorStop } from './params';

const FractalNoiseScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'FractalNoise' } as const;

/**
 * Keeps the Contrast/Balance sliders in step with the component's per-style
 * defaults: switching Style writes that style's dial defaults into the store,
 * so the panel shows what an uncontrolled <FractalNoise style="..."> renders.
 * Subscribes to the style leaf only (writing a container path re-renders
 * everything under it — see the demo-store gotcha in AGENTS.md).
 */
function StyleDialSync() {
  const style = usePropValue<FractalNoiseStyle>('style');
  const setProp = useSetProp();
  const previousStyle = useRef(style);

  useEffect(() => {
    if (previousStyle.current === style) return;
    previousStyle.current = style;

    const dials = STYLE_DIAL_DEFAULTS[style];

    setProp('contrast', dials.contrast);
    setProp('balance', dials.balance);
  }, [style, setProp]);

  return null;
}

/** A new palette color clones the last one so the addition is visible. */
const createStop = (stops: readonly PlainColorStop[]): PlainColorStop => {
  const last = stops[stops.length - 1];

  return { color: last?.color ?? 'oklch(0.6 0.15 250)' };
};

function FractalNoiseDemo() {
  const params = useSnapshot<Params>();

  return (
    <DemoPoster
      alt="FractalNoise shader preview: layered blue and violet noise clouds"
      src="/posters/fractal-noise.jpg"
    >
      <FractalNoiseScene params={params}>
        <VisualTestPause />
      </FractalNoiseScene>
    </DemoPoster>
  );
}

function FractalNoiseControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<FractalNoise>">
      <Section title="Texture">
        <SelectInput
          label="Style"
          options={[
            { label: 'Clouds', value: 'clouds' },
            { label: 'Smoke', value: 'smoke' },
            { label: 'Veins', value: 'veins' },
          ]}
          path="style"
        />
        <SliderInput label="Scale" max={10} min={0.5} path="scale" step={0.1} />
        <SliderInput label="Octaves" max={8} min={1} path="octaves" step={1} />
        <SliderInput label="Detail" max={1} min={0} path="detail" step={0.01} />
        <SliderInput label="Speed" max={2} min={0} path="speed" step={0.01} />
        <SliderInput label="Seed" max={100} min={0} path="seed" step={1} />
      </Section>
      <Section title="Shape">
        <SliderInput label="Contrast" max={5} min={0.2} path="contrast" step={0.05} />
        <SliderInput label="Balance" max={1} min={0} path="balance" step={0.01} />
        <SliderInput label="Softness" max={1} min={0} path="softness" step={0.01} />
      </Section>
      <Section title="Mixing">
        <SelectInput label="Color space" options={COLOR_SPACE_OPTIONS} path="colorSpace" />
        <SelectInput label="Hue arc" options={HUE_ARC_OPTIONS} path="hueInterpolation" />
      </Section>
      <ListInput<PlainColorStop>
        createItem={createStop}
        itemLabel="color"
        label="Colors"
        max={MAX_STOPS}
        min={MIN_STOPS}
        path="stops"
      >
        {() => <ColorInput label="Color" path="color" />}
      </ListInput>
    </ControlPanel>
  );
}

export default function FractalNoisePage() {
  const store = useMemo(() => createControlStore<Params>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <StyleDialSync />
      <main style={{ minHeight: '100vh' }}>
        <DemoLayout controls={<FractalNoiseControls />}>
          <div data-shader-demo style={{ position: 'relative' }}>
            <FractalNoiseDemo />
          </div>
        </DemoLayout>
        <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
          <h1 style={{ marginTop: 0 }}>&lt;FractalNoise /&gt;</h1>
          <p>
            Layered fractal noise — several octaves of noise stacked from broad shapes down to fine
            grain, mapped onto a color ramp.
          </p>
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
            {`<ShaderScene>
  <FractalNoise />
</ShaderScene>`}
          </pre>
        </section>
      </main>
    </ControlsProvider>
  );
}
