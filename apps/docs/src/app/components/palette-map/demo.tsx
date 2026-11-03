'use client';

/**
 * PaletteMap demo island: the interactive slice of the PaletteMap page —
 * control store, shader preview, and control panel for the palette, the cell
 * size, and the dither's spread. The shared components/[slug] template
 * renders this between its static header and prose sections.
 */
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import {
  ColorInput,
  ControlPanel,
  ControlsProvider,
  createControlStore,
  DemoLayout,
  ListInput,
  Section,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL, MAX_COLORS, MIN_COLORS, type PaletteMapParams } from './params';

const PaletteMapScene = dynamic(() => import('./scene'), { ssr: false });

/** A new color clones the last one in the list so the addition is visible. */
const createColor = (colors: readonly string[]): string =>
  colors[colors.length - 1] ?? 'oklch(0.9 0.12 90)';

function PaletteMapDemo() {
  const params = useSnapshot<PaletteMapParams>();

  return (
    <DemoPoster
      alt="PaletteMap shader preview: a gray noise field repainted in four colors from deep violet to pale gold, with scattered cells where two colors meet"
      src="/posters/palette-map.jpg"
    >
      <PaletteMapScene params={params}>
        <VisualTestPause />
      </PaletteMapScene>
    </DemoPoster>
  );
}

/**
 * The panel's controls without the panel around them. A composition's All
 * props section mounts them under a stack entry's id, so each path lands in
 * that entry's props.
 */
export function PaletteMapFields() {
  return (
    <>
      <Section title="Cells">
        <SliderInput label="Pixel size" max={24} min={1} path="pixelSize" step={1} />
        <SliderInput label="Spread" max={2} min={0} path="spread" step={0.05} />
      </Section>
      <ListInput<string>
        createItem={createColor}
        itemLabel="color"
        label="Colors"
        max={MAX_COLORS}
        min={MIN_COLORS}
        path="colors"
      >
        {() => <ColorInput label="Color" path="" />}
      </ListInput>
    </>
  );
}

function PaletteMapControls() {
  return (
    <ControlPanel>
      <PaletteMapFields />
    </ControlPanel>
  );
}

export function PaletteMapIsland() {
  const store = useMemo(() => createControlStore<PaletteMapParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<PaletteMapControls />}>
        <div data-shader-demo>
          <PaletteMapDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
