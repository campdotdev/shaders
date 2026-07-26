# Demo control panels

Every migrated component page (`apps/docs/src/app/components/<name>/page.tsx`) follows the
same five-part shape:

1. **The scene** — `./scene.tsx`, imported via `next/dynamic({ ssr: false })` because it pulls
   in `three/webgpu`, which references `self` at module load.
2. **`COPY_CONFIG`** — the `CopyConfig` passed to `<ControlPanel>`, used to generate the JSX and
   params snippets behind the Copy buttons.
3. **A `*Demo` component** — reads the whole params object with `useSnapshot()` and passes it
   into the scene. This is the one place a full-object subscription belongs.
4. **A `*Controls` component** — the JSX tree of `<SliderInput>`/`<SelectInput>`/`<ColorInput>`/
   `<ListInput>`. It never calls `useSnapshot()` or reads params itself; each control subscribes
   to its own leaf path independently via `usePropValue`.
5. **The default export** — creates the store with `useMemo(() => createControlStore(INITIAL), [])`
   and wraps both `*Demo` and `*Controls` in one `<ControlsProvider store={store}>`.

**The subscription rule:** subscribe to a leaf (or a list's `length`), never to a container. A
container subscription re-renders on every write anywhere inside it — see gotcha 22 in
`AGENTS.md`. This has bitten three times; the fix is always to push the subscription down to
the specific field a control actually shows.
