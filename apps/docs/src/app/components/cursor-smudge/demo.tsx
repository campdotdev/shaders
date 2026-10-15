'use client';

// The interactive part of the Cursor Smudge page owns its control store.
// The scene loads in the browser because three's renderer cannot run in SSR.
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

import { type CursorSmudgeParams, INITIAL } from './params';

const CursorSmudgeScene = dynamic(() => import('./scene'), { ssr: false });

// ---- Live preview
// Only this subscriber and the changed control rerender during a slider drag.
function CursorSmudgeDemo() {
  const params = useSnapshot<CursorSmudgeParams>();

  return (
    <DemoPoster
      alt="Cursor Smudge preview: a liquid gradient at rest before the pointer moves"
      src="/posters/cursor-smudge.jpg"
    >
      <CursorSmudgeScene params={params}>
        <VisualTestPause />
      </CursorSmudgeScene>
    </DemoPoster>
  );
}

// ---- Controls and page layout
function CursorSmudgeControls() {
  return (
    <ControlPanel>
      <Section title="Smudge">
        <SliderInput label="Strength" max={0.3} min={0} path="strength" step={0.01} />
        <SliderInput label="Radius" max={0.5} min={0} path="radius" step={0.01} />
        <SliderInput label="Decay" max={1} min={0} path="decay" step={0.01} />
      </Section>
    </ControlPanel>
  );
}

export function CursorSmudgeIsland() {
  const store = useMemo(() => createControlStore<CursorSmudgeParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<CursorSmudgeControls />}>
        <div data-shader-demo>
          <CursorSmudgeDemo />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
