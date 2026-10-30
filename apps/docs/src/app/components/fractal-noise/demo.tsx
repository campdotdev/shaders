'use client';

/**
 * FractalNoise demo island: the interactive slice of the FractalNoise page —
 * control store, shader preview, and control panel for the layered noise
 * field and palette. The shared components/[slug] template renders this
 * between its static header and prose sections.
 */
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import { type FractalNoiseStyle, STYLE_DIAL_DEFAULTS } from '@camp-dev/shaders';

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
import { SelectField } from '@/components/controls/SelectInput';
import { DemoPoster } from '@/components/DemoPoster';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL, MAX_STOPS, MIN_STOPS, type Params, type PlainColorStop } from './params';
import { isFractalNoiseStyle } from './style-dials';

const FractalNoiseScene = dynamic(() => import('./scene'), { ssr: false });

const STYLE_OPTIONS = [
  { label: 'Clouds', value: 'clouds' },
  { label: 'Smoke', value: 'smoke' },
  { label: 'Veins', value: 'veins' },
];

/**
 * The Style select. Picking a style also writes that style's dial defaults
 * into Contrast and Balance, so the panel shows what an uncontrolled
 * <FractalNoise style="..."> renders. Only a pick does: a preset load or a
 * Reset sets the style and the dials together, and keeps the dials it sets.
 * Subscribes to the style leaf only (writing a container path re-renders
 * everything under it — see the demo-store gotcha in docs/agents/docs-site.md).
 */
function StyleSelect() {
  const style = usePropValue<FractalNoiseStyle>('style');
  const setProp = useSetProp();

  return (
    <SelectField
      label="Style"
      onValueChange={(next) => {
        if (!isFractalNoiseStyle(next)) return;

        const dials = STYLE_DIAL_DEFAULTS[next];

        setProp('style', next);
        setProp('contrast', dials.contrast);
        setProp('balance', dials.balance);
      }}
      options={STYLE_OPTIONS}
      value={style}
    />
  );
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

/**
 * The panel's controls without the panel around them. A composition's All
 * props section mounts them under a stack entry's id, so each path lands in
 * that entry's props.
 */
export function FractalNoiseFields() {
  return (
    <>
      <Section title="Texture">
        <StyleSelect />
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
    </>
  );
}

function FractalNoiseControls() {
  return (
    <ControlPanel>
      <FractalNoiseFields />
    </ControlPanel>
  );
}

export function FractalNoiseIsland() {
  const store = useMemo(() => createControlStore<Params>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<FractalNoiseControls />}>
        <div data-shader-demo>
          <FractalNoiseDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
