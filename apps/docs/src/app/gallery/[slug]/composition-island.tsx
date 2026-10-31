'use client';

/**
 * The interactive half of a composition page: the scene, behind its poster
 * until the first frame, beside the Customize panel, sharing one store. The store starts from the library
 * defaults the server page read for each entry, with the stack's props on
 * top. The scene loads through next/dynamic with ssr: false, because the
 * component map behind it reaches three/webgpu, which a server render can't
 * load (the SSR gotcha in docs/agents/docs-site.md).
 */
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import { COMPONENT_FIELDS } from '@/app/components/demo-registry';
import { ControlsProvider, DemoLayout, useSnapshot } from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';
import type { Composition } from '@/compositions/define';
import { compositionPoster } from '@/compositions/posters';
import {
  type CompositionDefaults,
  type CompositionState,
  type CompositionStore,
  createCompositionStore,
  type SeedFields,
} from '@/compositions/store';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { CustomizePanel } from './customize-panel';
import { useLoadedPreset } from './use-loaded-preset';

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
  const props = useSnapshot<CompositionState>();
  const preset = useLoadedPreset(store);

  return (
    <DemoPoster
      alt={`${composition.title}: ${composition.description}`}
      src={compositionPoster(composition.slug)}
    >
      <CompositionScene composition={composition} props={props}>
        <VisualTestPause key={preset} />
      </CompositionScene>
    </DemoPoster>
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
