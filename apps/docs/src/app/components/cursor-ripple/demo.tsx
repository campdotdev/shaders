'use client';

/**
 * Cursor Ripple demo island: the interactive slice of the Cursor Ripple
 * page, holding the control store, the shader preview, and the control
 * panel. The shared components/[slug] template renders this between its
 * static header and prose sections.
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

import { type CursorRippleParams, INITIAL } from './params';

const CursorRippleScene = dynamic(() => import('./scene'), { ssr: false });

/**
 * Reads the live params and renders the scene. Split out from the island so
 * it subscribes to the store on its own: the island never re-renders during
 * a drag, only this and the moved control do.
 */
function CursorRippleDemo() {
  const params = useSnapshot<CursorRippleParams>();

  return (
    <DemoPoster
      alt="Cursor Ripple shader preview: a mesh gradient at rest, before the pointer moves"
      src="/posters/cursor-ripple.jpg"
    >
      <CursorRippleScene params={params}>
        <VisualTestPause />
      </CursorRippleScene>
    </DemoPoster>
  );
}

function CursorRippleControls() {
  return (
    <ControlPanel>
      <Section title="Water">
        <SliderInput label="Refraction" max={0.5} min={0} path="refraction" step={0.01} />
        <SliderInput label="Radius" max={0.15} min={0.005} path="radius" step={0.005} />
        <SliderInput label="Decay" max={1} min={0} path="decay" step={0.01} />
        <SliderInput label="Shine" max={2} min={0} path="shine" step={0.01} />
      </Section>
    </ControlPanel>
  );
}

export function CursorRippleIsland() {
  const store = useMemo(() => createControlStore<CursorRippleParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<CursorRippleControls />}>
        <div data-shader-demo>
          <CursorRippleDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
