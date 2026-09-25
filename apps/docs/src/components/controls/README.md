# Demo control panels

Every component page's demo island (`apps/docs/src/app/components/<name>/demo.tsx`) follows
the same four-part shape:

1. **The scene** — `./scene.tsx`, imported via `next/dynamic({ ssr: false })` because it pulls
   in `three/webgpu`, which references `self` at module load.
2. **A `*Demo` component** — reads the whole params object with `useSnapshot()` and passes it
   into the scene. This is the one place a full-object subscription belongs.
3. **A `*Controls` component** — the JSX tree of `<SliderInput>`/`<NumberInput>`/`<SelectInput>`/
   `<ColorInput>`/`<ListInput>` inside `<ControlPanel>`. It never calls `useSnapshot()` or reads params itself;
   each control subscribes to its own leaf path independently via `usePropValue`.
4. **The `*Island` export** — creates the store with `useMemo(() => createControlStore(INITIAL), [])`
   and wraps both `*Demo` and `*Controls` in one `<ControlsProvider store={store}>` inside
   `<DemoLayout>`.

`copy.ts` still exports `formatJsx` and `formatParams`, which turn a params snapshot into the
JSX and params strings a copy button hands out. Nothing in the panel calls them today; the page
header's copy menu will (SHA-115).

Styling lives in `controls.module.css` (the panel and its controls) and `demo-layout.module.css`
(the shader-beside-controls grid and the sticky, fading controls column). Nothing in here can
move the Playwright visual baselines: the fixture pins `[data-shader-demo]` to 560px.

**The subscription rule:** subscribe to a leaf (or a list's `length`), never to a container. A
container subscription re-renders on every write anywhere inside it — see the demo-store
gotcha in `docs/agents/docs-site.md`. This has bitten three times; the fix is always to push the
subscription down to the specific field a control actually shows.
