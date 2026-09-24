'use client';

/**
 * Cursor Spotlight demo island: the interactive slice of the Cursor
 * Spotlight page, holding the control store, the shader preview, and the
 * control panel. The shared components/[slug] template renders this between
 * its static header and prose sections.
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

import { type CursorSpotlightParams, INITIAL } from './params';

const CursorSpotlightScene = dynamic(() => import('./scene'), { ssr: false });

/**
 * Reads the live params and renders the scene. Split out from the island so
 * it subscribes to the store on its own: the island never re-renders during
 * a drag, only this and the moved control do.
 */
function CursorSpotlightDemo() {
  const params = useSnapshot<CursorSpotlightParams>();

  return (
    <DemoPoster
      alt="Cursor Spotlight shader preview: a radial gradient at rest, before the pointer moves"
      src="/posters/cursor-spotlight.jpg"
    >
      <CursorSpotlightScene params={params}>
        <VisualTestPause />
      </CursorSpotlightScene>
    </DemoPoster>
  );
}

function CursorSpotlightControls() {
  return (
    <ControlPanel>
      <Section title="Light">
        <SliderInput label="Radius" max={1} min={0} path="radius" step={0.01} />
        <SliderInput label="Intensity" max={2} min={0} path="intensity" step={0.01} />
      </Section>
    </ControlPanel>
  );
}

export function CursorSpotlightIsland() {
  const store = useMemo(() => createControlStore<CursorSpotlightParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<CursorSpotlightControls />}>
        <div data-shader-demo>
          <CursorSpotlightDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
