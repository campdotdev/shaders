'use client';

/**
 * Fluted Glass demo island: the interactive slice of the Fluted Glass page,
 * holding the control store, the shader preview, and the control panel. The
 * shared components/[slug] template renders this between its static header
 * and prose sections.
 */
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import {
  ColorInput,
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

import { type FlutedGlassParams, INITIAL } from './params';

const FlutedGlassScene = dynamic(() => import('./scene'), { ssr: false });

/**
 * The CSS size the poster was captured at in build-posters.sh, the widest
 * demo box. The flutes are sized in CSS pixels, so DemoPoster's pixel-locked
 * mode shows the image at this size and lets the box crop it. Cover-scaling
 * would change the flutes' spacing, and the grooves would jump when the live
 * scene replaced the poster.
 */
const POSTER_SIZE: readonly [number, number] = [896, 598];

/**
 * Reads the live params and renders the scene. Split out from the island so
 * it subscribes to the store on its own: the island never re-renders during
 * a drag, only this and the moved control do.
 */
function FlutedGlassDemo() {
  const params = useSnapshot<FlutedGlassParams>();

  return (
    <DemoPoster
      alt="Fluted Glass shader preview: a mesh gradient seen through vertical flutes of glass"
      pixelSize={POSTER_SIZE}
      src="/posters/fluted-glass.jpg"
    >
      <FlutedGlassScene params={params}>
        <VisualTestPause />
      </FlutedGlassScene>
    </DemoPoster>
  );
}

function FlutedGlassControls() {
  return (
    <ControlPanel>
      <Section title="Glass">
        <SliderInput label="Flute width" max={160} min={4} path="fluteWidth" step={1} />
        <SliderInput label="Angle" max={360} min={0} path="angle" step={1} />
        <SliderInput label="Refraction" max={3} min={0} path="refraction" step={0.01} />
        <SliderInput label="Cross-section" max={1} min={0} path="crossSection" step={0.01} />
      </Section>
      <Section title="Light">
        <SliderInput label="Light angle" max={360} min={0} path="lightAngle" step={1} />
        <SliderInput label="Highlight" max={1} min={0} path="highlight" step={0.01} />
        <ColorInput label="Highlight color" path="highlightColor" />
        <SliderInput label="Shadow" max={1} min={0} path="shadow" step={0.01} />
      </Section>
    </ControlPanel>
  );
}

export function FlutedGlassIsland() {
  const store = useMemo(() => createControlStore<FlutedGlassParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<FlutedGlassControls />}>
        <div data-shader-demo>
          <FlutedGlassDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
