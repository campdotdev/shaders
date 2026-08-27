'use client';

/**
 * MeshGradient demo island: the interactive slice of the MeshGradient page —
 * control store, shader preview, and control panel for motion, palette
 * cycling, and the two four-color palettes the gradient crossfades between.
 * The shared components/[slug] template renders this between its static
 * header and prose sections.
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
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL, PALETTE_SIZE, type Params } from './params';

const MeshGradientScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'MeshGradient' } as const;

/** A new palette color clones the last one in its list so the addition is visible. */
const createColor = (colors: readonly string[]): string =>
  colors[colors.length - 1] ?? 'oklch(0.6 0.15 250)';

function MeshGradientDemo() {
  const params = useSnapshot<Params>();

  return (
    <DemoPoster
      alt="Mesh gradient shader preview: warped four-color gradient blending pink, magenta, yellow, and orange"
      src="/posters/mesh-gradient.jpg"
    >
      <MeshGradientScene params={params}>
        <VisualTestPause />
      </MeshGradientScene>
    </DemoPoster>
  );
}

function MeshGradientControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<MeshGradient>">
      <Section title="Motion">
        <SliderInput label="Speed" max={5} min={0} path="speed" step={0.01} />
        <SliderInput label="Frequency" max={20} min={0.5} path="frequency" step={0.1} />
        <SliderInput label="Amplitude" max={100} min={5} path="amplitude" step={0.5} />
      </Section>
      <Section title="Palette cycle">
        <SliderInput label="Cycle speed" max={2} min={0} path="cycleSpeed" step={0.01} />
        <SliderInput label="Cycle ease" max={3} min={0.1} path="cycleEase" step={0.01} />
      </Section>
      <Section title="Mixing">
        <SelectInput label="Color space" options={COLOR_SPACE_OPTIONS} path="colorSpace" />
        <SelectInput label="Hue arc" options={HUE_ARC_OPTIONS} path="hueInterpolation" />
      </Section>
      <ListInput<string>
        createItem={createColor}
        itemLabel="color"
        label="Palette A"
        max={PALETTE_SIZE}
        min={PALETTE_SIZE}
        path="palettes.0"
      >
        {() => <ColorInput label="Color" path="" />}
      </ListInput>
      <ListInput<string>
        createItem={createColor}
        itemLabel="color"
        label="Palette B"
        max={PALETTE_SIZE}
        min={PALETTE_SIZE}
        path="palettes.1"
      >
        {() => <ColorInput label="Color" path="" />}
      </ListInput>
    </ControlPanel>
  );
}

export function MeshGradientIsland() {
  const store = useMemo(() => createControlStore<Params>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<MeshGradientControls />}>
        <div data-shader-demo>
          <MeshGradientDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
