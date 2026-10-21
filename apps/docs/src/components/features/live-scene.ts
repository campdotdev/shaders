/**
 * Loads a feature card's live scene where it may run, for an illustration
 * whose held story waits for its scene (story.tsx). It lives apart from
 * story.tsx so that file exports only components and hooks, which Fast
 * Refresh needs to keep their state across an edit.
 */
import { type ComponentType, useEffect, useState } from 'react';

import { useReducedMotion } from 'motion/react';

import { useHasWebGpu } from '@/lib/use-has-webgpu';

/**
 * A live scene for an illustration's story: `load` imports its module. The
 * returned hook gives the scene's component where the scene may run, a
 * browser with a WebGPU adapter and motion allowed, once its module has
 * loaded, and null until then and anywhere else, where the card shows its
 * still frame as an image. The module loads as the card mounts, so the
 * scene mounts before the card scrolls into view. It loads through a plain
 * import() from an effect rather than next/dynamic, for the reason
 * favorite-scenes.tsx gives, which also keeps three out of the server
 * render.
 */
export function createLiveScene<Props extends object>(
  load: () => Promise<{ default: ComponentType<Props> }>,
): () => ComponentType<Props> | null {
  // The component once its module has loaded, so a later mount reads it
  // straight away.
  let loaded: ComponentType<Props> | null = null;

  return function useLiveScene() {
    const hasWebGpu = useHasWebGpu();
    const reducedMotion = useReducedMotion() === true;
    const enabled = hasWebGpu && !reducedMotion;
    const [scene, setScene] = useState(() => loaded);

    useEffect(() => {
      if (!enabled || scene) return undefined;

      let cancelled = false;

      load()
        .then((module) => {
          loaded = module.default;
          if (!cancelled) setScene(() => module.default);
        })
        .catch(() => {
          // A module that fails to load leaves the card on its image.
        });

      return () => {
        cancelled = true;
      };
    }, [enabled, scene]);

    return enabled ? scene : null;
  };
}
