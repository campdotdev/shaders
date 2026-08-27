'use client';

/**
 * Dither demo island: the interactive slice of the Dither page — control
 * store, shader preview, and control panel for the threshold pattern, cell
 * size, and quantization levels. The shared components/[slug] template
 * renders this between its static header and prose sections.
 */
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import {
  ControlPanel,
  ControlsProvider,
  createControlStore,
  DemoLayout,
  Section,
  SelectInput,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { type DitherParams, INITIAL } from './params';

const DitherScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'Dither', siblings: ['<MeshGradient />'] } as const;

const PATTERN_OPTIONS = [
  { label: 'Bayer 2x2', value: 'bayer-2x2' },
  { label: 'Bayer 4x4', value: 'bayer-4x4' },
  { label: 'Bayer 8x8', value: 'bayer-8x8' },
  { label: 'Dots', value: 'dots' },
  { label: 'Lines', value: 'lines' },
  { label: 'White noise', value: 'white-noise' },
  { label: 'Blue noise', value: 'blue-noise' },
  { label: 'Gradient noise', value: 'gradient-noise' },
] as const;

/**
 * Reads the live params and renders the scene. Split out from the island so
 * it subscribes to the store on its own — the island component itself never
 * re-renders during a drag, only this and the moved control do.
 */
function DitherDemo() {
  const params = useSnapshot<DitherParams>();

  return (
    <DemoPoster
      alt="Dither shader preview: mesh gradient pixelated into chunky ordered-dither cells"
      src="/posters/dither.jpg"
    >
      <DitherScene params={params}>
        <VisualTestPause />
      </DitherScene>
    </DemoPoster>
  );
}

function DitherControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<Dither>">
      <Section title="Dither">
        <SelectInput label="Pattern" options={PATTERN_OPTIONS} path="pattern" />
        <SliderInput label="Pixel size" max={24} min={1} path="pixelSize" step={1} />
        <SliderInput label="Levels" max={8} min={2} path="levels" step={1} />
        <SliderInput label="Spread" max={2} min={0} path="spread" step={0.05} />
        <SliderInput label="Threshold" max={1} min={0} path="threshold" step={0.01} />
      </Section>
    </ControlPanel>
  );
}

export function DitherIsland() {
  const store = useMemo(() => createControlStore<DitherParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<DitherControls />}>
        <div data-shader-demo>
          <DitherDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
