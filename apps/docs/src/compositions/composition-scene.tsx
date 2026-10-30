'use client';

/**
 * The renderer every composition shares: a ShaderScene with the document's
 * scene props, then each stack entry's component in stack order, keyed by
 * its id. It reaches three through the component map, so callers load it
 * through next/dynamic with ssr: false, or through import() for a scene that
 * mounts on hover, per the SSR gotcha in docs/agents/docs-site.md.
 */
import type { ComponentType, ReactNode } from 'react';

import { ShaderScene } from '@camp-dev/shaders';

import { COMPONENT_MAP } from './component-map';
import type { Composition, EntryProps } from './define';

/** Each entry's props, keyed by entry id, as the Customize panel's store holds them. */
export type CompositionProps = Readonly<Record<string, EntryProps>>;

export interface CompositionSceneProps {
  composition: Composition;
  /**
   * The props to draw each entry with, keyed by entry id. Absent, each entry
   * draws with the document's own props, which is the Default preset.
   */
  props?: CompositionProps;
  /** Freezes the scene on its current frame, passed to ShaderScene. */
  paused?: boolean;
  /** Mounted after the stack, such as VisualTestPause or a benchmark's hint. */
  children?: ReactNode;
}

export function CompositionScene({ composition, props, paused, children }: CompositionSceneProps) {
  const { scene } = composition;

  return (
    <ShaderScene maxFPS={scene?.maxFPS} paused={paused} scrollPush={scene?.scrollPush}>
      {composition.stack.map((entry) => {
        // Widened to take any entry's props. defineComposition already
        // checked each entry's props against its own component.
        const Component = COMPONENT_MAP[entry.component] as ComponentType<EntryProps>;

        return <Component key={entry.id} {...(props?.[entry.id] ?? entry.props)} />;
      })}
      {children}
    </ShaderScene>
  );
}
