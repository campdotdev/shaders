import { test as base } from '@playwright/test';

/**
 * Visual-test fixture with two jobs. It stamps `data-visual-test` on <html> for
 * any page loaded with `?visualTest=1`, which pins the demo wrapper to the width
 * every baseline was captured at (see the matching rule in
 * apps/docs/src/app/globals.css), so page-chrome changes never re-roll the
 * shader screenshots. And it forces `(color-gamut: p3)` to NOT match for every page
 * in the context. ShaderScene defaults to `gamut="auto"`, which resolves to P3 on
 * a P3-capable display — so without this pin, screenshots taken on a P3 dev machine
 * would diverge from the sRGB baselines generated on CI. Pinning to sRGB keeps the
 * baselines deterministic everywhere.
 *
 * Specs that force a gamut explicitly via a route's `gamut` prop are unaffected,
 * since an explicit 'srgb'/'p3' bypasses matchMedia.
 *
 * We wrap the real MediaQueryList in a Proxy (rather than spreading it) so its
 * `addEventListener`/`removeEventListener` methods survive — ShaderScene subscribes
 * to the query's `change` event and would throw on a plain object.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      // An init script runs before the parser has created <html>, so wait for
      // the element and stamp it the moment it appears. That is still before
      // any page script runs, so the attribute is in place for the very first
      // layout and the renderer never sizes the canvas at the unpinned width.
      if (new URLSearchParams(window.location.search).get('visualTest') === '1') {
        new MutationObserver((_mutations, observer) => {
          if (!document.documentElement) return;
          document.documentElement.dataset.visualTest = '1';
          observer.disconnect();
        }).observe(document, { childList: true });
      }

      const nativeMatchMedia = window.matchMedia.bind(window);

      window.matchMedia = (query: string): MediaQueryList => {
        const result = nativeMatchMedia(query);

        if (query.includes('color-gamut') && query.includes('p3')) {
          return new Proxy(result, {
            get(target, property, receiver) {
              if (property === 'matches') return false;
              const value = Reflect.get(target, property, receiver);

              return typeof value === 'function' ? value.bind(target) : value;
            },
          });
        }

        return result;
      };
    });

    // Playwright's fixture callback is named `use`; it is not a React hook.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(context);
  },
});

export { expect } from '@playwright/test';
