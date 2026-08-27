'use client';

/**
 * Vignette demo island: the interactive slice of the Vignette page — control
 * store, shader preview, and control panel for the mask's shape (intensity,
 * feather, radius, center) and color mixing. The shared components/[slug]
 * template renders this between its static header and prose sections.
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
  Section,
  SelectInput,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL, type VignetteParams } from './params';

const VignetteScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'Vignette', siblings: ['<LinearGradient />'] } as const;

function VignetteDemo() {
  const params = useSnapshot<VignetteParams>();

  return (
    <DemoPoster
      alt="Vignette shader preview: a violet-to-magenta gradient darkened toward the edges"
      src="/posters/vignette.jpg"
    >
      <VignetteScene params={params}>
        <VisualTestPause />
      </VignetteScene>
    </DemoPoster>
  );
}

function VignetteControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<Vignette>">
      <Section title="Shape">
        <SliderInput label="Intensity" max={1} min={0} path="intensity" step={0.01} />
        <SliderInput label="Feather" max={1} min={0} path="feather" step={0.01} />
        <SliderInput label="Radius" max={1.5} min={0} path="radius" step={0.01} />
        <SliderInput label="Center x" max={1} min={0} path="center.0" step={0.01} />
        <SliderInput label="Center y" max={1} min={0} path="center.1" step={0.01} />
      </Section>
      <Section title="Color">
        <ColorInput label="Color" path="color" />
        <SelectInput label="Color space" options={COLOR_SPACE_OPTIONS} path="colorSpace" />
        <SelectInput label="Hue arc" options={HUE_ARC_OPTIONS} path="hueInterpolation" />
      </Section>
    </ControlPanel>
  );
}

export function VignetteIsland() {
  const store = useMemo(() => createControlStore<VignetteParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<VignetteControls />}>
        <div data-shader-demo>
          <VignetteDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
