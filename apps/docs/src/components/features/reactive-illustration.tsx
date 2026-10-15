'use client';

/**
 * The Reactive feature card's illustration (SHA-216): the mock's pointer
 * arrow over a live LiquidGradient with a smudge held along the J path
 * (reactive-scene.tsx), where the browser has WebGPU. Anywhere else, and
 * until the scene has laid the smudge, the card shows the image exported
 * from the mock.
 */
import Image from 'next/image';
import { type ComponentType, type CSSProperties, useEffect, useState } from 'react';

import { useHasWebGpu } from '@/lib/use-has-webgpu';

import type { ReactiveGradient } from './reactive-gradient';
import styles from './reactive-illustration.module.css';
import type { ReactiveSceneProps } from './reactive-scene';
import type { ReactiveSmudge } from './reactive-smudge';

// ---------------------------------------------
// Loading the scene
// ---------------------------------------------

type Scene = ComponentType<ReactiveSceneProps>;

// The scene's component once its module has loaded, so a later mount reads
// it straight away. The module loads through a plain import() from an
// effect rather than next/dynamic, for the reason favorite-scenes.tsx gives,
// which also keeps three out of the server render.
let loadedScene: Scene | null = null;

function loadScene(): Promise<Scene> {
  return import('./reactive-scene').then((module) => {
    loadedScene = module.default;

    return module.default;
  });
}

/** The scene's component once `enabled` and its module has loaded, otherwise null. */
function useReactiveScene(enabled: boolean): Scene | null {
  const [scene, setScene] = useState(() => loadedScene);

  useEffect(() => {
    if (!enabled || scene) return undefined;

    let cancelled = false;

    loadScene()
      .then((loaded) => {
        if (!cancelled) setScene(() => loaded);
      })
      .catch(() => {
        // A module that fails to load leaves the card on its image.
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, scene]);

  return enabled ? scene : null;
}

// ---------------------------------------------
// The arrow
// ---------------------------------------------

// Where the arrow sits in the still frame, in mock pixels, as the point its
// body trails from. reactive-illustration.module.css places the arrow from it.
type ArrowStyle = CSSProperties & { '--arrow-x': number; '--arrow-y': number };

const STILL_FRAME_ARROW: ArrowStyle = { '--arrow-x': 240, '--arrow-y': 101 };

// The mock's arrow: its body, and the light halo around it, which an
// overlay blend tints with whatever lies under it. Two elements side by
// side rather than one group, because a transform on a shared parent would
// cut the halo's blend off from the canvas beneath.
function Arrow() {
  return (
    <>
      <Image
        alt=""
        className={styles.pointer}
        data-part="halo"
        height={88}
        src="/features/reactive-pointer-halo.svg"
        width={72}
      />
      <Image
        alt=""
        className={styles.pointer}
        data-part="body"
        height={88}
        src="/features/reactive-pointer.svg"
        width={72}
      />
    </>
  );
}

// ---------------------------------------------
// The illustration
// ---------------------------------------------

// Hidden from screen readers: the card's title and description carry its
// message. `data-scene` says whether the live scene shows the still frame
// yet. `gradient` and `smudge` replace the card's settings, for the tuning
// route only.
export function ReactiveIllustration({
  gradient,
  smudge,
}: {
  gradient?: ReactiveGradient;
  smudge?: ReactiveSmudge;
}) {
  const Scene = useReactiveScene(useHasWebGpu());
  const [laid, setLaid] = useState(false);

  return (
    <div
      aria-hidden
      className={styles.illustration}
      data-scene={laid ? 'laid' : 'still'}
      style={STILL_FRAME_ARROW}
    >
      {/* ShaderScene fills the illustration by itself. The arrow follows it
          in the DOM, so it paints on top. */}
      {Scene && <Scene gradient={gradient} onStillFrame={() => setLaid(true)} smudge={smudge} />}
      <Arrow />
      {!laid && (
        <Image
          alt=""
          className={styles.still}
          height={309}
          src="/features/reactive.png"
          width={312}
        />
      )}
    </div>
  );
}
