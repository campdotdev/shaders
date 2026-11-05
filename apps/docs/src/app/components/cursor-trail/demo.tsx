'use client';

// The interactive part of the Cursor Trail page owns its control store.
// The scene loads in the browser because three's renderer cannot run in SSR.
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

import { type CursorTrailParams, INITIAL } from './params';

const CursorTrailScene = dynamic(() => import('./scene'), { ssr: false });

// ---- Live preview
// Only this subscriber and the changed control rerender during a slider drag.
function CursorTrailDemo() {
  const params = useSnapshot<CursorTrailParams>();

  return (
    <DemoPoster
      alt="Cursor Trail preview: a dark gradient before the pointer moves"
      src="/posters/cursor-trail.jpg"
    >
      <CursorTrailScene params={params}>
        <VisualTestPause />
      </CursorTrailScene>
    </DemoPoster>
  );
}

// ---- Controls and page layout
/**
 * The panel's controls without the panel around them. A composition's All
 * props section mounts them under a stack entry's id, so each path lands in
 * that entry's props.
 */
export function CursorTrailFields() {
  return (
    <>
      <Section title="Trail">
        <SliderInput label="Radius" max={0.4} min={0} path="radius" step={0.01} />
        <SliderInput label="Intensity" max={2} min={0} path="intensity" step={0.05} />
        <SliderInput label="Decay" max={3} min={0} path="decay" step={0.05} />
        <SliderInput label="Grow" max={2} min={0} path="grow" step={0.05} />
        <SliderInput label="Smoothing" max={0.3} min={0} path="smoothing" step={0.01} />
        <SelectInput
          label="Hold"
          options={[
            { label: 'Off', value: false },
            { label: 'On', value: true },
          ]}
          path="hold"
        />
      </Section>
    </>
  );
}

function CursorTrailControls() {
  return (
    <ControlPanel>
      <CursorTrailFields />
    </ControlPanel>
  );
}

export function CursorTrailIsland() {
  const store = useMemo(() => createControlStore<CursorTrailParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<CursorTrailControls />}>
        <div data-shader-demo>
          <CursorTrailDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
