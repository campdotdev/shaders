# Working in the docs site

Read this before you work in `apps/docs`: a component page, a demo panel, a dev route, the site chrome, or adding a component. For motion and interaction polish, load the `design-engineering` skill, which lives in `~/.claude/skills/` on the author's machine.

## Add a component

The package ships no manifest. The docs site keeps its own record of each component in `apps/docs/src/content/components.ts`: one description and one category per component, keyed by slug. The slug is also the URL segment and the folder name under `packages/shaders/src/components/`, and `props.ts` reads that folder to build the API table.

Adding a component takes six edits: the folder in the package, an export from `packages/shaders/src/components/index.ts`, an entry in `components.ts`, a demo island at `apps/docs/src/app/components/<slug>/demo.tsx`, an entry in `apps/docs/src/app/components/demo-registry.tsx`, and a visual regression spec at `apps/docs-tests/visual/<slug>.spec.ts`, whose baselines `pnpm snap <slug>` generates, as `docs/development/visual-regression.md` describes. The registry is what generates the page: `[slug]/page.tsx` builds its static params from `COMPONENT_PAGES`, so a component without an entry gets no route. A new sidebar group is one more entry in `taxonomy.ts`.

## The SSR gotcha: keep three out of server code

`three/webgpu` reads `self` at module load, so any server render that imports it crashes.

- Load anything that reaches the renderer through `next/dynamic` with `{ ssr: false }`. Every demo loads its `scene.tsx` that way.
- Scalar code has a three-free import path, so reach for it before `ssr: false`. CPU color math comes from `@camp-dev/shaders/color`, and `useDisplayGamut` from `@camp-dev/shaders/gamut`. A lint rule on `apps/docs/**` rejects those names from the package root, and each subpath has a `// @vitest-environment node` test that fails if three enters its import graph.
- The package's root entry, `gamut.ts`, and `poster.ts` open with `'use client'`. The directive lives in source because the docs site compiles the package from source. Server code, RSC pages, and `generateMetadata` import from `@camp-dev/shaders/color` only, which has no directive and no path to three.
- three ships two standalone bundles, `three.module.js` and `three.webgpu.js`. Importing both duplicates three's core, which shows up as `Cannot read properties of undefined (reading 'usedTimes')` on dispose. `next.config.ts` aliases `three`, `three/webgpu`, and `three/tsl` to the webgpu bundle. Keep all three aliases.

## Demo panels

`apps/docs/src/components/controls/README.md` describes the four parts of a demo island. Two rules keep the panels responsive.

### The demo-store gotcha: subscribe to a leaf, never a container

`writeAtPath` in the control store rebuilds every object and array along the path it writes. A component that subscribes to the root params object, or to a list's array, re-renders on every write anywhere inside it, and the controls are deliberately unmemoized, so the re-render cascades. The cascade has bitten three times. Subscribe to a leaf, or to a stable primitive such as a list's `length`. Read containers at event time, without subscribing, through `useControlStore()`. `ListInput`'s add and remove handlers are the model.

### Colors commit on release, numbers commit live

The `colorRamp` components rebuild their material when a color changes, so a color drag that wrote on every move would recompile the shader every frame. `ColorPopoverContents` holds a draft and writes to the store on pointer release. `SliderInput` writes on every change, because numeric props ride stable uniforms.

### Color values are `oklch()` strings

Use `<ColorInput>` from `apps/docs/src/components/controls/` for every color control. It edits in OKLCH and always writes `oklch()` strings, which keeps wide-gamut input working. `parseColorString` accepts only hex, `oklch()`, and `oklab()`, and throws on `rgb()` or `hsl()`. Write initial values in `params.ts` as `oklch()` strings. Pure black is `oklch(0 0 0)`.

Keep dither and gamut controls off component panels. Both are scene-wide.

## Choose gradient colors

These rules cover component defaults, demo palettes, and any gradient on the site.

- Use analogous hues. Keep a linear gradient's 2 or 3 stops within about 60° of each other on the hue wheel, and a mesh gradient's 4 or 5 stops within about 120°.
- Give a 2-stop gradient hues that stay saturated at the midpoint. Complementary pairs pass through gray.
- Build depth from lightness, not hue. Keep at least 0.10 of OKLCH lightness between stops.
- Keep backgrounds subtle and accents bold. Check text contrast at the lightest point and at the darkest point.

## Dev-only routes

Name a debugging or probe page `page.dev.tsx`. The site is a static export, so every page the router sees lands in `out/`, and pagefind then indexes it for site search. `next.config.ts` adds `dev.tsx` and `dev.ts` to `pageExtensions` only when `INCLUDE_DEV_ROUTES=1`, so a plain `next build` never sees these pages.

Three places set the flag, and they must stay in step:

- The `dev` script in `apps/docs/package.json`, so the probes work locally.
- The Playwright `webServer` command. The visual specs that load `/dev/*-probe` need it. Playwright builds the production bundle, so gating on `NODE_ENV` cannot work.
- The `build` task in `turbo.json`, which declares `INCLUDE_DEV_ROUTES` under `env`. Turborepo 2 runs in strict env mode and drops any variable a task does not declare.

To verify a change here, build both ways and check whether `apps/docs/out/dev/` exists. A throwaway prototype route follows the same convention. The `prototype` skill's advice to hide a variant switcher behind `process.env.NODE_ENV !== 'production'` fails here for the same reason.

## Restart a broken dev server properly

A local Playwright run or `pnpm snap` corrupts a running dev server, as `docs/development/visual-regression.md` explains. `next dev` can also wedge at full CPU after a batch of edits to `apps/docs/src/content`, stop answering every route, and ignore SIGTERM. To restart it:

1. Find the listener with `lsof -ti tcp:3000 -sTCP:LISTEN` and kill it. `next dev` spawns a child worker that holds the port and survives a kill of its parent. Keep the `-sTCP:LISTEN` filter, because without it `lsof` also returns the browser helper for any open tab on the port, and killing that crashes the tab.
2. Confirm the port has no listener. If one survives, `kill -9` it.
3. Delete `apps/docs/.next`.
4. Start the server. If you delete `.next` while a server boots, it answers 500 on a missing `routes-manifest.json`.
