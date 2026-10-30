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
import { useMemo, useSyncExternalStore } from 'react';

import { COMPONENT_FIELDS } from '@/app/components/demo-registry';
import { ControlsProvider, DemoLayout, useSnapshot } from '@/components/controls';
import type { CompositionProps } from '@/compositions/composition-scene';
import type { Composition } from '@/compositions/define';
import {
  type CompositionDefaults,
  type CompositionStore,
  createCompositionStore,
  type SeedFields,
} from '@/compositions/store';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { CustomizePanel } from './customize-panel';

const CompositionScene = dynamic(
  () => import('@/compositions/composition-scene').then((module) => module.CompositionScene),
  { ssr: false },
);

/**
 * Reads the whole store and draws the scene with it. The one full-snapshot
 * subscription on the page, split out so a drag re-renders only this and the
 * moved control, as controls/README.md describes. VisualTestPause remounts
 * on every preset the picker loads, so the visual spec can capture each
 * preset as a fresh, deterministic frame.
 */
function LiveScene({ composition, store }: { composition: Composition; store: CompositionStore }) {
  const props = useSnapshot<CompositionProps>();
  const preset = useSyncExternalStore(store.subscribe, store.getPreset, store.getPreset);

  return (
    <CompositionScene composition={composition} props={props}>
      <VisualTestPause key={preset} />
    </CompositionScene>
  );
}

// Fills in what each entry's All props fields show beyond the library
// defaults; see `seed` in demo-registry.tsx.
const seedFields: SeedFields = (entry, props) =>
  COMPONENT_FIELDS[entry.component].seed?.(props) ?? props;

export function CompositionIsland({
  composition,
  defaults,
  labels,
}: {
  composition: Composition;
  defaults: CompositionDefaults;
  /** Each entry's component label, keyed by entry id, for All props. */
  labels: Readonly<Record<string, string>>;
}) {
  const store = useMemo(
    () => createCompositionStore(composition, defaults, seedFields),
    [composition, defaults],
  );

  return (
    <ControlsProvider store={store}>
      <DemoLayout
        controls={
          <CustomizePanel
            composition={composition}
            defaults={defaults}
            labels={labels}
            store={store}
          />
        }
      >
        <div data-shader-demo>
          <LiveScene composition={composition} store={store} />
        </div>
      </DemoLayout>
    </ControlsProvider>
  );
}
