# ShaderPoster — one component that owns shader fallback images

**Date:** 2026-07-06
**Status:** Approved for planning
**Packages touched:** `@lovo/matter-react`, `apps/docs`

## Problem

Every docs demo page hand-rolls the same fallback dance: local `painted` state, a
conditional `next/image` poster, and an `onFirstPaint={() => setPainted(true)}`
callback threaded through the scene wrapper into `ShaderScene`. Nine pages repeat
this. Consumers of the library get no help at all — `ShaderScene` has a `fallback`
prop, but it is unusable in the common case.

Why unusable: `three/webgpu` references `self` at module load, so any component
that imports it (including `ShaderScene`) must be loaded with `next/dynamic`
`{ ssr: false }` or equivalent. Anything rendered *inside* `ShaderScene` —
including its `fallback` — therefore does not exist until the client JS chunk
downloads and mounts. The poster must live **outside** the dynamically-imported
subtree to be present in the initial HTML, covering the longest part of the
loading timeline (before the shader bundle even arrives).

The goal: provide the fallback image to one component and be done. That component
must render server-side, show the image immediately, and drop it only when the
shader has truly painted.

## What already exists (and stays)

`ShaderScene` already owns GPU readiness correctly, and none of this changes:

- First **content** paint detection — the fallback signal fires only once the
  scene has a mesh or overlay pass, not over an empty warm-up frame.
- Clock zeroing before that frame, so the first visible frame is t=0 and matches
  a deterministic poster capture exactly (instant swap is pixel-invisible).
- One-`requestAnimationFrame` deferral so the browser composites the frame
  before the fallback is removed.
- Re-arming on renderer teardown/rebuild (e.g. gamut change): a fresh renderer
  must re-prove its first paint.
- The `onFirstPaint` callback (kept — useful for tests and analytics).

React Suspense was considered and rejected as the core mechanism: it only
observes suspension during render, and renderer init / pipeline compile / first
submitted frame all happen post-mount in effects. Suspense remains fine for
app-level code-splitting *around* the scene; GPU readiness stays in the library.

## Design

### New module: `packages/matter-react/src/components/shader-poster/`

Shipped via a **new package entry point `@lovo/matter-react/poster`** — not the
main barrel. The barrel imports `three/webgpu`, which crashes SSR at module
load; the entire value of `ShaderPoster` is that it renders server-side.

**`poster-context.ts`** — zero three imports:

```ts
interface PosterContextValue {
  setShaderPainted: (painted: boolean) => void;
}
export const PosterContext = createContext<PosterContextValue | null>(null);
```

**`shader-poster.tsx`** — a `'use client'` component, zero three imports:

```tsx
export function ShaderPoster({ poster, className, style, children }: ShaderPosterProps) {
  const [painted, setPainted] = useState(false);
  const contextValue = useMemo(() => ({ setShaderPainted: setPainted }), []);

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', ...style }}
    >
      <PosterContext.Provider value={contextValue}>{children}</PosterContext.Provider>
      {!painted && <div style={{ position: 'absolute', inset: 0 }}>{poster}</div>}
    </div>
  );
}
```

- `poster` is a **ReactNode slot**: docs pass `next/image` (with `fill`,
  `priority`, `sizes`), plain-React consumers pass `<img>`. The library owns
  only positioning and visibility.
- The poster slot is wrapped in an `absolute inset-0` div so `next/image`
  `fill` positions against it, and a plain `<img>` just needs
  `width/height: 100%`.
- The wrapper mirrors `ShaderScene`'s fill-the-parent sizing (`100%`/`100%`,
  `position: relative`) so it drops into any sized container.
- Dismissal is an **instant swap** (poster unmounts one rAF after first content
  frame). No fade: the t=0 clock reset makes the swap pixel-invisible when the
  poster is a real t=0 capture. No `fadeDuration` API (YAGNI).

### `ShaderScene` changes

Small and surgical:

- `const posterControls = useContext(PosterContext)` — imported from the poster
  module. The dependency points scene → poster-context, never the reverse,
  keeping the poster entry three-free.
- In the existing first-paint rAF (where `onFirstPaint` fires):
  `posterControls?.setShaderPainted(true)`.
- In the effect cleanup (where `setFirstFramePainted(false)` re-arms today):
  `posterControls?.setShaderPainted(false)` — the poster re-appears whenever a
  fresh renderer must re-prove first paint.
- **Remove the `fallback` prop** and the `firstFramePainted` state that gated
  it. The rAF/clock-reset machinery stays; it now feeds the context signal (and
  `onFirstPaint`) instead of local state. Pre-1.0 breaking change; nothing in
  the repo uses the prop.
- `ShaderScene` without a `ShaderPoster` ancestor: `useContext` returns `null`,
  every call no-ops. No new required wiring.

Rejected alternatives for the signal channel: DOM `CustomEvent` (stringly-typed,
buys nothing when both ends are React components in one package) and keeping the
`onFirstPaint` threading status quo (fails the goal — every consumer still
hand-wires state).

### Build: surviving module duplication

With two tsup entries (`index`, `poster`) both importing `poster-context.ts`,
the context module can be duplicated into each bundle. Duplicated, provider and
consumer would hold different context objects and the poster would silently
never dismiss. esbuild (tsup's bundler) only supports code splitting for ESM —
CJS output *will* duplicate the module, so "verify the shared chunk" cannot
cover both formats.

Instead, make duplication harmless: `poster-context.ts` registers the context
on `globalThis` under `Symbol.for('@lovo/matter-react:poster-context')` and
reuses an existing registration. Every evaluated copy of the module — ESM
chunk, CJS bundle, even a second copy via `transpilePackages` — resolves to the
single context object (React itself is a peer dependency, so `createContext`
runs against one React). A unit test asserts module re-evaluation yields the
same context instance. The docs Playwright baselines are a backstop — a
never-dismissing poster fails every shader screenshot.

`package.json` gains an `exports` entry for `./poster` (ESM + CJS + types),
matching the existing entry's shape.

### Docs wrapper: `apps/docs/src/lib/DemoPoster.tsx`

A thin helper so demo pages just provide the image:

```tsx
export function DemoPoster({ src, alt, children }: DemoPosterProps) {
  return (
    <ShaderPoster
      poster={
        <Image alt={alt} fill priority sizes="100vw" src={src} style={{ objectFit: 'cover' }} />
      }
    >
      {children}
    </ShaderPoster>
  );
}
```

Bakes in the `next/image` conventions every demo currently repeats. Importing it
is safe anywhere — it touches only the `poster` entry. The Tweakpane host and
`data-shader-demo` container stay in each page, outside `DemoPoster`, exactly
where they are now.

### No-WebGPU / init-error behavior (deliberate)

When renderer init fails, no paint signal ever fires, so **the poster stays up
permanently**. On a browser without WebGPU, visitors see the static capture
instead of an error panel — the poster doubles as the graceful-degradation path.
`ShaderScene`'s red error panel still renders underneath (visible for scenes
with no poster; the error is in the console either way). Document this in
`ShaderPoster`'s JSDoc so it isn't mistaken for a hang.

### Migration: eight demo pages

Each `page.tsx` loses its `painted` state, the conditional `<Image>`, and the
`onFirstPaint` wiring; each `scene.tsx` loses the `onFirstPaint` prop it threads
to `ShaderScene`. Call sites become:

```tsx
<DemoPoster alt="…" src="/posters/aurora.jpg">
  <AuroraScene … />
</DemoPoster>
```

Net deletion across 16 files (aurora, dot-field, grain, linear-gradient,
mesh-gradient, simplex-noise, vignette, waves — each `page.tsx` + `scene.tsx`).

**Visual-baseline risk:** the DOM gains `ShaderPoster`'s wrapper div between the
demo container and the scene. Both are 100%-sized, so layout should be
pixel-identical — but if any Playwright baseline shifts, regenerate via
`pnpm snap` (pinned Node 22, Docker). Budgeted as an expected step, not a
surprise.

## Testing

- **Unit (Vitest, no GPU):** `ShaderPoster` is pure React. Assert: poster
  renders initially; dismisses when a child consumer calls
  `setShaderPainted(true)`; re-appears on `false`. A stub child consuming
  `PosterContext` stands in for `ShaderScene`.
- **Build check (manual, one-time):** after `pnpm build`, verify the `poster`
  entry's output imports no `three` module.
- **Context identity (Vitest):** re-evaluating `poster-context.ts` (module
  reset + re-import) returns the same context object, proving bundle-level
  duplication is harmless.
- **Integration:** existing Playwright visual tests — every shader screenshot
  implicitly asserts the poster dismissed and the shader painted.

`ShaderPoster` itself needs no error handling: no async work, no GPU, no effects.

## Decisions log

| Decision | Choice | Why |
| --- | --- | --- |
| Audience | Library primitive + thin docs wrapper | Consumers face the same ssr:false gap the docs do |
| Poster API | ReactNode slot | Framework-neutral; docs keep `next/image` priority/sizes |
| Signal channel | React context | Flows through `next/dynamic` boundaries; deletes `onFirstPaint` threading; typed |
| `ShaderScene.fallback` | Removed | One pattern; pre-1.0; zero in-repo usage |
| Dismissal | Instant swap | t=0 clock reset makes it pixel-invisible; no new machinery |
| Suspense | Not the mechanism | Cannot observe post-mount GPU lifecycle; fine app-level around the scene |
| Entry point | `@lovo/matter-react/poster` | Main barrel pulls `three/webgpu` → SSR crash |
