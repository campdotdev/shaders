'use client';

/**
 * The interactive half of a composition page: the scene beside the
 * Customize panel, sharing one store. The store starts from the library
 * defaults the server page read for each entry, with the stack's props on
 * top. The scene loads through next/dynamic with ssr: false, because the
 * component map behind it reaches three/webgpu, which a server render can't
 * load (the SSR gotcha in docs/agents/docs-site.md).
 */
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import { ControlsProvider, DemoLayout, useSnapshot } from '@/components/controls';
import type { CompositionProps } from '@/compositions/composition-scene';
import type { Composition } from '@/compositions/define';
import { type CompositionDefaults, createCompositionStore } from '@/compositions/store';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { CustomizePanel } from './customize-panel';

const CompositionScene = dynamic(
  () => import('@/compositions/composition-scene').then((module) => module.CompositionScene),
  { ssr: false },
);

/**
 * Reads the whole store and draws the scene with it. The one full-snapshot
 * subscription on the page, split out so a drag re-renders only this and the
 * moved control, as controls/README.md describes.
 */
function LiveScene({ composition }: { composition: Composition }) {
  const props = useSnapshot<CompositionProps>();

  return (
    <CompositionScene composition={composition} props={props}>
      <VisualTestPause />
    </CompositionScene>
  );
}

export function CompositionIsland({
  composition,
  defaults,
}: {
  composition: Composition;
  defaults: CompositionDefaults;
}) {
  const store = useMemo(
    () => createCompositionStore(composition, defaults),
    [composition, defaults],
  );

  return (
    <ControlsProvider store={store}>
      <DemoLayout controls={<CustomizePanel composition={composition} store={store} />}>
        <div data-shader-demo>
          <LiveScene composition={composition} />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
