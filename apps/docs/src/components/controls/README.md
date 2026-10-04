# Demo control panels

Every component page's demo island (`apps/docs/src/app/components/<name>/demo.tsx`) follows
the same four-part shape:

1. **The scene** — `./scene.tsx`, imported via `next/dynamic({ ssr: false })` because it pulls
   in `three/webgpu`, which references `self` at module load.
2. **A `*Demo` component** — reads the whole params object with `useSnapshot()` and passes it
   into the scene. This is the one place a full-object subscription belongs. Aurora's moves it
   one level down, into `LiveAuroraScene`, so a second host can reuse it.
3. **A `*Controls` component** — the JSX tree of `<SliderInput>`/`<NumberInput>`/`<SelectInput>`/
   `<ColorInput>`/`<ListInput>` inside `<ControlPanel>`. It never calls `useSnapshot()` or reads params itself;
   each control subscribes to its own leaf path independently via `usePropValue`.
4. **The `*Island` export** — creates the store with `useMemo(() => createControlStore(INITIAL), [])`
   and wraps both `*Demo` and `*Controls` in one `<ControlsProvider store={store}>` inside
   `<DemoLayout>`. Aurora's does the same through `AuroraControlsProvider`.

A page that hosts a demo in a layout of its own, such as the homepage hero with Aurora's
(`components/home-hero`), skips `DemoLayout` and wraps the controls in `<ControlsScroller>` inside a box
whose `max-height` caps the panel. `ControlsScroller`'s optional `className` joins its scroll area root's,
for a host that sizes or grounds the root itself, as the hero does to keep the panel as tall as its scene.
Aurora's `demo.tsx` exports its store provider, live scene, and controls for that host, and each provider
mounts a fresh store, so the two pages never share state.

`copy.ts` exports `formatJsx`, which turns a params snapshot into the JSX that the page header's
Copy React menu (`page-actions.tsx`) hands out.

Styling lives in `controls.module.css` (the panel and its controls) and `demo-layout.module.css`
(the shader-beside-controls grid and the sticky, fading controls column). Nothing in here can
move the Playwright visual baselines: the fixture pins `[data-shader-demo]` to 560px.

**The subscription rule:** subscribe to a leaf (or a list's `length`), never to a container. A
container subscription re-renders on every write anywhere inside it — see the demo-store
gotcha in `docs/agents/docs-site.md`. This has bitten three times; the fix is always to push the
subscription down to the specific field a control actually shows.
