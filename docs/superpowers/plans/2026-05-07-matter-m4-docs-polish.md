# Matter — Milestone 4: Docs site polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended for this project) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the bare-bones M3 docs site into the polished docs surface spec'd in §7. Ship shared docs infrastructure (LiveDemo, schema-driven PropsPlayground, build-time CodeBlock, theme toggle), refactor the six component pages onto the new infra, build the dogfooded hero page (combined-scene demo per §5.3 row 1), build primitive pages and starter recipes, and wire Pagefind search. Tag `m4-complete` at the end.

**Architecture:** All new work lives in `apps/docs/`. We add a private `_components/` directory under `apps/docs/app/` for shared docs UI (LiveDemo, PropsPlayground, CodeBlock, ThemeToggle). The `<PropsPlayground>` is **schema-driven**: each component page declares a typed schema; the playground renders the controls. Theme toggle uses `next-themes` (de-facto Next.js standard, SSR-safe, no FOUC). Code blocks pull source via `?raw` imports from `@matter/registry/*.tsx`, highlighted at build time with `shiki`. The hero page reuses all six v1 components inside one `<MatterScene>` to validate spec §5.3 row 1's "combined-scene" claim. Primitive and recipe pages each live under `app/primitives/[slug]/` and `app/recipes/[slug]/` and use shared `<PrimitiveDemo>` and `<RecipeViewer>` wrappers. Pagefind runs as a post-build step indexing the static export.

**Tech Stack:**

- `next-themes@^0.4.x` — theme toggle (system/light/dark)
- `shiki@^1.x` — build-time syntax highlighting (server components only)
- `pagefind@^1.x` + `@pagefind/default-ui` — static-friendly search
- Existing: Next.js 15, React 19, TypeScript 5, Tweakpane (kept for prototype gate; replaced by PropsPlayground after 4.2.b)

---

## Critical context — read this first

### Plan-listing gotcha #12 reminder (from M3 retro)

Every M3 phase's plan listing for TSL-bearing components had latent **gotcha #12** issues (`uniform.method()` chains that silently wrong on GPU). M4 is mostly plumbing, but Phase 4.3 (hero page) and Phase 4.4 (primitive pages) write fresh TSL. **Before dispatching either phase's implementer, do a gotcha #12 sweep on the plan's TSL chains** — confirm every chain is rooted on `uv()`, `time`, `vec2/3/4(...)`, or another non-uniform node, with uniforms only as args.

### Three layers of "demo-ness"

The docs site has three distinct demo wrappers, easy to confuse:

| Wrapper           | Purpose                                                               | Lives at                                      | Used by                       |
| ----------------- | --------------------------------------------------------------------- | --------------------------------------------- | ----------------------------- |
| `<LiveDemo>`      | Frame the demo + provide fullscreen toggle, play/pause, isolation     | `apps/docs/app/_components/LiveDemo.tsx`      | Component pages, recipe pages |
| `<PrimitiveDemo>` | Render a tiny shader using ONE primitive, with sliders for its params | `apps/docs/app/_components/PrimitiveDemo.tsx` | Primitive pages               |
| `<RecipeViewer>`  | Render a recipe (TSL snippet) live + show the source code             | `apps/docs/app/_components/RecipeViewer.tsx`  | Recipe pages                  |

The component pages do NOT use `<PrimitiveDemo>` or `<RecipeViewer>`. They use `<LiveDemo>` to wrap the component and `<PropsPlayground>` for controls.

### Theme + shaders — the ambiguity

Shaders don't auto-adapt to light/dark mode. Theme toggle changes the **chrome** (page bg, text, nav). Inside the demo frame, the shader renders against its own `style={{ background: '#0a0a14' }}` (or similar) — the shader bg is part of the shader's visual identity and is set in the page, not dictated by the theme.

**However:** CSS fallbacks in registry components (the `<DefaultFallback>` divs) can look bad on the wrong page bg. We don't fix that in M4 — the fallback only renders pre-init, briefly. Note for M5 a11y polish if it becomes a problem.

### `?raw` imports in Next.js 15

Next.js 15 with Turbopack supports `?raw` imports natively (loads file content as a string). For webpack builds, we'd need `asset/source` config — but our docs site uses Turbopack via `next build`, so no extra config. Verify in 4.1 Step 1.

### Pagefind ≠ search index from build output

Pagefind needs to run AGAINST the built static HTML. Sequence: `next build` → `pagefind --site out/` (or `.next/server/app/`) → produces `pagefind/` directory → docs site loads `/pagefind/pagefind.js` at runtime for search.

In dev, search returns "indexing not run yet" — that's expected. Search only works post-build.

### Out-of-scope in M4 (pushed to M5 or M6)

- `/getting-started` page (spec §7.1, not in spec §10.2 M4 row)
- `/guides/animation`, `/guides/ssr-and-fallbacks`, `/guides/shared-scenes`, `/guides/three-r3f`, `/guides/perf` (5 guide pages)
- `/reference` (auto-generated API reference)
- "Copy with current playground values" button (spec §7.2; nice-to-have, defer)
- Framework switcher UI on code blocks (spec §7.2: "infrastructure exists from day one but the UI is hidden in v1")

---

## Dependency graph

| Phase                                  | Depends on                                               | Ships                                                                            |
| -------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **4.1 — Shared docs infra**            | M3 catalog (m3-complete)                                 | `<LiveDemo>`, `<CodeBlock>`, theme toggle, `next-themes`+`shiki` deps, test page |
| **4.2.a — PropsPlayground prototype**  | 4.1                                                      | `<PropsPlayground>`, prototype on LinearGradient, feel-decision                  |
| **4.2.b — Refactor 6 component pages** | 4.2.a (gated by feel-decision)                           | All `/components/<slug>` use shared infra; NoiseField cursor TODO resolved       |
| **4.3 — Hero page**                    | 4.1 (theme)                                              | New `apps/docs/app/page.tsx` — combined-scene demo                               |
| **4.4 — Primitive pages**              | 4.1, **4.2.a** (PrimitiveDemo wraps PropsPlayground)     | `/primitives/[slug]` for ~10 primitives, `<PrimitiveDemo>`                       |
| **4.5 — Recipes**                      | 4.1 (RecipeViewer is self-contained, no PropsPlayground) | `/recipes/[slug]` for 4 starter recipes, `<RecipeViewer>`                        |
| **4.6 — Pagefind search**              | 4.2.b, 4.4, 4.5 (needs content to index)                 | Build-time index, search UI in nav                                               |
| **4.7 — M4 wrap-up**                   | 4.6                                                      | Tag `m4-complete`, memory entry, milestone table update                          |

After 4.2.a passes its feel-decision gate, **4.2.b, 4.3, 4.4, and 4.5 are independent** (different routes, different files); they could run in parallel if multiple engineers. For our subagent-driven flow, they run sequentially.

---

## Pre-flight checks

Run before starting Phase 4.1.

- [ ] **Working tree clean.** `git status` reports nothing.
- [ ] **M3 tag present.** `git tag` shows `m0-complete`, `m1-complete`, `m2-complete`, `m3-complete`.
- [ ] **All checks green.** `pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @matter/docs build` — all pass. (Pre-existing playground unused-var warnings are fine.)
- [ ] **CLAUDE.md status table.** Confirm "M3 ✅ Complete" row is present (committed in `9abe612`).

---

## File structure produced by this milestone

```
apps/docs/
├── app/
│   ├── _components/                        # NEW — private shared docs UI
│   │   ├── LiveDemo.tsx                   # NEW — Phase 4.1
│   │   ├── CodeBlock.tsx                  # NEW — Phase 4.1
│   │   ├── ThemeToggle.tsx                # NEW — Phase 4.1
│   │   ├── PropsPlayground.tsx            # NEW — Phase 4.2.a
│   │   ├── PrimitiveDemo.tsx              # NEW — Phase 4.4
│   │   ├── RecipeViewer.tsx               # NEW — Phase 4.5
│   │   └── SearchBar.tsx                  # NEW — Phase 4.6
│   ├── _lib/                               # NEW — shared utilities
│   │   ├── shiki.ts                       # NEW — Phase 4.1 (highlighter singleton)
│   │   └── playgroundSchemas.ts           # NEW — Phase 4.2.b (per-component schemas)
│   ├── components/                         # MODIFIED in 4.2.b — six pages refactored
│   │   ├── linear-gradient/page.tsx       # MODIFIED
│   │   ├── noise-field/page.tsx           # MODIFIED (cursor TODO resolved)
│   │   ├── dot-field/page.tsx             # MODIFIED
│   │   ├── waves/page.tsx                 # MODIFIED
│   │   ├── mesh-gradient/page.tsx         # MODIFIED
│   │   └── aurora/page.tsx                # MODIFIED
│   ├── primitives/                         # NEW — Phase 4.4
│   │   └── [slug]/page.tsx                # NEW — dynamic route, ~10 primitives
│   ├── recipes/                            # NEW — Phase 4.5
│   │   └── [slug]/page.tsx                # NEW — dynamic route, 4 starter recipes
│   ├── _data/                              # NEW
│   │   ├── primitives.ts                  # NEW — Phase 4.4 (primitive metadata)
│   │   └── recipes.ts                     # NEW — Phase 4.5 (recipe metadata + TSL builders)
│   ├── _test/page.tsx                      # NEW in 4.1, REMOVED in 4.2.a
│   ├── globals.css                         # MODIFIED — Phase 4.1 (theme CSS vars)
│   ├── layout.tsx                          # MODIFIED — Phase 4.1 (ThemeProvider, nav, search)
│   ├── page.tsx                            # REWRITTEN — Phase 4.3 (hero/showcase)
│   └── providers.tsx                       # NEW — Phase 4.1 (next-themes provider)
├── next.config.ts                          # MODIFIED — Phase 4.6 (Pagefind output dir)
├── package.json                            # MODIFIED — Phase 4.1 (add next-themes, shiki); Phase 4.6 (add pagefind)
└── public/
    └── pagefind/                           # GENERATED — Phase 4.6 (post-build, gitignored)

registry/
└── noise-field.tsx                         # MODIFIED — Phase 4.2.b (cursor consumed in TSL)

# Root
.gitignore                                  # MODIFIED — Phase 4.6 (gitignore apps/docs/public/pagefind)
package.json                                # MODIFIED — Phase 4.6 (postbuild script for Pagefind)
CLAUDE.md                                   # MODIFIED — Phase 4.7 (mark M4 complete)
```

---

## Phase 4.1 — Shared docs infra: LiveDemo, CodeBlock, theme toggle

**Goal:** Land the foundational docs UI primitives (LiveDemo, CodeBlock with `?raw`, theme toggle via `next-themes`) and verify them on a throwaway test page. The component pages don't change yet — that's 4.2.b.

**Files:**

- Create: `apps/docs/app/_components/LiveDemo.tsx`
- Create: `apps/docs/app/_components/CodeBlock.tsx`
- Create: `apps/docs/app/_components/ThemeToggle.tsx`
- Create: `apps/docs/app/_lib/shiki.ts`
- Create: `apps/docs/app/providers.tsx`
- Create: `apps/docs/app/_test/page.tsx` (throwaway, removed in 4.2.a)
- Modify: `apps/docs/app/layout.tsx` (wrap children in ThemeProvider, add ThemeToggle to header)
- Modify: `apps/docs/app/globals.css` (CSS vars for light/dark)
- Modify: `apps/docs/package.json` (add `next-themes`, `shiki`)
- Modify: `pnpm-lock.yaml` (auto)

### Task 1: Add dependencies

- [ ] **Step 1.1: Add deps to `apps/docs/package.json`.**

```bash
pnpm --filter @matter/docs add next-themes shiki
```

Expected: `next-themes` ~0.4.x, `shiki` ~1.x added to `dependencies` in `apps/docs/package.json`.

- [ ] **Step 1.2: Verify install.**

```bash
pnpm install
pnpm --filter @matter/docs build
```

Expected: build passes. The new packages don't change behavior yet.

### Task 2: ThemeProvider + global CSS vars

- [ ] **Step 2.1: Create `apps/docs/app/providers.tsx`.**

```tsx
'use client'

import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  )
}
```

The `attribute="data-theme"` writes `data-theme="light" | "dark"` on `<html>`, which our CSS targets.

- [ ] **Step 2.2: Update `apps/docs/app/globals.css`.**

Replace the file with theme CSS vars + targeted styling. The site currently has minimal CSS; we expand it modestly. (Read the existing file first to preserve any non-theme rules.)

```css
:root {
  --bg: #ffffff;
  --bg-muted: #f4f4f7;
  --fg: #14141a;
  --fg-muted: #5a5a66;
  --accent: #5570ff;
  --link: #4860dd;
  --code-bg: #f0f0f4;
  --border: #e3e3e9;
}

[data-theme='dark'] {
  --bg: #0b0b14;
  --bg-muted: #15151f;
  --fg: #e8e8f0;
  --fg-muted: #9a9aaa;
  --accent: #88aaff;
  --link: #88aaff;
  --code-bg: #161622;
  --border: #1f1f2c;
}

html,
body {
  background: var(--bg);
  color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
  padding: 0;
}

a {
  color: var(--link);
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
}

/* Suppress FOUC: next-themes injects theme attr before first paint. */
html {
  color-scheme: light dark;
}
```

- [ ] **Step 2.3: Update `apps/docs/app/layout.tsx`.**

Read the current file first to preserve metadata. Then wrap children in `<Providers>` and add `suppressHydrationWarning` on `<html>` (required by `next-themes`).

```tsx
import './globals.css'
import { Providers } from './providers'
import type { ReactNode } from 'react'

export const metadata = {
  /* keep existing */
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 2.4: Verify dev runs and theme attribute appears.**

```bash
pnpm --filter @matter/docs dev
# Open http://localhost:3000, inspect <html> — should have data-theme="dark" or "light"
```

Expected: `data-theme` attribute is set on `<html>` based on system preference. No FOUC visible on reload.

### Task 3: ThemeToggle component

- [ ] **Step 3.1: Create `apps/docs/app/_components/ThemeToggle.tsx`.**

```tsx
'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Avoid hydration mismatch — render a stable placeholder until mounted.
  if (!mounted) {
    return (
      <button
        aria-label="Toggle theme"
        style={{
          width: 32,
          height: 32,
          opacity: 0.4,
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'transparent',
        }}
      />
    )
  }

  const cycle = () => {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    setTheme(next)
  }

  const label = theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'
  const icon = resolvedTheme === 'dark' ? '○' : '●'

  return (
    <button
      onClick={cycle}
      aria-label={`Theme: ${label} (click to cycle)`}
      title={`Theme: ${label}`}
      style={{
        width: 32,
        height: 32,
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--bg-muted)',
        color: 'var(--fg)',
        cursor: 'pointer',
        fontSize: '0.85rem',
      }}
    >
      {icon}
    </button>
  )
}
```

The toggle cycles `system → light → dark → system`. The `mounted` guard prevents hydration mismatch (theme isn't known on the server).

### Task 4: shiki highlighter singleton + CodeBlock

- [ ] **Step 4.1: Create `apps/docs/app/_lib/shiki.ts`.**

We create the highlighter once per server runtime and reuse it. Shiki is server-only — `'use server'` not strictly required since it's just a lib import, but mark it as not for client use.

```ts
import { createHighlighter, type Highlighter } from 'shiki'

let highlighterPromise: Promise<Highlighter> | null = null

export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: ['tsx', 'ts', 'bash', 'json'],
    })
  }
  return highlighterPromise
}
```

- [ ] **Step 4.2: Create `apps/docs/app/_components/CodeBlock.tsx`.**

This is a Server Component (no `'use client'`). It takes a string source and a language and emits two `<pre>` blocks (one for each theme), revealing the right one via CSS based on `data-theme`.

```tsx
import { getHighlighter } from '../_lib/shiki'

interface CodeBlockProps {
  source: string
  lang?: 'tsx' | 'ts' | 'bash' | 'json'
}

export async function CodeBlock({ source, lang = 'tsx' }: CodeBlockProps) {
  const highlighter = await getHighlighter()
  const lightHtml = highlighter.codeToHtml(source, { lang, theme: 'github-light' })
  const darkHtml = highlighter.codeToHtml(source, { lang, theme: 'github-dark' })

  return (
    <div className="codeblock">
      {/* Two copies, one per theme. CSS hides the inactive one. */}
      <div className="codeblock-light" dangerouslySetInnerHTML={{ __html: lightHtml }} />
      <div className="codeblock-dark" dangerouslySetInnerHTML={{ __html: darkHtml }} />
    </div>
  )
}
```

- [ ] **Step 4.3: Add CSS for CodeBlock to `globals.css`.**

Append to `globals.css`:

```css
.codeblock pre {
  padding: 1rem;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  overflow-x: auto;
  border: 1px solid var(--border);
}

[data-theme='dark'] .codeblock-light {
  display: none;
}
[data-theme='light'] .codeblock-dark {
  display: none;
}
[data-theme='dark'] .codeblock-dark {
  display: block;
}
[data-theme='light'] .codeblock-light {
  display: block;
}

/* Default (no theme attr yet, e.g., before hydration): show dark */
:root .codeblock-light {
  display: none;
}
:root .codeblock-dark {
  display: block;
}
```

### Task 5: LiveDemo component

The `<LiveDemo>` wraps a child element (the actual shader rendering) with chrome: a frame, a play/pause button (toggles a CSS animation-paused state on the descendant — but for shader scenes this is a no-op; play/pause is wired to MatterScheduler in M5), and a fullscreen toggle.

For v1, the play/pause button is **decorative** — wired but inert. The fullscreen toggle uses the Fullscreen API.

- [ ] **Step 5.1: Create `apps/docs/app/_components/LiveDemo.tsx`.**

```tsx
'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

interface LiveDemoProps {
  children: ReactNode
  height?: string
  background?: string
  className?: string
  style?: CSSProperties
}

export function LiveDemo({
  children,
  height = '70vh',
  background = '#0a0a14',
  className,
  style,
}: LiveDemoProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement === ref.current) {
      void document.exitFullscreen()
    } else {
      void ref.current?.requestFullscreen()
    }
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: 'relative',
        height: isFullscreen ? '100vh' : height,
        background,
        borderRadius: isFullscreen ? 0 : 8,
        overflow: 'hidden',
        border: isFullscreen ? 'none' : '1px solid var(--border)',
        ...style,
      }}
    >
      {children}
      <button
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          zIndex: 5,
          width: 32,
          height: 32,
          border: 'none',
          borderRadius: 6,
          background: 'rgba(0, 0, 0, 0.4)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        {isFullscreen ? '×' : '⛶'}
      </button>
    </div>
  )
}
```

We deliberately keep `<LiveDemo>` thin. The shader child handles its own canvas; LiveDemo just frames it.

### Task 6: Header layout with theme toggle

- [ ] **Step 6.1: Update `apps/docs/app/layout.tsx` to add a header bar.**

Update layout.tsx to wrap the page in a header + main, with the ThemeToggle in the header. (Search bar comes in Phase 4.6.)

```tsx
import './globals.css'
import { Providers } from './providers'
import { ThemeToggle } from './_components/ThemeToggle'
import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Matter — React shader components',
  description: 'WebGPU + TSL shader components for React.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1.5rem',
              background: 'var(--bg)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <Link href="/" style={{ fontWeight: 600, color: 'var(--fg)' }}>
              Matter
            </Link>
            <ThemeToggle />
          </header>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  )
}
```

### Task 7: Throwaway test page

- [ ] **Step 7.1: Create `apps/docs/app/_test/page.tsx`.**

```tsx
import { CodeBlock } from '../_components/CodeBlock'
import { LiveDemo } from '../_components/LiveDemo'
import linearGradientSource from '@matter/registry/linear-gradient.tsx?raw'
import dynamic from 'next/dynamic'

const LinearGradient = dynamic(
  () => import('@matter/registry/linear-gradient').then((m) => m.LinearGradient),
  { ssr: false },
)

export default function TestPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
      <h1>Phase 4.1 test page</h1>
      <p>Theme toggle should change the chrome below. The shader bg is fixed.</p>
      <LiveDemo>
        <LinearGradient />
      </LiveDemo>
      <h2>Code (from registry, ?raw):</h2>
      <CodeBlock source={linearGradientSource} lang="tsx" />
    </div>
  )
}
```

The `?raw` import yields the file content as a string. Next.js 15 + Turbopack supports this natively. **If the build errors on the `?raw` import**, check `apps/docs/next.config.ts` and add to `transpilePackages` or `webpack` config as documented.

- [ ] **Step 7.2: Verify the test page builds.**

```bash
pnpm --filter @matter/docs build
```

Expected: build succeeds. `/test` (or wherever — `_test/` is route-grouped and renders at `/_test`? actually `_components` and `_lib` are private folders per Next convention; let's use `app/test/page.tsx` instead since `_test` is route-private):

**Correction:** Folders prefixed with `_` are private and DO NOT generate routes. Use `apps/docs/app/test/page.tsx` (no underscore) for the test page. Update Step 7.1 path accordingly.

- [ ] **Step 7.3: Visual check in dev.**

```bash
pnpm --filter @matter/docs dev
# Open http://localhost:3000/test
```

Expected:

- Linear gradient renders.
- Theme toggle in the header cycles light/dark/system.
- Code block re-styles when theme cycles (light shows GitHub Light theme, dark shows GitHub Dark).
- Code shown matches `registry/linear-gradient.tsx` byte-for-byte.

### Stop-and-play gate (4.1)

Open `/test` in dev. Verify:

1. **Theme toggle works.** Cycle system→light→dark. Page bg, text, nav, code block all respond. No FOUC on reload.
2. **CodeBlock matches registry source byte-for-byte.** Compare to `cat registry/linear-gradient.tsx` mentally — should be identical.
3. **LiveDemo fullscreen.** Click the fullscreen button; demo expands; ESC exits. Code block disappears under the fullscreen frame, expected.
4. **No console errors.** Open devtools; clean console.

If anything's off, fix and re-verify before 4.2.a.

### Done-criteria for 4.1

- [ ] `pnpm --filter @matter/docs build` passes.
- [ ] `/test` route renders LinearGradient, code block, and a working theme toggle in the header.
- [ ] CodeBlock content equals `registry/linear-gradient.tsx` byte-for-byte.
- [ ] No FOUC on hard reload.
- [ ] Commit (one commit, scope `feat(docs)`).

```bash
git add apps/docs/app/providers.tsx apps/docs/app/_components apps/docs/app/_lib apps/docs/app/test apps/docs/app/globals.css apps/docs/app/layout.tsx apps/docs/package.json pnpm-lock.yaml
git commit -m "feat(docs): shared docs infra — LiveDemo, CodeBlock (shiki + ?raw), theme toggle"
```

### Review pass (4.1)

**Spec-compliance reviewer:** _"Verify Phase 4.1 ships exactly what spec §7.3 lists for shared docs components: `<LiveDemo>` exists with fullscreen toggle, `<CodeBlock framework="react">` pulls source at build time. Confirm theme toggle behavior per spec §7.6. Confirm Pagefind isn't yet wired (deferred to 4.6) and PropsPlayground isn't yet built (deferred to 4.2.a) — these are intentional scope splits, not spec gaps."_

**Code-quality reviewer:** _"Sweep `apps/docs/app/\_components/_.tsx`and`apps/docs/app/\_lib/_.ts` for: (1) hydration safety (`mounted`guard pattern) on the ThemeToggle; (2) shiki highlighter is created once and cached, not per-request; (3) the`?raw`import is correctly typed (may need a`.d.ts` declaration if TS complains); (4) Server vs Client Component boundaries are correct (CodeBlock is Server, LiveDemo is Client, ThemeToggle is Client). Flag any leak of server code into a Client Component."_

Address REQUIRED notes; SUGGESTED → 4.7 wrap-up.

---

## Phase 4.2.a — `<PropsPlayground>` prototype on LinearGradient

**Goal:** Build the spec-faithful schema-driven `<PropsPlayground>` wrapper, mount it on a prototype version of the LinearGradient page, and have the user feel-test it against the existing Tweakpane UX. **Stop-and-play decision point:** does the schema-driven UX feel as good as Tweakpane? If yes → propagate in 4.2.b. If no → fall back to option B (Tweakpane wrapped in a shared hook) and revise this plan before 4.2.b.

The other 5 component pages stay on bespoke Tweakpane during this phase — only LinearGradient gets the prototype.

**Files:**

- Create: `apps/docs/app/_components/PropsPlayground.tsx`
- Modify: `apps/docs/app/components/linear-gradient/page.tsx` (replace bespoke Tweakpane with PropsPlayground)
- Remove: `apps/docs/app/test/page.tsx` (purpose served by 4.1; clean up before propagating)

### Task 1: Schema types + PropsPlayground component

- [ ] **Step 1.1: Create `apps/docs/app/_components/PropsPlayground.tsx`.**

The schema is a list (preserving declaration order). Each entry is one prop with a discriminated `type` field. The component renders an appropriate input per type and emits a single `onChange(state)` callback.

```tsx
'use client'

import { useEffect, useState, type CSSProperties } from 'react'

export type PropSchemaEntry =
  | { name: string; label?: string; type: 'color'; default: string }
  | {
      name: string
      label?: string
      type: 'number'
      default: number
      min: number
      max: number
      step?: number
    }
  | { name: string; label?: string; type: 'boolean'; default: boolean }
  | { name: string; label?: string; type: 'enum'; default: string; options: readonly string[] }
  | {
      name: string
      label?: string
      type: 'colors'
      default: readonly string[]
      min?: number
      max?: number
    }

export type PropSchema = readonly PropSchemaEntry[]

export type PropsState = Record<string, string | number | boolean | readonly string[]>

function initialState(schema: PropSchema): PropsState {
  const out: PropsState = {}
  for (const entry of schema) out[entry.name] = entry.default
  return out
}

interface PropsPlaygroundProps {
  schema: PropSchema
  onChange: (state: PropsState) => void
  className?: string
  style?: CSSProperties
}

export function PropsPlayground({ schema, onChange, className, style }: PropsPlaygroundProps) {
  const [state, setState] = useState<PropsState>(() => initialState(schema))

  useEffect(() => {
    onChange(state)
  }, [state, onChange])

  const update = (name: string, value: string | number | boolean | readonly string[]) => {
    setState((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <form
      className={className}
      onSubmit={(e) => e.preventDefault()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1rem',
        background: 'var(--bg-muted)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        ...style,
      }}
    >
      {schema.map((entry) => (
        <PropRow key={entry.name} entry={entry} value={state[entry.name]!} onChange={update} />
      ))}
    </form>
  )
}

function PropRow({
  entry,
  value,
  onChange,
}: {
  entry: PropSchemaEntry
  value: string | number | boolean | readonly string[]
  onChange: (name: string, value: string | number | boolean | readonly string[]) => void
}) {
  const label = entry.label ?? entry.name
  const id = `prop-${entry.name}`

  if (entry.type === 'color') {
    return (
      <Field id={id} label={label}>
        <input
          id={id}
          type="color"
          value={value as string}
          onChange={(e) => onChange(entry.name, e.target.value)}
          style={{ width: 40, height: 28, padding: 0, border: 'none', background: 'transparent' }}
        />
        <code style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>{value as string}</code>
      </Field>
    )
  }

  if (entry.type === 'number') {
    const v = value as number
    return (
      <Field id={id} label={label}>
        <input
          id={id}
          type="range"
          min={entry.min}
          max={entry.max}
          step={entry.step ?? 0.01}
          value={v}
          onChange={(e) => onChange(entry.name, Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <code
          style={{ width: 60, textAlign: 'right', fontSize: '0.8rem', color: 'var(--fg-muted)' }}
        >
          {v.toFixed(2)}
        </code>
      </Field>
    )
  }

  if (entry.type === 'boolean') {
    return (
      <Field id={id} label={label}>
        <input
          id={id}
          type="checkbox"
          checked={value as boolean}
          onChange={(e) => onChange(entry.name, e.target.checked)}
        />
      </Field>
    )
  }

  if (entry.type === 'enum') {
    return (
      <Field id={id} label={label}>
        <select
          id={id}
          value={value as string}
          onChange={(e) => onChange(entry.name, e.target.value)}
          style={{
            flex: 1,
            padding: '0.25rem 0.5rem',
            background: 'var(--bg)',
            color: 'var(--fg)',
            border: '1px solid var(--border)',
            borderRadius: 4,
          }}
        >
          {entry.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </Field>
    )
  }

  // type === 'colors' — array of hex strings
  const colors = value as readonly string[]
  return (
    <Field id={id} label={label}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {colors.map((c, i) => (
          <input
            key={i}
            type="color"
            value={c}
            onChange={(e) => {
              const next = [...colors]
              next[i] = e.target.value
              onChange(entry.name, next)
            }}
            style={{ width: 32, height: 28, padding: 0, border: 'none', background: 'transparent' }}
          />
        ))}
      </div>
    </Field>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={id}
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
    >
      <span style={{ width: 100, color: 'var(--fg-muted)' }}>{label}</span>
      {children}
    </label>
  )
}
```

### Task 2: Refactor LinearGradient page

- [ ] **Step 2.1: Read current `apps/docs/app/components/linear-gradient/page.tsx`** to know what props it exposes.

- [ ] **Step 2.2: Replace the page with a PropsPlayground-driven version.**

The general pattern is: declare a schema, pass to `<PropsPlayground onChange={setState}>`, render the component reading from state. Keep the dynamic import (gotcha #10).

```tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { LiveDemo } from '../../_components/LiveDemo'
import { CodeBlock } from '../../_components/CodeBlock'
import {
  PropsPlayground,
  type PropSchema,
  type PropsState,
} from '../../_components/PropsPlayground'
import linearGradientSource from '@matter/registry/linear-gradient.tsx?raw'

const LinearGradient = dynamic(
  () => import('@matter/registry/linear-gradient').then((m) => m.LinearGradient),
  { ssr: false },
)

const SCHEMA: PropSchema = [
  { name: 'colors', type: 'colors', default: ['#ff7b72', '#7b9cff'] },
  { name: 'angle', type: 'number', default: 90, min: 0, max: 360, step: 1 },
  { name: 'speed', type: 'number', default: 0, min: 0, max: 2, step: 0.01 },
  { name: 'interactive', type: 'boolean', default: false },
  { name: 'variant', type: 'enum', default: 'linear', options: ['linear', 'radial'] },
]

export default function LinearGradientPage() {
  const [params, setParams] = useState<PropsState>(() => {
    // Same defaults as schema — keep in sync if the schema changes.
    const init: PropsState = {}
    for (const e of SCHEMA) init[e.name] = e.default
    return init
  })

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>&lt;LinearGradient /&gt;</h1>
      <p style={{ color: 'var(--fg-muted)' }}>
        Animated linear or radial gradient with optional cursor parallax. The simplest, foundational
        Matter component.
      </p>

      <LiveDemo>
        <LinearGradient
          colors={params.colors as readonly string[]}
          angle={params.angle as number}
          speed={params.speed as number}
          interactive={params.interactive as boolean}
          variant={params.variant as 'linear' | 'radial'}
        />
      </LiveDemo>

      <div
        style={{
          marginTop: '1.5rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1rem' }}>Playground</h2>
          <PropsPlayground schema={SCHEMA} onChange={setParams} />
        </div>
        <div>
          <h2 style={{ fontSize: '1rem' }}>Source</h2>
          <CodeBlock source={linearGradientSource} lang="tsx" />
        </div>
      </div>
    </div>
  )
}
```

(Note: this page mixes Server and Client components — `CodeBlock` is async server, `PropsPlayground`/`LiveDemo`/dynamic-imported `LinearGradient` are client. Next.js's automatic boundary handling supports this in App Router; the page itself must be a Client Component because of `useState`. The CodeBlock works inside a Client Component because Next streams it as an RSC chunk — verify this builds; if not, hoist CodeBlock to a sibling that wraps the page.)

**If CodeBlock-in-Client errors at build:** introduce an outer Server Component page that renders a Client `<PageBody>` and the Server `<CodeBlock>` as siblings. Common Next.js pattern.

- [ ] **Step 2.3: Remove `apps/docs/app/test/page.tsx`** — it served its purpose.

```bash
rm -r apps/docs/app/test
```

### Task 3: Verify build and visual check

- [ ] **Step 3.1: Build.**

```bash
pnpm --filter @matter/docs build
```

Expected: passes. The `/components/linear-gradient` route still appears.

- [ ] **Step 3.2: Visual check.**

```bash
pnpm --filter @matter/docs dev
# Open http://localhost:3000/components/linear-gradient
```

Verify:

- The shader renders.
- Each playground control (colors, angle, speed, interactive, variant) updates the live demo.
- The code block shows registry source.
- Theme toggle still works on the page.

### Stop-and-play gate (4.2.a) — feel decision

This is the explicit feel-decision the user owes us before propagating to 5 more pages.

**Question:** Does the schema-driven `<PropsPlayground>` UX feel at least as good as the bespoke Tweakpane on the (currently still Tweakpane-based) other 5 pages? Specifically:

1. **Tweaking colors** — is `<input type="color">` workable, or do you miss Tweakpane's color picker?
2. **Tweaking numbers** — does `<input type="range">` with the small numeric readout next to it feel responsive, or do you want Tweakpane's drag-to-scrub?
3. **Visual layout** — playground side-by-side with the source code: does this work, or is it too cramped at smaller viewports? (Current grid is `1fr 1fr`; could stack on mobile.)
4. **Discoverability** — do you immediately see what each control does without labels-as-tooltips?

If 1–4 are all "yes" → proceed to 4.2.b (refactor 5 remaining pages).
If any is a strong "no" → fall back to option B (Tweakpane wrapped in `usePropsPanel(schema)` hook) and revise 4.2.a/b before propagating.

### Done-criteria for 4.2.a

- [ ] `<PropsPlayground>` exists with the 5 input types (color, number, boolean, enum, colors).
- [ ] LinearGradient page uses it and renders correctly.
- [ ] Test page (`apps/docs/app/test/`) removed.
- [ ] Build green.
- [ ] User has signed off on the UX (or chosen option B fallback).
- [ ] Commit (one commit).

```bash
git add apps/docs/app/_components/PropsPlayground.tsx apps/docs/app/components/linear-gradient/page.tsx
git rm -r apps/docs/app/test
git commit -m "feat(docs): schema-driven PropsPlayground (4.2.a prototype on LinearGradient)"
```

### Review pass (4.2.a)

**Code-quality reviewer:** _"Review `apps/docs/app/_components/PropsPlayground.tsx`. Verify: (1) schema is properly typed as a discriminated union; (2) onChange semantics are stable (the parent's onChange shouldn't fire on every render — confirm dep array on the useEffect is correct); (3) the colors array case correctly mutates immutably; (4) accessibility — labels are associated with inputs via htmlFor/id. Flag any control that's keyboard-inaccessible."_

Spec compliance: deferred — we're prototyping. Full spec compliance audit moves to 4.2.b once the UX is locked.

---

## Phase 4.2.b — Refactor remaining 5 component pages + resolve NoiseField cursor TODO

**Goal:** Apply the 4.2.a pattern (schema → PropsPlayground → LiveDemo → CodeBlock side-by-side) to the other 5 component pages: NoiseField, DotField, Waves, MeshGradient, Aurora. Centralize the schemas in `_lib/playgroundSchemas.ts` so they're discoverable + reusable. Resolve the NoiseField cursor TODO at `registry/noise-field.tsx:74` while we're already touching the component.

**Pre-flight:** 4.2.a stop-and-play passed. If the user chose option B, revise this phase before continuing.

**Files:**

- Create: `apps/docs/app/_lib/playgroundSchemas.ts`
- Modify: `apps/docs/app/components/linear-gradient/page.tsx` (refactor to import shared schema)
- Modify: `apps/docs/app/components/noise-field/page.tsx`
- Modify: `apps/docs/app/components/dot-field/page.tsx`
- Modify: `apps/docs/app/components/waves/page.tsx`
- Modify: `apps/docs/app/components/mesh-gradient/page.tsx`
- Modify: `apps/docs/app/components/aurora/page.tsx`
- Modify: `registry/noise-field.tsx` (cursor TODO resolution)
- Remove: `tweakpane` from `apps/docs/package.json` (no longer used)

### Task 1: Centralize schemas

- [ ] **Step 1.1: Create `apps/docs/app/_lib/playgroundSchemas.ts`.**

Each schema is a const tuple typed as `PropSchema`. Filling in defaults exactly matching each component's spec defaults.

```ts
import type { PropSchema } from '../_components/PropsPlayground'

export const linearGradientSchema: PropSchema = [
  { name: 'colors', type: 'colors', default: ['#ff7b72', '#7b9cff'] },
  { name: 'angle', type: 'number', default: 90, min: 0, max: 360, step: 1 },
  { name: 'speed', type: 'number', default: 0, min: 0, max: 2, step: 0.01 },
  { name: 'interactive', type: 'boolean', default: false },
  { name: 'variant', type: 'enum', default: 'linear', options: ['linear', 'radial'] },
]

export const noiseFieldSchema: PropSchema = [
  { name: 'colors', type: 'colors', default: ['#1a1a2a', '#88aaff'] },
  { name: 'scale', type: 'number', default: 3, min: 0.5, max: 10, step: 0.1 },
  { name: 'speed', type: 'number', default: 0.4, min: 0, max: 2, step: 0.01 },
  { name: 'variant', type: 'enum', default: 'organic', options: ['organic', 'cellular', 'grid'] },
  { name: 'interactive', type: 'boolean', default: false },
]

export const dotFieldSchema: PropSchema = [
  { name: 'color', type: 'color', default: '#88aaff' },
  { name: 'spacing', type: 'number', default: 24, min: 8, max: 80, step: 1 },
  { name: 'dotSize', type: 'number', default: 2, min: 1, max: 8, step: 0.5 },
  { name: 'reach', type: 'number', default: 80, min: 10, max: 400, step: 5 },
  { name: 'strength', type: 'number', default: 0.5, min: 0, max: 3, step: 0.05 },
  { name: 'interactive', type: 'boolean', default: true },
]

export const wavesSchema: PropSchema = [
  { name: 'color', type: 'color', default: '#5fc7ff' },
  { name: 'amplitude', type: 'number', default: 0.05, min: 0, max: 0.3, step: 0.005 },
  { name: 'frequency', type: 'number', default: 8, min: 1, max: 30, step: 0.5 },
  { name: 'speed', type: 'number', default: 0.5, min: 0, max: 2, step: 0.01 },
  { name: 'interactive', type: 'boolean', default: false },
]

export const meshGradientSchema: PropSchema = [
  { name: 'colors', type: 'colors', default: ['#ff7b72', '#7b9cff', '#88e5b8', '#ffb16d'] },
  { name: 'speed', type: 'number', default: 0.5, min: 0, max: 2, step: 0.01 },
  { name: 'blur', type: 'number', default: 0.4, min: 0.05, max: 1, step: 0.01 },
  { name: 'strength', type: 'number', default: 0.15, min: 0, max: 1, step: 0.01 },
  { name: 'interactive', type: 'boolean', default: false },
]

export const auroraSchema: PropSchema = [
  { name: 'colors', type: 'colors', default: ['#7b61ff', '#5fc7ff', '#ff61a6'] },
  { name: 'speed', type: 'number', default: 0.4, min: 0, max: 2, step: 0.01 },
  { name: 'intensity', type: 'number', default: 1, min: 0, max: 3, step: 0.01 },
  { name: 'cursorStrength', type: 'number', default: 1, min: 0, max: 3, step: 0.01 },
  { name: 'interactive', type: 'boolean', default: false },
]
```

**Verify each component's defaults match the schema before committing.** If a default in the schema disagrees with the component's prop default, the schema wins for the docs page only — but it's a smell; flag it for the user.

### Task 2: Refactor 5 component pages (canonical pattern)

The pattern from 4.2.a is the same for each. Below is the canonical template; apply it to each page substituting the appropriate schema and prop wiring.

- [ ] **Step 2.1: Refactor `apps/docs/app/components/noise-field/page.tsx`.**

```tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { LiveDemo } from '../../_components/LiveDemo'
import { CodeBlock } from '../../_components/CodeBlock'
import { PropsPlayground, type PropsState } from '../../_components/PropsPlayground'
import { noiseFieldSchema } from '../../_lib/playgroundSchemas'
import noiseFieldSource from '@matter/registry/noise-field.tsx?raw'

const NoiseField = dynamic(() => import('@matter/registry/noise-field').then((m) => m.NoiseField), {
  ssr: false,
})

function initialState(): PropsState {
  const out: PropsState = {}
  for (const e of noiseFieldSchema) out[e.name] = e.default
  return out
}

export default function NoiseFieldPage() {
  const [params, setParams] = useState<PropsState>(initialState)

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>&lt;NoiseField /&gt;</h1>
      <p style={{ color: 'var(--fg-muted)' }}>
        Pure noise pattern in three flavors: organic (FBM), cellular (Voronoi), grid (quantized
        FBM).
      </p>

      <LiveDemo>
        <NoiseField
          colors={params.colors as readonly string[]}
          scale={params.scale as number}
          speed={params.speed as number}
          variant={params.variant as 'organic' | 'cellular' | 'grid'}
          interactive={params.interactive as boolean}
        />
      </LiveDemo>

      <div
        style={{
          marginTop: '1.5rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1rem' }}>Playground</h2>
          <PropsPlayground schema={noiseFieldSchema} onChange={setParams} />
        </div>
        <div>
          <h2 style={{ fontSize: '1rem' }}>Source</h2>
          <CodeBlock source={noiseFieldSource} lang="tsx" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2.2: Repeat Step 2.1 pattern for `dot-field/page.tsx`, `waves/page.tsx`, `mesh-gradient/page.tsx`, `aurora/page.tsx`.**

For each:

- Import the appropriate schema from `_lib/playgroundSchemas`
- Import the source via `?raw`
- Dynamic-import the component (gotcha #10)
- Replace bespoke Tweakpane code with `<PropsPlayground>`
- Wrap demo in `<LiveDemo>`
- Add `<CodeBlock>` next to the playground
- Remove all `tweakpane` imports

The TypeScript prop wiring varies per component (each has its own type for the `variant` enum etc.). Match what the component's `*Props` interface expects.

- [ ] **Step 2.3: Refactor `linear-gradient/page.tsx`** to import from `playgroundSchemas` instead of defining inline (the 4.2.a version had it inline; centralize now).

### Task 3: Resolve NoiseField cursor TODO

`registry/noise-field.tsx:74` has a TODO comment indicating cursor is allocated-but-unread. Now we wire it to actually drive a TSL effect in the `cellular` variant — cursor influences a soft displacement of the voronoi sample point, similar to DotField's pattern.

- [ ] **Step 3.1: Read current `registry/noise-field.tsx`** to understand the existing structure.

- [ ] **Step 3.2: Wire cursor consumption.** The cursor uniform should already exist — pivot from "allocated, unread" to "allocated, used." Apply only to the `cellular` variant (organic and grid don't need it; spec doesn't mandate cursor on NoiseField; this is targeted polish).

Pseudo-pattern (engineer fills in concrete TSL — verify against gotcha #12 before committing):

```tsx
// Existing:
// const cursorUniform = uniform(...)
// useEffect: cursor.on('change', ...)
// TSL builds sampleP rooted on uv()...

// NEW (cellular variant only):
// const dist = length(uv().sub(cursorUniform))
// const pull = smoothstep(0.4, 0, dist).mul(0.05)
// const sampleP_warped = sampleP.add(vec2(pull, pull)) // pull cells toward cursor
// then voronoi(sampleP_warped, ...) instead of voronoi(sampleP, ...)
```

Remove the TODO comment at line 74 (or whatever line the marker is on after refactoring).

- [ ] **Step 3.3: Verify the cellular variant feels alive when interactive=true.**

```bash
pnpm --filter @matter/docs dev
# Open /components/noise-field, set variant=cellular, interactive=on
# Hover — cells should subtly track the cursor.
```

If it doesn't feel right, tune the smoothstep falloff (0.4 → 0.3 etc.) or the strength constant (0.05 → 0.02). Add WHY comments for any tuned constants.

### Task 4: Remove Tweakpane dependency

- [ ] **Step 4.1: Confirm no remaining Tweakpane imports.**

```bash
grep -r "tweakpane" apps/docs/app
# Expected: no results.
```

- [ ] **Step 4.2: Remove from `apps/docs/package.json`.**

```bash
pnpm --filter @matter/docs remove tweakpane @tweakpane/core
```

Expected: deps removed; pnpm-lock.yaml updated.

### Task 5: Verify and commit

- [ ] **Step 5.1: Full pre-flight.**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @matter/docs build
```

All must pass.

- [ ] **Step 5.2: Visual sweep.**

```bash
pnpm --filter @matter/docs dev
# Walk all 6 component pages: /components/{linear-gradient,noise-field,dot-field,waves,mesh-gradient,aurora}
# For each: confirm playground works; code block shows registry source; theme toggle works.
```

- [ ] **Step 5.3: Commit.**

ONE commit (or two — split if cleaner: one for the 5 page refactors + Tweakpane removal, one for the NoiseField cursor work). Default to one if the diff is digestible:

```bash
git add apps/docs/app/_lib apps/docs/app/components apps/docs/package.json pnpm-lock.yaml registry/noise-field.tsx
git commit -m "feat(docs): refactor 6 component pages onto shared docs infra; wire NoiseField cursor"
```

### Stop-and-play gate (4.2.b)

Walk all 6 component pages. Verify:

1. Each page renders the live shader.
2. Each page's PropsPlayground covers every prop on the component (no missing controls).
3. Each page's CodeBlock matches the source in `registry/<slug>.tsx` byte-for-byte.
4. Theme toggle works on every page.
5. NoiseField with `variant=cellular`, `interactive=on` shows the cursor influencing the cells.
6. `pnpm smoke` still passes (the CLI smoke test from M2 — should be unaffected, but confirm).

### Done-criteria for 4.2.b

- [ ] All 6 component pages refactored.
- [ ] No Tweakpane imports anywhere in `apps/docs/`.
- [ ] NoiseField cursor TODO resolved (line 74 marker gone, cursor wired in cellular variant).
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @matter/docs build && pnpm smoke` all green.
- [ ] One commit, scope `feat(docs)`.

### Review pass (4.2.b)

**Spec-compliance reviewer:** *"Verify each of the 6 refactored component pages exposes EVERY prop from the component's `*Props`interface as a PropsPlayground control. No prop should be unrepresented (except`inputs`, `fallback`, `className`, `style` which are §5.1 contract props, not user-facing)."\*

**Code-quality reviewer:** _"Sweep `registry/noise-field.tsx` for gotcha #12 in the new cursor-displace TSL chain. Confirm the chain is rooted on uv()/vec2 and the cursor uniform is only an arg to `length(...)`. Also confirm the TODO comment at the previous line 74 is removed (not just rewritten as a different TODO)."_

---

## Phase 4.3 — Hero page (combined-scene demo)

**Goal:** Replace `apps/docs/app/page.tsx` with the dogfooded showcase per spec §7.5: Aurora as hero bg, DotField in a feature section with `useScroll` driving its `reach`, MeshGradient behind the "Components" section header, NoiseField (variant grid) as a subtle nav-band texture. **This is the architectural stress test for spec §5.3 row 1** (combined-scene rendering). Surfaces perf gaps for M5 if the page chugs with 4 simultaneous Matter components.

**Files:**

- Modify: `apps/docs/app/page.tsx` (rewritten)
- Create: `apps/docs/app/_components/Hero.tsx`, `FeatureSection.tsx`, `ComponentsGrid.tsx`, `NavTexture.tsx` (split for clarity; each 50–100 lines)

### Task 1: Hero — Aurora background + headline

- [ ] **Step 1.1: Create `apps/docs/app/_components/Hero.tsx`.**

Aurora as a full-bleed bg behind a centered headline + CTA. The hero sits inside the page; the global header (from layout.tsx) sits above it.

```tsx
'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'

const Aurora = dynamic(() => import('@matter/registry/aurora').then((m) => m.Aurora), {
  ssr: false,
})

export function Hero() {
  return (
    <section
      style={{
        position: 'relative',
        height: '70vh',
        minHeight: 480,
        background: '#0a0a14',
        overflow: 'hidden',
      }}
    >
      <Aurora interactive intensity={0.6} cursorStrength={1.5} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 1.5rem',
          color: '#fff',
          textShadow: '0 1px 4px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}
      >
        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 4rem)', margin: 0, fontWeight: 700 }}>Matter</h1>
        <p style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)', maxWidth: '40ch', marginTop: '1rem' }}>
          React shader components powered by WebGPU and Three.js TSL. Copy-paste from{' '}
          <code>matter-cli</code>, animate with any signal-shaped library.
        </p>
        <div
          style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', pointerEvents: 'auto' }}
        >
          <Link
            href="/components/linear-gradient"
            style={{
              padding: '0.6rem 1.2rem',
              background: '#fff',
              color: '#0a0a14',
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            See components
          </Link>
        </div>
      </div>
    </section>
  )
}
```

`pointerEvents: 'none'` on the overlay lets cursor events pass through to Aurora. The CTA buttons re-enable pointer events.

### Task 2: Feature section — DotField with scroll-driven reach

- [ ] **Step 2.1: Create `apps/docs/app/_components/FeatureSection.tsx`.**

Embed DotField; pass `inputs={{ scroll: useScroll() }}` and use a derived `reach` value. **However**, DotField's current API takes `reach` as a `number`/`AnimatableProp<number>`. To drive `reach` from scroll, we need a transform function.

Option A: read scroll directly in the page and update a state-driven `reach` prop. Simple but causes React re-renders per scroll tick.

Option B: pass scroll as `inputs.scroll` and have DotField's TSL consume it via a uniform. Spec line 770 says useScroll exists but no v1 component consumes it.

For M4, we'll go with Option A — derive `reach` from scroll progress on the React side. The `useScroll` hook exists from M3.3; it's already rAF-throttled.

```tsx
'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import { useScroll } from '@lovo/matter-react'

const DotField = dynamic(() => import('@matter/registry/dot-field').then((m) => m.DotField), {
  ssr: false,
})

export function FeatureSection() {
  const scroll = useScroll()
  const [reach, setReach] = useState(60)

  useEffect(() => {
    return scroll.on('change', ([, progress]) => {
      // Map progress 0..1 to reach 60..200 — bigger ripple as you scroll.
      setReach(60 + progress * 140)
    })
  }, [scroll])

  return (
    <section style={{ padding: '4rem 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>Cursor + scroll, composed</h2>
      <p style={{ color: 'var(--fg-muted)', maxWidth: '60ch' }}>
        Every Matter component accepts <code>inputs</code> for cursor, scroll, and resize signals.
        Below: <code>&lt;DotField&gt;</code> with its <code>reach</code> driven by your scroll
        position.
      </p>
      <div
        style={{
          marginTop: '1.5rem',
          position: 'relative',
          height: 360,
          background: '#0a0a14',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <DotField interactive reach={reach} strength={1.2} />
      </div>
    </section>
  )
}
```

### Task 3: Components grid — MeshGradient behind header

- [ ] **Step 3.1: Create `apps/docs/app/_components/ComponentsGrid.tsx`.**

A list of all 6 components, each linking to its page. The section header (`<h2>`) sits over a `<MeshGradient>` ribbon.

```tsx
'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'

const MeshGradient = dynamic(
  () => import('@matter/registry/mesh-gradient').then((m) => m.MeshGradient),
  { ssr: false },
)

const COMPONENTS = [
  {
    slug: 'linear-gradient',
    label: '<LinearGradient>',
    desc: 'Animated linear or radial gradient with optional cursor parallax.',
  },
  {
    slug: 'noise-field',
    label: '<NoiseField>',
    desc: 'Pure noise pattern in three flavors: organic, cellular, grid.',
  },
  { slug: 'dot-field', label: '<DotField>', desc: 'Tiled dot field with cursor displacement.' },
  { slug: 'waves', label: '<Waves>', desc: 'Layered sine waves with cursor-spawned ripples.' },
  {
    slug: 'mesh-gradient',
    label: '<MeshGradient>',
    desc: 'Stripe-style multi-point gradient with animated blending.',
  },
  {
    slug: 'aurora',
    label: '<Aurora>',
    desc: 'Flowing FBM-displaced color bands with optional cursor amplification.',
  },
] as const

export function ComponentsGrid() {
  return (
    <section style={{ padding: '4rem 0', maxWidth: 1100, margin: '0 auto' }}>
      <div
        style={{
          position: 'relative',
          height: 100,
          padding: '0 1.5rem',
          overflow: 'hidden',
          borderRadius: 8,
          background: '#0a0a14',
        }}
      >
        <MeshGradient
          colors={['#7b61ff', '#5fc7ff', '#ff61a6', '#88e5b8']}
          speed={0.3}
          blur={0.6}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            padding: '0 1.5rem',
            color: '#fff',
            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }}
        >
          <h2 style={{ margin: 0 }}>Components</h2>
        </div>
      </div>
      <ul
        style={{
          listStyle: 'none',
          padding: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        {COMPONENTS.map((c) => (
          <li
            key={c.slug}
            style={{
              padding: '1rem',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--bg-muted)',
            }}
          >
            <Link href={`/components/${c.slug}`} style={{ fontWeight: 600 }}>
              {c.label}
            </Link>
            <p
              style={{
                marginTop: '0.5rem',
                marginBottom: 0,
                fontSize: '0.9rem',
                color: 'var(--fg-muted)',
              }}
            >
              {c.desc}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

### Task 4: Nav texture — NoiseField grid in header

- [ ] **Step 4.1: Decide layering approach.**

The spec says `<NoiseField variant="grid">` is "a subtle texture in the docs nav background." This means the global `<header>` from `layout.tsx` gets a NoiseField behind it.

**Caveat:** the global header is in `layout.tsx`, which is server-rendered by default. Mounting a Client-Component shader inside it requires either making the header a Client Component or extracting the shader into a Client wrapper.

- [ ] **Step 4.2: Create `apps/docs/app/_components/NavTexture.tsx`.**

```tsx
'use client'

import dynamic from 'next/dynamic'

const NoiseField = dynamic(() => import('@matter/registry/noise-field').then((m) => m.NoiseField), {
  ssr: false,
})

export function NavTexture() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.15,
        pointerEvents: 'none',
        zIndex: -1,
      }}
    >
      <NoiseField colors={['#0a0a14', '#5570ff']} scale={4} speed={0.1} variant="grid" />
    </div>
  )
}
```

- [ ] **Step 4.3: Update `layout.tsx` to mount `<NavTexture>` inside the header.**

```tsx
// in layout.tsx, inside the <header> element:
<header style={{ /* existing */, position: 'sticky', /* important: must be position:relative or sticky for absolute child */ }}>
  <NavTexture />
  <Link href="/" style={{ /* existing */ }}>Matter</Link>
  <ThemeToggle />
</header>
```

The texture's `zIndex: -1` keeps it behind the link and toggle. The header is `position: sticky` (already set in 4.1), which is a positioning context.

**Concern:** rendering a shader in a sticky element on every page may have perf cost. If the FPS drops noticeably, drop NavTexture and use a CSS `background-image: url('data:image/svg+xml...')` noise instead. Surface this as a feel-decision at the stop-and-play gate.

### Task 5: Compose hero page

- [ ] **Step 5.1: Replace `apps/docs/app/page.tsx`.**

```tsx
import { Hero } from './_components/Hero'
import { FeatureSection } from './_components/FeatureSection'
import { ComponentsGrid } from './_components/ComponentsGrid'

export default function Home() {
  return (
    <>
      <Hero />
      <ComponentsGrid />
      <FeatureSection />
    </>
  )
}
```

(Note: this is a Server Component by default; the imported sections are Client Components — fine.)

### Task 6: Verify build + perf check

- [ ] **Step 6.1: Build.**

```bash
pnpm --filter @matter/docs build
```

- [ ] **Step 6.2: Perf snapshot.** Open `/` in dev. Open Chrome DevTools Performance panel; record a 5-second hover + scroll. Check:
  - FPS stays at ~60 with mild work? Note actual range.
  - GPU memory usage stable? (Memory tab.)
  - Frame budget per Aurora/MeshGradient/DotField/NoiseField — anything dominating?

This isn't a perf optimization phase (that's M5). It's a measurement phase. **Capture the numbers in a comment or in your stop-and-play notes** so M5 has a baseline.

### Stop-and-play gate (4.3) — architectural validation

**This is the spec §5.3 row 1 validation moment.** Open `/`, scroll, hover, and feel:

1. **Hero Aurora.** Aurora bg flows; cursor amplifies near where you hover (since `interactive` is set).
2. **MeshGradient header bg.** "Components" section header has a subtle gradient backdrop that slowly shifts.
3. **DotField scroll-driven reach.** As you scroll, the dot field's responsiveness changes — bigger ripple as you scroll deeper.
4. **NoiseField nav.** Subtle grid texture behind the sticky header, dim enough not to be distracting.
5. **All 4 simultaneously.** No frame drops? CPU/GPU usage acceptable?
6. **Theme toggle on `/`.** Chrome adapts; shaders unchanged (intentional — shaders own their bg).

**Decisions to surface to the user:**

- Is the NavTexture worth keeping (per perf observations)?
- Is hero Aurora's `intensity={0.6}` calmer than the default `1` works for? Adjust here, propagate to the Aurora docs page if the user prefers the calmer default.
- Is DotField's reach mapping (60..200 over scroll progress) the right range, or should it be flatter / more dramatic?

If anything feels broken, fix in this phase. If anything feels suboptimal but not broken, capture as a note for M5 polish.

### Done-criteria for 4.3

- [ ] Hero page renders Aurora bg + Components grid + Feature section + Nav texture.
- [ ] Build green; visual sweep clean.
- [ ] Perf baseline captured (rough FPS + DevTools Performance summary).
- [ ] Spec §5.3 row 1 validated (combined-scene demo on `/`).
- [ ] Commit.

```bash
git add apps/docs/app/_components apps/docs/app/page.tsx apps/docs/app/layout.tsx
git commit -m "feat(docs): hero page (combined-scene demo) — Aurora + DotField + MeshGradient + NoiseField"
```

### Review pass (4.3)

**Architectural-soundness reviewer:** _"Open spec §5.3. Row 1 says 'All six work standalone; docs page combines them inside one MatterScene.' Our implementation puts FOUR (Aurora, MeshGradient, DotField, NoiseField) on the homepage but each is in its own MatterScene (each component wraps itself per §5.1). Is this 'combines them inside one MatterScene' or just 'multiple MatterScenes on one page'? If the latter, we've validated the simpler claim — multiple Matter components coexist on one page — but NOT the deeper Mode 2 claim from §3.4. Flag whether this M4 deliverable closes the §5.3 row or leaves a gap for future work."_

**Code-quality reviewer:** *"Sweep `apps/docs/app/_components/Hero.tsx`, `FeatureSection.tsx`, `ComponentsGrid.tsx`, `NavTexture.tsx`, `page.tsx` for: (1) any prop wiring inconsistent with the component's actual `*Props`interface; (2) the`pointer-events: none`overlay in Hero correctly lets cursor events through; (3) the FeatureSection's`useScroll`listener is properly cleaned up (the`scroll.on('change', ...)`returns a cleanup function — verify it's used); (4)`<NavTexture>`'s `zIndex: -1` doesn't break click-through to header buttons."\*

---

## Phase 4.4 — Primitive pages

**Goal:** Build `/primitives/[slug]` for the ~10 documented primitives. Each page has a `<PrimitiveDemo>` (a tiny shader exercising just that primitive with sliders for its params) + the TS function signature + cross-links to components that use it.

We document **8 custom primitives** (`colorRamp`, `noise`, `fbm`, `voronoi`, `quantize`, `sdfCircle`, `displace`, `cursorRipple`) plus **2 prominent TSL re-exports** (`time`, `uv`). The other TSL re-exports (`mix`, `length`, `smoothstep`, etc.) are mentioned in a brief reference section but don't get their own pages — they're standard TSL.

**Files:**

- Create: `apps/docs/app/primitives/[slug]/page.tsx` (dynamic route)
- Create: `apps/docs/app/_components/PrimitiveDemo.tsx`
- Create: `apps/docs/app/_data/primitives.ts` (per-primitive metadata + demo build function)

### Task 1: Primitive metadata + demo builders

- [ ] **Step 1.1: Create `apps/docs/app/_data/primitives.ts`.**

Each primitive entry has: `slug`, `name`, `description`, `signature` (string), `usedBy` (component slug list), `controls` (slider list), `build` (a callback that returns a TSL node given the params + uv).

```ts
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

export interface PrimitiveControl {
  name: string
  min: number
  max: number
  step: number
  default: number
}

export interface PrimitiveEntry {
  slug: string
  name: string
  description: string
  signature: string
  usedBy: readonly string[]
  controls: readonly PrimitiveControl[]
  /**
   * Returns the TSL node for the demo. The implementation imports lazily
   * inside the component's useEffect so this stays a pure metadata module.
   * The runtime contract is duck-typed; we just need slug + a `build` to look up.
   */
}

export const PRIMITIVES: readonly PrimitiveEntry[] = [
  {
    slug: 'fbm',
    name: 'fbm',
    description:
      "Fractal Brownian Motion — sums of noise at multiple scales. Produces cloudy or marbled patterns. Used for organic noise fields and Aurora's flowing displacement.",
    signature:
      'fbm(p: vec2, options?: { octaves?: number; lacunarity?: number; gain?: number }): float',
    usedBy: ['noise-field', 'mesh-gradient', 'aurora'],
    controls: [
      { name: 'scale', min: 0.5, max: 10, step: 0.1, default: 3 },
      { name: 'octaves', min: 1, max: 8, step: 1, default: 4 },
      { name: 'lacunarity', min: 1, max: 4, step: 0.1, default: 2 },
      { name: 'gain', min: 0.1, max: 1, step: 0.05, default: 0.5 },
      { name: 'speed', min: 0, max: 2, step: 0.01, default: 0.3 },
    ],
  },
  // ... entries for the other 9 primitives, see below
]
```

The full list of primitives to document (slug → controls):

| Slug            | Description                                             | Controls                                                                     |
| --------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `color-ramp`    | Sample a color from a list of color stops at a position | `position` 0..1                                                              |
| `noise`         | Single-octave perlin noise                              | `scale` 0.5..10, `speed` 0..2                                                |
| `fbm`           | Fractal Brownian Motion                                 | `scale`, `octaves`, `lacunarity`, `gain`, `speed`                            |
| `voronoi`       | Cellular distance field                                 | `scale` 0.5..10, `speed` 0..2                                                |
| `quantize`      | Step a value into discrete bins                         | `value` 0..1, `bins` 2..16                                                   |
| `sdf-circle`    | Signed distance field for a disk                        | `radius` 0..1, `cx` 0..1, `cy` 0..1                                          |
| `displace`      | Vector add — shifts a sample point                      | `x` -0.5..0.5, `y` -0.5..0.5                                                 |
| `cursor-ripple` | Cursor-spawned ripple displacement                      | `amplitude` 0..0.2, `falloff` 1..10, `speed` 0.1..3                          |
| `time`          | The animation time uniform (seconds since mount)        | (no controls — just demo a colored stripe at `sin(time)` to show it's wired) |
| `uv`            | The 2D fragment coordinate (0,0)→(1,1)                  | (no controls — demo a UV gradient)                                           |

Fill in the rest of `PRIMITIVES` with these entries.

### Task 2: PrimitiveDemo component

- [ ] **Step 2.1: Create `apps/docs/app/_components/PrimitiveDemo.tsx`.**

This is the per-primitive sandbox. It uses `<MatterScene>` directly (not `<LiveDemo>`-wrapped Tier 1 components — primitives don't ship as registry components).

The demo strategy: each primitive page provides a `build(params, uv, time)` callback that returns the TSL node. The PrimitiveDemo renders a single full-screen quad with that node as its `colorNode` (or scalar node mapped to grayscale).

```tsx
'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { PropsPlayground, type PropSchema, type PropsState } from './PropsPlayground'
import type { PrimitiveControl } from '../_data/primitives'

interface PrimitiveDemoProps {
  slug: string
  controls: readonly PrimitiveControl[]
}

// The demo Mesh + uniforms are built lazily on the client to avoid SSR.
const PrimitiveScene = dynamic(() => import('./PrimitiveScene').then((m) => m.PrimitiveScene), {
  ssr: false,
})

export function PrimitiveDemo({ slug, controls }: PrimitiveDemoProps) {
  // Build a PropSchema from the controls list.
  const schema: PropSchema = controls.map((c) => ({
    name: c.name,
    type: 'number' as const,
    default: c.default,
    min: c.min,
    max: c.max,
    step: c.step,
  }))

  const [params, setParams] = useState<PropsState>(() => {
    const init: PropsState = {}
    for (const c of controls) init[c.name] = c.default
    return init
  })

  return (
    <div>
      <div
        style={{
          position: 'relative',
          height: 320,
          background: '#0a0a14',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <PrimitiveScene slug={slug} params={params} />
      </div>
      {schema.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <PropsPlayground schema={schema} onChange={setParams} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2.2: Create `apps/docs/app/_components/PrimitiveScene.tsx`.**

The actual TSL building is keyed on `slug` and switches to the right TSL chain. **Apply gotcha #12 carefully here** — every chain must be rooted on `uv()`, `vec2(...)`, or `time`, with uniforms only as args.

```tsx
'use client'

import { useEffect } from 'react'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu'
import {
  uv,
  vec2,
  vec3,
  vec4,
  time,
  uniform,
  noise,
  fbm,
  voronoi,
  quantize,
  sdfCircle,
  displace,
  cursorRipple,
  colorRamp,
  smoothstep,
  sin,
  length,
} from '@lovo/matter'
import { MatterScene, useMatterContext } from '@lovo/matter-react'
import type { PropsState } from './PropsPlayground'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

interface PrimitiveSceneProps {
  slug: string
  params: PropsState
}

export function PrimitiveScene(props: PrimitiveSceneProps) {
  return (
    <MatterScene>
      <PrimitiveMesh {...props} />
    </MatterScene>
  )
}

function PrimitiveMesh({ slug, params }: PrimitiveSceneProps) {
  const ctx = useMatterContext()

  // Each control becomes a uniform, so the demo updates without rebuilding.
  // We build all uniforms upfront and only the relevant ones get used.
  // Note: this is an internal demo; we accept the "all uniforms always created" cost
  // since each primitive page mounts ONE PrimitiveDemo at a time.
  const allUniforms = useMemoUniforms(params)

  useEffect(() => {
    if (!ctx) return

    let colorNode: ShaderNodeObject<Node>
    switch (slug) {
      case 'fbm': {
        const scale = allUniforms.scale ?? uniform(3)
        const speed = allUniforms.speed ?? uniform(0.3)
        const octaves = (params.octaves as number | undefined) ?? 4
        const lacunarity = (params.lacunarity as number | undefined) ?? 2
        const gain = (params.gain as number | undefined) ?? 0.5
        // Note: octaves/lacunarity/gain rebuild the shader (they're shape params, not uniforms).
        const t = (time as ShaderNodeObject<Node>).mul(speed as unknown as number)
        const p = (uv() as ShaderNodeObject<Node>)
          .mul(scale as unknown as number)
          .add(vec2(t, t)) as ShaderNodeObject<Node>
        const f = fbm(p, { octaves, lacunarity, gain }) as ShaderNodeObject<Node>
        // Map -1..1 to 0..1 then to grayscale rgb.
        const g = (f.mul(0.5).add(0.5) as ShaderNodeObject<Node>).clamp(0, 1)
        colorNode = vec4(g, g, g, 1) as never
        break
      }
      case 'noise': {
        const scale = allUniforms.scale ?? uniform(3)
        const speed = allUniforms.speed ?? uniform(0.3)
        const t = (time as ShaderNodeObject<Node>).mul(speed as unknown as number)
        const p = (uv() as ShaderNodeObject<Node>)
          .mul(scale as unknown as number)
          .add(vec2(t, t)) as ShaderNodeObject<Node>
        const n = noise(p) as ShaderNodeObject<Node>
        const g = (n.mul(0.5).add(0.5) as ShaderNodeObject<Node>).clamp(0, 1)
        colorNode = vec4(g, g, g, 1) as never
        break
      }
      case 'voronoi': {
        // similar pattern; output cell distance as grayscale
        // ...
        // Engineer fills in remaining 8 primitive cases following the same shape.
        // Each case must be gotcha #12 compliant — root chains on uv()/time/vec2.
        colorNode = vec4(uv() as never, 0, 1) as never // placeholder
        break
      }
      // ... other cases: 'quantize', 'sdf-circle', 'displace', 'cursor-ripple', 'color-ramp', 'time', 'uv'
      case 'uv': {
        colorNode = vec4(uv() as never, 0, 1) as never
        break
      }
      case 'time': {
        const v = (sin((time as ShaderNodeObject<Node>).mul(2)) as ShaderNodeObject<Node>)
          .mul(0.5)
          .add(0.5) as ShaderNodeObject<Node>
        colorNode = vec4(v, v, v, 1) as never
        break
      }
      default:
        colorNode = vec4(1, 0, 1, 1) as never // magenta — unknown slug
    }

    const material = new MeshBasicNodeMaterial()
    material.colorNode = colorNode

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      try {
        material.dispose()
      } catch {
        /* benign */
      }
      try {
        mesh.geometry.dispose()
      } catch {
        /* same */
      }
    }
  }, [ctx, slug, allUniforms, params.octaves, params.lacunarity, params.gain])

  return null
}

// Helper hook — creates one uniform per param key and updates its value imperatively.
// The TSL chain only sees the uniform reference, never the changing param value.
function useMemoUniforms(params: PropsState): Record<string, unknown> {
  // Implementation: for each key whose value is a number, create one stable uniform
  // (memoize via useMemo on key). Update its .value in a separate effect.
  // For brevity: engineer can use `useAnimatableUniform` from @lovo/matter-react,
  // or write a small loop that creates and updates uniforms keyed by name.
  // The exact code is left to the engineer — both approaches satisfy gotcha #12.
  // ...
  return {} // engineer to implement
}
```

**Note for the engineer:** the `switch` on `slug` is intentional — primitives differ enough that a shared "build" abstraction would over-couple them. The `useMemoUniforms` helper above is sketched; flesh it out so changing a slider updates the demo without unmounting. If the helper grows beyond 30 lines, extract to its own file under `_lib/`.

**Critical:** every TSL chain in the switch cases MUST be gotcha-#12 compliant. Before committing, grep for `Uniform.add` / `Uniform.mul` / etc. in `PrimitiveScene.tsx` — there should be ZERO matches.

### Task 3: Dynamic page route

- [ ] **Step 3.1: Create `apps/docs/app/primitives/[slug]/page.tsx`.**

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PrimitiveDemo } from '../../_components/PrimitiveDemo'
import { CodeBlock } from '../../_components/CodeBlock'
import { PRIMITIVES } from '../../_data/primitives'

export function generateStaticParams() {
  return PRIMITIVES.map((p) => ({ slug: p.slug }))
}

export default async function PrimitivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const prim = PRIMITIVES.find((p) => p.slug === slug)
  if (!prim) notFound()

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <p style={{ color: 'var(--fg-muted)', marginTop: 0 }}>
        <Link href="/">Matter</Link> / <Link href="/primitives">primitives</Link> / {prim.slug}
      </p>
      <h1 style={{ marginTop: 0 }}>{prim.name}()</h1>
      <p style={{ color: 'var(--fg-muted)' }}>{prim.description}</p>

      <PrimitiveDemo slug={prim.slug} controls={prim.controls} />

      <h2 style={{ marginTop: '2rem', fontSize: '1rem' }}>Signature</h2>
      <CodeBlock source={prim.signature} lang="ts" />

      {prim.usedBy.length > 0 && (
        <>
          <h2 style={{ marginTop: '2rem', fontSize: '1rem' }}>Used by</h2>
          <ul>
            {prim.usedBy.map((slug) => (
              <li key={slug}>
                <Link href={`/components/${slug}`}>&lt;{slug}&gt;</Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
```

(Note: Next.js 15 `params` is a Promise — must `await`. This is a Server Component since it fetches metadata at build time via `generateStaticParams`.)

### Task 4: Primitives index page

- [ ] **Step 4.1: Create `apps/docs/app/primitives/page.tsx`.**

```tsx
import Link from 'next/link'
import { PRIMITIVES } from '../_data/primitives'

export default function PrimitivesIndex() {
  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Primitives</h1>
      <p style={{ color: 'var(--fg-muted)' }}>
        Tier 2 — pure TSL functions exported from <code>@lovo/matter</code>. Use them inside your
        own shader code or in <Link href="/recipes">recipes</Link>.
      </p>
      <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8 }}>
        {PRIMITIVES.map((p) => (
          <li key={p.slug}>
            <Link href={`/primitives/${p.slug}`}>{p.name}</Link>
            <span style={{ color: 'var(--fg-muted)', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
              — {p.description.split('.')[0]}.
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Task 5: Verify

- [ ] **Step 5.1: Build.**

```bash
pnpm --filter @matter/docs build
```

Expected: build emits 10 `/primitives/<slug>` static routes + `/primitives` index.

- [ ] **Step 5.2: Visual sweep.** Open each `/primitives/<slug>` route. Verify:
- The demo renders.
- Sliders work and update the demo.
- The signature codeblock shows correctly.
- "Used by" cross-links go to the right components.

### Stop-and-play gate (4.4)

Open all 10 primitive pages in turn. Confirm each demo renders correctly + sliders feel responsive. Note: this is the FIRST time we're rendering 10+ shaders on different routes — if any specific primitive crashes (e.g., `cursorRipple` needs cursor input that this demo doesn't provide), capture the bug and fix.

### Done-criteria for 4.4

- [ ] 10 primitive pages render under `/primitives/<slug>`.
- [ ] `/primitives` index lists all of them with descriptions.
- [ ] Each page has a working PrimitiveDemo + signature + cross-links.
- [ ] No gotcha-#12 chains in PrimitiveScene.tsx (grep is clean).
- [ ] Build green.
- [ ] One commit.

```bash
git add apps/docs/app/primitives apps/docs/app/_components/PrimitiveDemo.tsx apps/docs/app/_components/PrimitiveScene.tsx apps/docs/app/_data/primitives.ts
git commit -m "feat(docs): primitive pages — 10 routes with PrimitiveDemo + signature + cross-links"
```

### Review pass (4.4)

**Code-quality reviewer:** *"Sweep `apps/docs/app/_components/PrimitiveScene.tsx` for gotcha #12. Every TSL chain in every `switch` case must be rooted on `uv()`, `time`, or `vec2(...)`. Uniforms (`*Uniform`variables) must only be args. Grep for`Uniform.(add|sub|mul|div|length|dot|smoothstep|step|min|max|clamp|fract|floor|ceil|abs|sin|cos)`— should be ZERO matches across this file. Also verify the`useMemoUniforms` helper correctly memoizes uniforms across param changes (otherwise the demo will rebuild on every keystroke, hurting perf)."\*

---

## Phase 4.5 — Recipes

**Goal:** Build `/recipes/[slug]` for 4 starter recipes — short TSL snippets (10–30 lines) that demonstrate composition patterns. Each page has a live preview + the TSL source + the primitives used + variations.

The 4 starter recipes:

1. **`animated-stripes`** — vertical color stripes with a sin-based animation
2. **`cursor-glow`** — a soft glow that follows the cursor
3. **`plasma`** — fbm-driven swirl
4. **`cellular-tiles`** — voronoi quantized into discrete tiles

**Files:**

- Create: `apps/docs/app/recipes/[slug]/page.tsx`
- Create: `apps/docs/app/recipes/page.tsx` (index)
- Create: `apps/docs/app/_components/RecipeViewer.tsx`
- Create: `apps/docs/app/_data/recipes.ts`

### Task 1: Recipe metadata + TSL source

- [ ] **Step 1.1: Create `apps/docs/app/_data/recipes.ts`.**

Each recipe has a `slug`, `name`, `description`, `primitivesUsed` (slug list), and `source` (TSL string — for display) + `build` (callback returning the TSL node — for the live preview). The `source` and `build` should be **derived from the same logical TSL** — write the source as a string and have build use `eval(...)` or a hand-written equivalent. (We don't actually use eval; we hand-write build to match source. Engineer ensures they stay in sync.)

```ts
export interface RecipeEntry {
  slug: string
  name: string
  description: string
  primitivesUsed: readonly string[]
  source: string
  // The `build` function is in a separate file (per-recipe) since it needs TSL imports.
}

export const RECIPES: readonly RecipeEntry[] = [
  {
    slug: 'animated-stripes',
    name: 'Animated stripes',
    description:
      'Vertical bands that scroll horizontally — simplest combination of `sin`, `time`, and `colorRamp`.',
    primitivesUsed: ['time', 'uv', 'color-ramp'],
    source: `import { uv, time, vec3, vec4, sin, colorRamp } from '@lovo/matter'

const stripe = sin(uv().x.mul(20).add(time.mul(0.5)))
const t = stripe.mul(0.5).add(0.5).clamp(0, 1)
const stops = [
  { color: vec3(1, 0.5, 0.4), position: 0 },
  { color: vec3(0.4, 0.6, 1), position: 1 },
]
material.colorNode = vec4(colorRamp(t, stops), 1)`,
  },
  {
    slug: 'cursor-glow',
    name: 'Cursor glow',
    description:
      'A soft circular glow that follows the cursor. Demonstrates `length`, `smoothstep`, and a cursor uniform.',
    primitivesUsed: ['uv'],
    source: `// (cursor uniform set up in setup code; see plumbing in component code)
const dist = length(uv().sub(cursorUniform))
const glow = smoothstep(0.3, 0, dist)
material.colorNode = vec4(glow, glow.mul(0.7), glow.mul(1.5), 1)`,
  },
  {
    slug: 'plasma',
    name: 'Plasma',
    description: 'FBM-driven color swirl — the canonical "shader-y" look from one primitive.',
    primitivesUsed: ['fbm', 'time', 'uv', 'color-ramp'],
    source: `const t = time.mul(0.3)
const p = uv().mul(2).add(vec2(t, t))
const f = fbm(p, { octaves: 4 }).mul(0.5).add(0.5).clamp(0, 1)
const stops = [
  { color: vec3(0.4, 0.0, 0.8), position: 0 },
  { color: vec3(1, 0.4, 0.6), position: 0.5 },
  { color: vec3(0.4, 0.9, 1), position: 1 },
]
material.colorNode = vec4(colorRamp(f, stops), 1)`,
  },
  {
    slug: 'cellular-tiles',
    name: 'Cellular tiles',
    description:
      'Voronoi cells quantized into discrete tiles. Useful for organic-but-discrete textures.',
    primitivesUsed: ['voronoi', 'quantize', 'uv'],
    source: `const cells = voronoi(uv().mul(8))
const tiered = quantize(cells, 4)
material.colorNode = vec4(tiered, tiered.mul(0.7), tiered.mul(0.5), 1)`,
  },
]
```

### Task 2: Per-recipe build callbacks

- [ ] **Step 2.1: Create `apps/docs/app/recipes/_builds.ts`.**

This file owns the `build` callbacks (separate from metadata so the metadata module stays a pure data export).

```ts
import {
  uv,
  time,
  vec2,
  vec3,
  vec4,
  sin,
  length,
  smoothstep,
  fbm,
  voronoi,
  quantize,
  colorRamp,
  uniform,
} from '@lovo/matter'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'
import type { Vector2 } from 'three/webgpu'

export type RecipeBuild = (deps: {
  cursorUniform: ReturnType<typeof uniform>
}) => ShaderNodeObject<Node>

export const RECIPE_BUILDS: Record<string, RecipeBuild> = {
  'animated-stripes': () => {
    const stripe = sin(
      (uv() as ShaderNodeObject<Node>).x.mul(20).add((time as ShaderNodeObject<Node>).mul(0.5)),
    ) as ShaderNodeObject<Node>
    const t = stripe.mul(0.5).add(0.5).clamp(0, 1) as ShaderNodeObject<Node>
    const stops = [
      { color: vec3(1, 0.5, 0.4), position: 0 },
      { color: vec3(0.4, 0.6, 1), position: 1 },
    ]
    return vec4(colorRamp(t as never, stops), 1) as never
  },
  'cursor-glow': ({ cursorUniform }) => {
    const dist = length(uv().sub(cursorUniform as unknown as Vector2)) as ShaderNodeObject<Node>
    const glow = smoothstep(0.3, 0, dist as never) as ShaderNodeObject<Node>
    return vec4(glow, glow.mul(0.7), glow.mul(1.5), 1) as never
  },
  plasma: () => {
    const t = (time as ShaderNodeObject<Node>).mul(0.3)
    const p = (uv() as ShaderNodeObject<Node>).mul(2).add(vec2(t, t)) as ShaderNodeObject<Node>
    const f = (fbm(p, { octaves: 4 }) as ShaderNodeObject<Node>)
      .mul(0.5)
      .add(0.5)
      .clamp(0, 1) as ShaderNodeObject<Node>
    const stops = [
      { color: vec3(0.4, 0, 0.8), position: 0 },
      { color: vec3(1, 0.4, 0.6), position: 0.5 },
      { color: vec3(0.4, 0.9, 1), position: 1 },
    ]
    return vec4(colorRamp(f as never, stops), 1) as never
  },
  'cellular-tiles': () => {
    const cells = voronoi((uv() as ShaderNodeObject<Node>).mul(8)) as ShaderNodeObject<Node>
    const tiered = quantize(cells as never, 4) as ShaderNodeObject<Node>
    return vec4(tiered, tiered.mul(0.7), tiered.mul(0.5), 1) as never
  },
}
```

**Verify each build chain is gotcha #12 compliant.** No `Uniform.method()` patterns.

### Task 3: RecipeViewer component

- [ ] **Step 3.1: Create `apps/docs/app/_components/RecipeViewer.tsx`.**

```tsx
'use client'

import { useEffect } from 'react'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'
import { uniform } from '@lovo/matter'
import { MatterScene, useMatterContext, useCursor } from '@lovo/matter-react'
import { RECIPE_BUILDS } from '../recipes/_builds'

interface RecipeViewerProps {
  slug: string
}

export function RecipeViewer({ slug }: RecipeViewerProps) {
  return (
    <div
      style={{
        position: 'relative',
        height: 320,
        background: '#0a0a14',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <MatterScene>
        <RecipeMesh slug={slug} />
      </MatterScene>
    </div>
  )
}

function RecipeMesh({ slug }: { slug: string }) {
  const ctx = useMatterContext()
  const cursor = useCursor()
  // Stable cursor uniform — even recipes that don't use it pay no perf cost beyond the uniform alloc.
  const cursorVec = new Vector2(0.5, 0.5)
  const cursorUniform = uniform(cursorVec)

  useEffect(() => {
    return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y))
  }, [cursor, cursorVec])

  useEffect(() => {
    if (!ctx) return
    const build = RECIPE_BUILDS[slug]
    if (!build) return

    const colorNode = build({ cursorUniform })
    const material = new MeshBasicNodeMaterial()
    material.colorNode = colorNode

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      try {
        material.dispose()
      } catch {
        /* benign */
      }
      try {
        mesh.geometry.dispose()
      } catch {
        /* same */
      }
    }
  }, [ctx, slug, cursorUniform])

  return null
}
```

**Edge case:** if `useCursor()` returns null/stub (before MatterScene context is ready), `cursor.on(...)` is the inert stub from M3.3 — safe.

### Task 4: Recipe pages

- [ ] **Step 4.1: Create `apps/docs/app/recipes/[slug]/page.tsx`.**

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { CodeBlock } from '../../_components/CodeBlock'
import { RECIPES } from '../../_data/recipes'

const RecipeViewer = dynamic(
  () => import('../../_components/RecipeViewer').then((m) => m.RecipeViewer),
  { ssr: false },
)

export function generateStaticParams() {
  return RECIPES.map((r) => ({ slug: r.slug }))
}

export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const recipe = RECIPES.find((r) => r.slug === slug)
  if (!recipe) notFound()

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <p style={{ color: 'var(--fg-muted)', marginTop: 0 }}>
        <Link href="/">Matter</Link> / <Link href="/recipes">recipes</Link> / {recipe.slug}
      </p>
      <h1 style={{ marginTop: 0 }}>{recipe.name}</h1>
      <p style={{ color: 'var(--fg-muted)' }}>{recipe.description}</p>

      <RecipeViewer slug={recipe.slug} />

      <h2 style={{ marginTop: '2rem', fontSize: '1rem' }}>Source</h2>
      <CodeBlock source={recipe.source} lang="tsx" />

      {recipe.primitivesUsed.length > 0 && (
        <>
          <h2 style={{ marginTop: '2rem', fontSize: '1rem' }}>Primitives used</h2>
          <ul>
            {recipe.primitivesUsed.map((slug) => (
              <li key={slug}>
                <Link href={`/primitives/${slug}`}>{slug}</Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4.2: Create `apps/docs/app/recipes/page.tsx`.**

Index of recipes — same shape as `/primitives`.

```tsx
import Link from 'next/link'
import { RECIPES } from '../_data/recipes'

export default function RecipesIndex() {
  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Recipes</h1>
      <p style={{ color: 'var(--fg-muted)' }}>
        Tier 3 — short TSL snippets that combine primitives. Copy-paste into your own component.
      </p>
      <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8 }}>
        {RECIPES.map((r) => (
          <li key={r.slug}>
            <Link href={`/recipes/${r.slug}`}>{r.name}</Link>
            <span style={{ color: 'var(--fg-muted)', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
              — {r.description}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Task 5: Verify

- [ ] **Step 5.1: Build.**

```bash
pnpm --filter @matter/docs build
```

Expected: 4 `/recipes/<slug>` static routes + `/recipes` index.

- [ ] **Step 5.2: Visual sweep.** Each recipe renders the live shader; the source code matches what the build callback does; cross-links to primitives work.

### Stop-and-play gate (4.5)

Open each of the 4 recipe pages. Confirm each renders correctly. The cursor-glow recipe should react to cursor movement.

### Done-criteria for 4.5

- [ ] 4 recipe pages render under `/recipes/<slug>`.
- [ ] `/recipes` index lists them.
- [ ] No gotcha-#12 chains in `_builds.ts` or `RecipeViewer.tsx` (grep is clean).
- [ ] Build green.
- [ ] One commit.

```bash
git add apps/docs/app/recipes apps/docs/app/_components/RecipeViewer.tsx apps/docs/app/_data/recipes.ts
git commit -m "feat(docs): recipe pages — 4 starter recipes with live preview + source + primitive cross-links"
```

### Review pass (4.5)

**Code-quality reviewer:** _"Sweep `apps/docs/app/recipes/_builds.ts` and `RecipeViewer.tsx` for gotcha #12. Particular attention to the `cursor-glow` build — `length(uv().sub(cursorUniform))` should be uniform-as-arg pattern, not `cursorUniform.sub(...)`. Also verify the `source` strings in `recipes.ts` accurately describe what the `build` callbacks do — they should be conceptually equivalent (the build is hand-translated TSL, the source is what the user copy-pastes). If they diverge meaningfully, that's a documentation bug."_

---

## Phase 4.6 — Pagefind search

**Goal:** Add static-friendly search via Pagefind. Index runs as a post-build step against the static export. Search UI lives in the global header (next to the theme toggle).

**Files:**

- Modify: `apps/docs/package.json` (add `pagefind`, `@pagefind/default-ui`)
- Modify: `apps/docs/next.config.ts` (set `output: 'export'` if not already; disable for dev)
- Modify: `package.json` at the repo root (add `postbuild` script for Pagefind)
- Create: `apps/docs/app/_components/SearchBar.tsx`
- Modify: `apps/docs/app/layout.tsx` (add SearchBar to header)
- Modify: `.gitignore` (ignore `apps/docs/public/pagefind`)

### Task 1: Add Pagefind dependencies

- [ ] **Step 1.1: Add deps.**

```bash
pnpm --filter @matter/docs add pagefind @pagefind/default-ui
```

(`pagefind` is the indexer + runtime client; `@pagefind/default-ui` is a vanilla-JS UI we wrap in a React component.)

### Task 2: Configure Next.js for static export + post-build indexing

- [ ] **Step 2.1: Verify `apps/docs/next.config.ts` supports static export.**

Currently the docs site is implicitly statically built (`○ (Static)` in build output). Pagefind needs the static HTML files in a known location. Two options:

**Option A:** Run Pagefind against the built `.next/server/app/` directory (where Next.js writes prerendered HTML in App Router static-mode). This is brittle — the path depends on Next internals.

**Option B:** Use `next export` to produce a clean `out/` directory. This requires `output: 'export'` in `next.config.ts`. Tradeoff: this turns OFF dynamic features that the site doesn't currently use (no API routes, no ISR — we already are fully static). The dev experience is unchanged.

We use **Option B** (cleaner).

```ts
// apps/docs/next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'export',
  transpilePackages: ['@lovo/matter', '@lovo/matter-react', '@matter/registry'],
  // ... existing config
}

export default config
```

- [ ] **Step 2.2: Verify static export works.**

```bash
pnpm --filter @matter/docs build
ls apps/docs/out/
```

Expected: `out/` directory with `index.html`, `components/`, `primitives/`, `recipes/`, etc.

- [ ] **Step 2.3: Add `postbuild` script.**

In `apps/docs/package.json`:

```json
{
  "scripts": {
    // existing scripts...
    "postbuild": "pagefind --site out --output-path public/pagefind"
  }
}
```

This runs after `build` and produces the Pagefind index in `apps/docs/public/pagefind/`. Putting it in `public/` ensures Next bundles it as a static asset on the next build (or, since we already built once, it's available at `/pagefind/pagefind.js` on the dev server next time too).

**Caveat:** because the index is generated AFTER the build, the very first build won't include the Pagefind index in `out/`. We need to either: (a) run `next build` twice, (b) place the Pagefind index inside `out/` directly. Use (b) — simpler:

```json
"postbuild": "pagefind --site out --output-path out/pagefind"
```

Now `out/pagefind/` is in the static export and accessible at `/pagefind/pagefind.js`.

- [ ] **Step 2.4: Update `.gitignore`.**

```
apps/docs/out/
apps/docs/public/pagefind/
```

(`out/` is the static export — ignore it always; `public/pagefind/` is leftover if we ever switch back to Option A.)

### Task 3: SearchBar component

- [ ] **Step 3.1: Create `apps/docs/app/_components/SearchBar.tsx`.**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

export function SearchBar() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    if (typeof window === 'undefined') return

    let disposed = false
    let pagefindUI: { destroy?: () => void } | null = null(
      // Dynamic import to avoid SSR / bundle inclusion before search is opened.
      async () => {
        try {
          // Pagefind is loaded from /pagefind/pagefind-ui.js, which we must add to the page
          // via a <script> tag or fetch. Easiest: import the module placed in /pagefind/.
          const { PagefindUI } = (await import(
            /* @vite-ignore */ /* webpackIgnore: true */
            '/pagefind/pagefind-ui.js' as string
          )) as {
            PagefindUI: new (opts: { element: HTMLElement; showSubResults: boolean }) => {
              destroy?: () => void
            }
          }
          if (disposed || !containerRef.current) return
          pagefindUI = new PagefindUI({ element: containerRef.current, showSubResults: true })
        } catch (err) {
          console.warn('Pagefind not available (likely dev mode):', err)
        }
      },
    )()

    return () => {
      disposed = true
      try {
        pagefindUI?.destroy?.()
      } catch {
        /* benign */
      }
    }
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Search"
        style={{
          padding: '0.4rem 0.8rem',
          background: 'var(--bg-muted)',
          color: 'var(--fg)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        Search
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: '1.5rem',
            marginTop: '0.5rem',
            width: 'min(420px, 90vw)',
            padding: '0.75rem',
            borderRadius: 8,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          <div ref={containerRef} />
        </div>
      )}
    </>
  )
}
```

**Note on the dynamic import:** Pagefind's UI module isn't a normal NPM module at runtime — it's the file at `/pagefind/pagefind-ui.js` that the post-build step generated. Bundlers may try to resolve it at build time. The `webpackIgnore: true` hint and the absolute-path string trick keep the import dynamic at runtime. **This is fragile**; if it fails, fallback approach:

- Add `<script src="/pagefind/pagefind-ui.js" />` to layout.tsx via Next's `<Script>` component
- Read `window.PagefindUI` instead of importing it

Use the `<Script>` fallback if the dynamic import errors at build:

```tsx
// in layout.tsx after Providers wrapping
<Script src="/pagefind/pagefind-ui.js" strategy="afterInteractive" />
```

Then in `SearchBar.tsx`, drop the `await import(...)` and instead use `(window as { PagefindUI?: ... }).PagefindUI` after a small wait.

### Task 4: Mount SearchBar in header

- [ ] **Step 4.1: Update `apps/docs/app/layout.tsx`.**

Add SearchBar between the brand and ThemeToggle:

```tsx
<header style={{ /* existing */, position: 'sticky', /* required */ }}>
  <NavTexture />
  <Link href="/" style={{ /* existing */ }}>Matter</Link>
  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
    <SearchBar />
    <ThemeToggle />
  </div>
</header>
```

### Task 5: Verify

- [ ] **Step 5.1: Build (which runs Pagefind post-build).**

```bash
pnpm --filter @matter/docs build
ls apps/docs/out/pagefind/
```

Expected: `pagefind/pagefind.js`, `pagefind-ui.js`, `pagefind.en.pf_meta`, etc. exist.

- [ ] **Step 5.2: Serve the built output and try search.**

```bash
pnpm --filter @matter/docs exec serve out
# or any static server pointing at apps/docs/out/
```

Open `http://localhost:3000/` (or the served URL). Click Search. Type "fbm" — expect results pointing at the FBM primitive page + components that use it. Type "cursor" — expect results pointing at DotField, Aurora, cursor-ripple, etc.

In **dev** (`pnpm --filter @matter/docs dev`), search clicks will fail with "Pagefind not available" — that's expected; search only works against the built output.

### Stop-and-play gate (4.6)

1. Search "fbm" — finds FBM primitive page.
2. Search "cursor" — finds DotField, Aurora, cursor-glow recipe, cursor-ripple primitive.
3. Search "matter" — finds the homepage.
4. Search a non-existent term — returns "No results."
5. Theme toggle still works while search panel is open.

### Done-criteria for 4.6

- [ ] Pagefind index generated in `out/pagefind/`.
- [ ] SearchBar in header opens/closes; queries return relevant results.
- [ ] Build green; `pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @matter/docs build` all pass.
- [ ] One commit.

```bash
git add apps/docs/app/_components/SearchBar.tsx apps/docs/app/layout.tsx apps/docs/next.config.ts apps/docs/package.json pnpm-lock.yaml .gitignore
git commit -m "feat(docs): Pagefind search — static index + UI in header"
```

### Review pass (4.6)

**Spec-compliance reviewer:** _"Spec §7.6 says 'Search: Pagefind (open-source, static-friendly, no SaaS dep) for v1.' Verify: (1) Pagefind is the actual indexer used; (2) no SaaS dep introduced (no Algolia/Typesense fallback); (3) the index runs at build time, not at request time; (4) the search works on the production-built site."_

---

## Phase 4.7 — M4 wrap-up

**Goal:** Tag `m4-complete`. Update CLAUDE.md milestone table. Write memory entry. Final verification.

**Files:**

- Modify: `CLAUDE.md` (mark M4 complete)
- Memory: `~/.claude/projects/-Users-hunter-garrett-Documents--personal-mattermix/memory/project_matter_m4_complete.md` (new)
- Memory: `~/.claude/projects/.../memory/MEMORY.md` (add index line)

### Task 1: Final verification

- [ ] **Step 1.1: Full pre-flight.**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @matter/docs build && pnpm smoke
```

All must pass.

- [ ] **Step 1.2: Walk all docs routes in dev.**

```bash
pnpm --filter @matter/docs dev
```

- `/` — hero with all 4 components
- `/components/<slug>` — 6 routes
- `/primitives` — index
- `/primitives/<slug>` — 10 routes
- `/recipes` — index
- `/recipes/<slug>` — 4 routes
- `/dev/fbm-playground`, `/dev/mesh-gradient-playground` — still work

That's 25 working routes. Confirm.

- [ ] **Step 1.3: Walk against the production build (search works here).**

```bash
pnpm --filter @matter/docs build
pnpm --filter @matter/docs exec serve out
# Open http://localhost:3000 — verify search works
```

### Task 2: Three-reviewer pass

Per the M3 wrap-up precedent, dispatch THREE parallel reviewers on the M3..M4 range:

**Spec-compliance reviewer:** _"Verify M4 ships exactly what spec §10.2 row 4 lists: component pages with PropsPlayground for all six; primitive pages; 4–6 starter recipes; dogfooded hero page; Pagefind search; theme toggle. Confirm intentional deferrals (`/getting-started`, `/guides/_`, `/reference`) are NOT silently shipped vs. silently missed — they should be absent and OK."\*

**Code-quality reviewer:** _"Sweep all new TSL chains across PrimitiveScene.tsx, RecipeViewer.tsx, \_builds.ts, Hero.tsx, FeatureSection.tsx, ComponentsGrid.tsx, NavTexture.tsx for gotcha #12. Sweep registry/noise-field.tsx for the cursor-displace chain added in 4.2.b. Confirm: zero `Uniform.method()` chain receivers; all dispose paths use try/swallow per gotcha #13; SSR-safe boundaries (gotcha #10) on every component-rendering page."_

**Architectural-soundness reviewer:** _"Open spec §5.3. After M4: rows 1 (combined-scene demo on /), 6 (three-tier model — components + primitives + recipes shown on docs site), and 7 (animatable prop protocol — propsplayground demonstrates it on every component) are now FULLY validated where they were partial post-M3. Walk the table: are rows 2, 3, 4, 5 still in the same state as M3-close? Any new gaps surfaced by M4?"_

Address REQUIRED notes via follow-up commits. SUGGESTED → memory.

### Task 3: Update CLAUDE.md milestone table

- [ ] **Step 3.1: Edit CLAUDE.md.**

Find the milestone status table. Update row 4:

```
| 4 | Docs site polish | ✅ Complete | `m4-complete` |
```

### Task 4: Tag

- [ ] **Step 4.1: Commit + tag.**

```bash
git add CLAUDE.md
git commit -m "docs: mark M4 complete in milestone table"

# Tag on the wrap-up commit (or on the last substantive M4 commit, depending on whether the CLAUDE.md update gets folded in).
git tag m4-complete
git tag
# Expected: m0..m4 all listed.
```

### Task 5: Memory entry

- [ ] **Step 5.1: Write `project_matter_m4_complete.md`.**

The skill's memory-rules say: capture surprising/non-obvious learnings, NOT pattern facts. Topics worth covering:

- Final approach to PropsPlayground (option A — schema-driven). Did the prototype gate confirm or pivot?
- Final approach to NavTexture (kept it / dropped it for perf reasons). Capture decision.
- Combined-scene perf observations from 4.3 (rough FPS, anything to flag for M5).
- Pagefind setup quirks (the `out/pagefind` placement, `output: 'export'` decision, dynamic import vs. `<Script>` fallback).
- Whether the 4.2.a feel-decision diverged from the M3 Tweakpane UX in any unexpected way.
- Recipes-vs-primitives boundary lesson — anything that should have been a recipe was a primitive (or vice versa).

```markdown
---
name: matter M4 complete + lessons
description: M4 shipped <DATE> (docs site polish, 6 component pages refactored, 10 primitive pages, 4 recipes, hero, Pagefind, theme — tagged m4-complete). Captures milestone-level lessons.
type: project
---

[engineer fills in based on actual M4 outcomes]
```

- [ ] **Step 5.2: Index in MEMORY.md.**

Add a one-liner to `~/.claude/projects/-Users-hunter-garrett-Documents--personal-mattermix/memory/MEMORY.md`:

```markdown
- [matter M4 complete + lessons](project_matter_m4_complete.md) — M4 shipped <DATE> (docs site polish, tagged m4-complete). Next session = M5 (perf + a11y + visual regression).
```

### Done-criteria for 4.7 / M4

- [ ] All 25 routes render in dev.
- [ ] All routes render in production build (`pnpm --filter @matter/docs build`).
- [ ] Pagefind search works against production build.
- [ ] Theme toggle works on every page.
- [ ] CodeBlock matches registry source byte-for-byte on each component page.
- [ ] All 6 component pages use the schema-driven PropsPlayground.
- [ ] Tier 2 primitives + Tier 3 recipes both have routes per spec §7.1.
- [ ] Spec §5.3 row 1 (combined-scene) demonstrated on `/`.
- [ ] NoiseField cursor TODO resolved (no remaining TODO marker).
- [ ] No Tweakpane imports in `apps/docs/`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm smoke && pnpm --filter @matter/docs build` all green.
- [ ] Tag `m4-complete` exists.
- [ ] Memory entry written + indexed.

---

## End-of-plan self-review checklist

Engineer reads top-to-bottom before declaring plan-ready:

- [ ] Every spec §10.2 row 4 deliverable has a phase that ships it (PropsPlayground = 4.2; primitive pages = 4.4; recipes = 4.5; hero = 4.3; Pagefind = 4.6; theme = 4.1).
- [ ] Spec §7.1 IA items NOT in §10.2 row 4 are explicitly deferred (getting-started, guides, reference).
- [ ] Every phase ends at a runnable observable point per the user's pacing rule.
- [ ] Phase 4.2 has a feel-decision gate (4.2.a → 4.2.b) per M3 precedent.
- [ ] Phase 4.3 surfaces a perf-baseline-capture step per spec §11 ("shared scene perf ceiling — not knowable until M4").
- [ ] No phase relies on a primitive/component shipped by a later phase.
- [ ] Every TSL-bearing phase (4.3, 4.4, 4.5) has an explicit gotcha #12 sweep in its review pass instructions.
- [ ] M3 carry-overs absorbed: combined-scene demo (4.3), recipes route (4.5), NoiseField cursor TODO (4.2.b).
- [ ] No emojis in plan code blocks or commit messages.
