import { test as base } from '@playwright/test';

/**
 * Visual-test fixture that forces `(color-gamut: p3)` to NOT match for every page
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
