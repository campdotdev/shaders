'use client';

/**
 * The interactive half of a composition page: the scene in the demo layout.
 * The scene loads through next/dynamic with ssr: false, because the
 * component map behind it reaches three/webgpu, which a server render can't
 * load (the SSR gotcha in docs/agents/docs-site.md).
 */
import dynamic from 'next/dynamic';

import { DemoLayout } from '@/components/controls';
import type { Composition } from '@/compositions/define';
import { VisualTestPause } from '@/lib/visualTestHooks';

const CompositionScene = dynamic(
  () => import('@/compositions/composition-scene').then((module) => module.CompositionScene),
  { ssr: false },
);

export function CompositionIsland({ composition }: { composition: Composition }) {
  return (
    <DemoLayout controls={null}>
      <div data-shader-demo>
        <CompositionScene composition={composition}>
          <VisualTestPause />
        </CompositionScene>
      </div>
    </DemoLayout>
  );
}
