'use client';

/**
 * Client-only entry for the banner's shader. next/dynamic with ssr false
 * keeps three/webgpu off the server, where it reads `self` at module load
 * and cannot render. The visual-test check keeps this canvas out of
 * Playwright: every visual spec screenshots the FIRST canvas on the page,
 * and the banner sits above the demo, so mounting here would silently
 * become every component's baseline.
 */
import dynamic from 'next/dynamic';
import { useSyncExternalStore } from 'react';

import styles from './section-banner.module.css';

const BannerScene = dynamic(() => import('./banner-scene'), { ssr: false });

// The flag never changes for the life of a page, so the store has nothing
// to subscribe to; the hook still wants a subscribe function.
const subscribeToNothing = () => () => undefined;
const readVisualTestFlag = () =>
  new URLSearchParams(window.location.search).get('visualTest') === '1';
const readServerFlag = () => false;

/**
 * True on pages opened with `?visualTest=1`, the flag VisualTestPause reads.
 * Read through useSyncExternalStore rather than an effect, so the first
 * client render already knows the answer and the scene never mounts for a
 * frame before being pulled back out. The server has no URL to read, so it
 * renders the scene's box, and hydration re-renders with the client value.
 */
function useIsVisualTest(): boolean {
  return useSyncExternalStore(subscribeToNothing, readVisualTestFlag, readServerFlag);
}

// Owns its `.scene` positioning rather than taking a className: without the
// absolute wrapper, ShaderScene's own absolutely positioned canvas would
// resolve against the band and paint over the title instead of behind it.
export function BannerShader() {
  const isVisualTest = useIsVisualTest();

  if (isVisualTest) return null;

  return (
    <div aria-hidden className={styles.scene}>
      <BannerScene />
    </div>
  );
}
