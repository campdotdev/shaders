# Matter - Milestone 8: MDX content plumbing - Implementation Plan

> **Renderer decision (Phase 8.0, confirmed 2026-05-24):** `next-mdx-remote/rsc` is the primary path. Verified on commit `0518f70`: a Server Component reading `content/docs/_spike.mdx` via `fs.readFile`, parsing frontmatter with `gray-matter`, and rendering MDX with `<MDXRemote source={content} components={{ Callout }} options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }} />` prerenders statically to HTML containing all expected elements (h1/h2, GFM table, custom Callout body, frontmatter dump). One Next.js gotcha surfaced: folders prefixed with `_` are treated as private and silently excluded from routing — use plain names for any temporary route directories.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. If multiple workers are available, `superpowers:subagent-driven-development` is appropriate after Phase 8.1 because the content source, shell UI, and migrated MDX pages can be split into mostly independent work streams. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Matter's docs experience custom while replacing ad-hoc docs plumbing with a small, typed MDX content system. The docs site should support prose pages at `/getting-started`, `/cli`, `/changelog`, `/examples`, `/guides/*`, `/react/*`, and `/reference/*`, while preserving bespoke interactive pages for `/components/[slug]` and `/primitives/[slug]`. End state: adding a prose docs page is mostly "create an MDX file with frontmatter"; navigation, breadcrumbs, TOC, prev/next links, metadata, and search input are derived from a typed content graph driven by a single nav config.

**Architecture:** This milestone deliberately does **not** adopt Fumadocs. Instead, it builds the useful subset Matter needs: a filesystem-backed MDX source layer, validated frontmatter, heading extraction, a data-driven nav tree, route metadata, previous/next links, and a search document feed. The visual shell stays Matter-specific and minimal — the user owns hero and visual polish through a separate Figma design pass, so M8 ships *plumbing*, not a finished aesthetic. The custom shader pages stay TSX-first and opt into the same nav/search graph as synthetic pages.

**Renderer decision:** Prefer a local-trusted MDX renderer (`next-mdx-remote/rsc`) for prose pages instead of `@next/mdx` file-routing. Rationale: the content graph can be built directly from the filesystem without generating static import maps, frontmatter can be parsed before rendering, and the catch-all docs route can stay data-driven. If Phase 8.0 proves this path awkward with React Server Components or MDX component mapping, fall back to `@next/mdx` plus a generated import map.

**Scope notes:**

- **Recipes deferred.** The existing `/recipes/*` routes and `src/data/recipes.ts` stay in the repo from M3/M4 but are **not** surfaced in M8's nav, sidebar, search, or breadcrumbs. They return post-launch.
- **Hero / `/` landing.** Owned by the user's Figma design pass, not this milestone. M8 leaves the existing `/` route untouched.
- **Framework-aware IA.** URL structure follows Option B (framework hub): engine surfaces are framework-agnostic; React-specific guides and API live under `/react/*`. See "Information Architecture" below.

---

## Critical Context - Read This First

### Experience stays custom

Matter docs are not a generic markdown site. Component pages lead with live WebGPU demos, controls, registry source, and copy-paste workflows. This milestone should not turn `/components/[slug]` into MDX-first pages.

The intended split:

| Surface | Primary source | Notes |
| --- | --- | --- |
| `/` | TSX | Owned by user's Figma pass; M8 does not modify |
| `/components/[slug]`, `/primitives/[slug]` | TSX + typed catalog data | Custom interactive experience |
| `/components`, `/primitives` (index pages) | TSX, fed by catalog data | Catalog grids |
| `/getting-started`, `/cli`, `/changelog`, `/examples` | MDX | Overview prose pages |
| `/guides/*` | MDX | Framework-agnostic concept guides |
| `/react/api`, `/react/guides/*` | MDX | React-binding-specific prose |
| `/reference/*` | MDX | Engine API surface |
| Sidebar / search graph | Combined source graph | MDX + synthetic catalog records, ordered by nav config |

### Do not rebuild all of Fumadocs

Build only the pieces Matter needs now:

- page discovery
- frontmatter validation
- route metadata
- nav tree generation (config-driven)
- breadcrumbs
- table of contents
- previous/next links
- search document feed
- custom MDX components

Do not build in this milestone:

- versioned docs
- i18n
- remote CMS support
- generic plugin APIs
- theme/layout customization framework
- live MDX editing
- automatic TypeScript API extraction

### MDX should not own heavy demos yet

MDX pages can use small docs components (`<Callout>`, `<Steps>`, `<Tabs>`, `<CodeBlock>`), but should avoid importing registry components directly in MDX during this milestone. If a prose guide needs a live shader, expose a narrow allow-listed component from `src/content/mdx.tsx` rather than allowing arbitrary imports.

### Defer visual polish to Figma

The user is designing the hero and overall docs aesthetic in Figma separately. M8 should ship a sidebar/breadcrumbs/TOC that work and don't fight the existing theme variables, but should NOT over-invest in:

- exact spacing/typography decisions
- sidebar expand/collapse animations
- decorative chrome
- color choices beyond what the existing theme exposes

Flag visual decisions explicitly as "deferring to Figma" in comments or PR notes rather than committing.

### Route conflict warning

The generic MDX route is a root-level catch-all. It must return `notFound()` for unknown slugs and coexist with existing specific routes:

- `/components`, `/components/[slug]`
- `/primitives`, `/primitives/[slug]`
- `/recipes`, `/recipes/[slug]` (existing but not navigated to)
- `/dev/*`

Next should prioritize specific routes over catch-all routes, but verify this explicitly in Phase 8.2.

---

## Information Architecture

### URL tree

```
/                                  Hero (Figma-owned; not modified by M8)

# Overview (sidebar group)
/getting-started                   Install, init, first component (React-shaped in v1)
/cli                               @lovo/matter-cli usage
/changelog                         Release notes (sourced from engine CHANGELOG.md initially)
/examples                          Stub index for M8; curated examples land post-launch

# Components (sidebar group)
/components                        Catalog index (synthetic from registry)
/components/[slug]                 Existing TSX pages (Aurora, LinearGradient, etc.)

# Primitives (sidebar group)
/primitives                        Catalog index (synthetic)
/primitives/[slug]                 Existing TSX pages

# Guides (sidebar group — framework-agnostic only)
/guides/animation
/guides/perf
/guides/shared-scenes

# Frameworks (sidebar group)
/react/api                         Matter-React API reference
/react/guides/ssr-and-fallbacks    Client-only WebGPU, fallbacks, dynamic import patterns
/react/guides/three-r3f            Mode 2 — using Matter inside r3f Canvas

# Reference (sidebar group)
/reference/matter                  Engine API
```

Sidebar group order: **Overview → Components → Primitives → Guides → Frameworks → Reference.**

### Why this shape

- **Engine surfaces stay framework-agnostic** (`/primitives/*`, `/reference/matter`, `/guides/*`). When Vue or Svelte bindings ship, no URL churn.
- **Framework-specific content lives under a framework prefix** (`/react/*`). Future `/vue/*`, `/svelte/*` slot in as siblings under the Frameworks group.
- **A "Frameworks > React" group with one child is intentional** — it signals the multi-framework story and locks the IA so adding bindings is a config edit, not a refactor.
- **`/getting-started` stays at root** despite being React-shaped in v1. When other bindings ship, the page either grows framework tabs or becomes a framework picker. Deferring that decision.

### Nav config shape

Nav is data-driven from two sources:

1. **Per-page frontmatter** declares membership via a dotted `section` path.
2. **A single nav config** at `apps/docs/src/content/nav.config.ts` defines group structure, order, and labels.

```ts
// apps/docs/src/content/nav.config.ts
export const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { kind: 'page', slug: '/getting-started' },
      { kind: 'page', slug: '/cli' },
      { kind: 'page', slug: '/changelog' },
      { kind: 'page', slug: '/examples' },
    ],
  },
  {
    label: 'Components',
    items: [{ kind: 'catalog', source: 'components' }],
  },
  {
    label: 'Primitives',
    items: [{ kind: 'catalog', source: 'primitives' }],
  },
  {
    label: 'Guides',
    items: [{ kind: 'section', collectsFrom: 'guides' }],
  },
  {
    label: 'Frameworks',
    items: [
      {
        label: 'React',
        items: [
          { kind: 'page', slug: '/react/api' },
          { kind: 'section', collectsFrom: 'react.guides' },
        ],
      },
      // Future: { label: 'Vue', items: [...] }
    ],
  },
  {
    label: 'Reference',
    items: [{ kind: 'section', collectsFrom: 'reference' }],
  },
]
```

Adding a framework later = author MDX with the right `section`, add an entry under the Frameworks group. No component code changes.

### Section taxonomy

Frontmatter `section` values used in M8:

| Section | URL prefix | Pages |
| --- | --- | --- |
| `overview` | `/` | getting-started, cli, changelog, examples |
| `guides` | `/guides/` | animation, perf, shared-scenes |
| `react.guides` | `/react/guides/` | ssr-and-fallbacks, three-r3f |
| `react.api` | `/react/` | api |
| `reference` | `/reference/` | matter |

Catalog pages (`components`, `primitives`) are synthetic records — they do not use MDX frontmatter and are pulled from registry data via the `catalog` kind in nav config.

---

## Dependency Graph

| Phase | Depends on | Ships |
| --- | --- | --- |
| **8.0 - MDX renderer spike** | Current docs app | Confirms `next-mdx-remote/rsc` path or selects fallback |
| **8.1 - Content source layer** | 8.0 | Typed page graph, frontmatter schema, TOC extraction, nav config types |
| **8.2 - Generic MDX route** | 8.1 | `/getting-started`, `/cli`, `/changelog`, `/examples`, `/guides/*`, `/react/*`, `/reference/*` renderer |
| **8.3 - Docs shell + nav** | 8.1, 8.2 | Sidebar (config-driven), breadcrumbs, TOC, prev/next |
| **8.4 - Initial prose content** | 8.2, 8.3 | First MDX docs pages from the URL tree above |
| **8.5 - Catalog graph integration** | 8.1, current custom pages | Components and Primitives synthetic records appear in shared nav/search graph |
| **8.6 - Search foundation** | 8.1, 8.4, 8.5 | Search document feed and lightweight search UI or Pagefind-ready output |
| **8.7 - Verification and cleanup** | All prior phases | Build, typecheck, route audit, docs note |

After 8.1, Phases 8.3, 8.4, and 8.5 can be developed in parallel if the write scopes are kept separate.

---

## Proposed File Structure

```
apps/docs/
├── content/
│   └── docs/
│       ├── getting-started.mdx
│       ├── cli.mdx
│       ├── changelog.mdx
│       ├── examples.mdx
│       ├── guides/
│       │   ├── animation.mdx
│       │   ├── perf.mdx
│       │   └── shared-scenes.mdx
│       ├── react/
│       │   ├── api.mdx
│       │   └── guides/
│       │       ├── ssr-and-fallbacks.mdx
│       │       └── three-r3f.mdx
│       └── reference/
│           └── matter.mdx
├── src/
│   ├── app/
│   │   ├── (docs-content)/
│   │   │   ├── [...slug]/page.tsx
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   └── page.tsx              ← NEW: top-level catalog index
│   │   └── primitives/
│   │       └── page.tsx              ← already exists; integrate into shared shell
│   ├── components/
│   │   ├── docs/
│   │   │   ├── Breadcrumbs.tsx
│   │   │   ├── Callout.tsx
│   │   │   ├── DocsShell.tsx
│   │   │   ├── DocsSidebar.tsx
│   │   │   ├── MdxCode.tsx
│   │   │   ├── PrevNext.tsx
│   │   │   ├── Steps.tsx
│   │   │   └── TableOfContents.tsx
│   │   └── SearchBar.tsx
│   └── content/
│       ├── catalog.ts
│       ├── mdx.tsx
│       ├── nav.config.ts
│       ├── nav.ts
│       ├── schema.ts
│       ├── search.ts
│       ├── source.ts
│       ├── toc.ts
│       └── types.ts
└── package.json
```

Imports between folders use the `@/` path alias (`@/components/...`, `@/content/...`, `@/lib/...`) — set up in `tsconfig.json` with `paths: { "@/*": ["./src/*"] }`. Same-folder imports stay relative.

Keep the separation clear:

- `src/content/` = data/source utilities + nav config
- `src/components/docs/` = reusable docs chrome
- `content/docs/` = author-authored MDX
- `(docs-content)/[...slug]` = generic prose renderer

---

## Frontmatter Contract

Every MDX docs page should start with YAML frontmatter:

```mdx
---
title: Performance
description: Pause behavior, DPR limits, and render-on-demand patterns.
section: guides
order: 50
---

# Performance
```

Required fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `title` | string | Page title, metadata, sidebar fallback |
| `description` | string | SEO/search/card summary |
| `section` | dotted string | Sidebar grouping (see Section taxonomy above) |
| `order` | number | Sort order within section |

Optional fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `navTitle` | string | Short sidebar label when title is long |
| `hidden` | boolean | Renderable but omitted from nav |
| `status` | `"draft" \| "ready"` | Lets drafts exist without ambiguity |
| `tags` | string[] | Search filtering and future related-docs |

Initial `section` values (enforced via zod literal union):

```ts
type DocsSection =
  | 'overview'
  | 'guides'
  | 'react.guides'
  | 'react.api'
  | 'reference'
```

Catalog pages (`components`, `primitives`) are synthetic records and do not use MDX frontmatter — they are merged into nav via the `catalog` item kind.

---

## Phase 8.0 - MDX Renderer Spike

**Goal:** Prove the MDX rendering path before building the content graph around it.

**Files:**

- Temporarily create: `apps/docs/content/docs/_spike.mdx`
- Temporarily create or modify: `apps/docs/src/app/(docs-content)/_spike/page.tsx`
- Modify: `apps/docs/package.json`

### Task 1: Add spike dependencies

- [ ] Add the smallest dependency set needed for the primary path:

```bash
pnpm --filter @matter/docs add next-mdx-remote gray-matter zod github-slugger remark-gfm unified remark-parse remark-mdx unist-util-visit mdast-util-to-string
```

Notes:

- `next-mdx-remote/rsc` renders local trusted MDX inside a Server Component.
- `gray-matter` parses frontmatter for the content index without compiling MDX.
- `zod` validates frontmatter and gives clear authoring errors.
- `github-slugger` keeps heading ids compatible with GitHub-style markdown expectations.
- `remark-gfm` enables tables/task lists in MDX prose.
- `unified`, `remark-parse`, `remark-mdx`, `unist-util-visit`, and `mdast-util-to-string` support structured TOC extraction without fragile regex parsing.

If implementation discovers that `next-mdx-remote/rsc` is a poor fit, replace this with the fallback path:

```bash
pnpm --filter @matter/docs add @next/mdx @mdx-js/loader @mdx-js/react gray-matter zod github-slugger remark-gfm remark-frontmatter remark-mdx-frontmatter unified remark-parse remark-mdx unist-util-visit mdast-util-to-string
```

### Task 2: Render one local MDX page

- [ ] Create a throwaway `_spike.mdx` with frontmatter, a heading, a code block, and one custom component.
- [ ] Render it through a Server Component.
- [ ] Confirm the page builds under `pnpm --filter @matter/docs build`.
- [ ] Confirm custom MDX component mapping works without letting MDX import arbitrary registry components.
- [ ] Delete the throwaway route and content after the spike.

**Gate:** Do not start Phase 8.1 until the renderer choice is confirmed in a short note at the top of this plan:

```md
> Renderer decision: ...
```

---

## Phase 8.1 - Content Source Layer

**Goal:** Add the typed data layer that all docs features consume.

**Files:**

- Create: `apps/docs/src/content/types.ts`
- Create: `apps/docs/src/content/schema.ts`
- Create: `apps/docs/src/content/source.ts`
- Create: `apps/docs/src/content/toc.ts`
- Create: `apps/docs/src/content/nav.config.ts`
- Create: `apps/docs/src/content/nav.ts`
- Create: `apps/docs/src/content/search.ts`

### Task 1: Define page types

- [ ] Define `DocsFrontmatter`, `DocsPage`, `DocsHeading`, `DocsSearchDocument`.
- [ ] Define nav config types: `NavGroup`, `NavItem` (with kinds `page`, `section`, `catalog`, and nested groups).
- [ ] Keep URL construction centralized. No page should hand-concatenate slugs except inside `src/content/source.ts`.
- [ ] Include `sourcePath` on page records for diagnostics, but do not expose local filesystem paths in the rendered UI.

### Task 2: Validate frontmatter

- [ ] Add a `zod` schema for frontmatter, including the `section` literal union from the Section taxonomy table.
- [ ] Emit clear errors that include the MDX file path and invalid field.
- [ ] Default optional fields centrally:
  - `navTitle` defaults to `title`
  - `hidden` defaults to `false`
  - `status` defaults to `ready`
  - `tags` defaults to `[]`

### Task 3: Scan MDX files

- [ ] Implement `getMdxDocsPages()` by scanning `apps/docs/content/docs/**/*.mdx`.
- [ ] Derive slugs from file paths:
  - `getting-started.mdx` -> `/getting-started`
  - `guides/perf.mdx` -> `/guides/perf`
  - `react/api.mdx` -> `/react/api`
  - `react/guides/ssr-and-fallbacks.mdx` -> `/react/guides/ssr-and-fallbacks`
  - `reference/matter.mdx` -> `/reference/matter`
- [ ] Sort pages within a section by `order`, then `title`.
- [ ] Cache filesystem reads with React/server cache or a simple module-level memo where appropriate.

### Task 4: Extract headings

- [ ] Implement heading extraction from MDX source using a structured parser or MDX-aware utility.
- [ ] Include only `h2` and `h3` in the sidebar TOC by default.
- [ ] Generate stable ids with `github-slugger`.
- [ ] Ensure headings inside code fences are ignored.

### Task 5: Build the nav config + derived helpers

- [ ] Author `nav.config.ts` matching the structure in "Information Architecture > Nav config shape".
- [ ] Implement `getDocsPage(slugs: string[])`.
- [ ] Implement `getDocsStaticParams()`.
- [ ] Implement `getDocsNavTree()` — walks `NAV` config, resolves `page`/`section`/`catalog` items into concrete `DocsPage` records, returns the rendered tree.
- [ ] Implement `getDocsBreadcrumbs(page)` — derives the breadcrumb trail from the nav tree, not URL segments alone (so labels match sidebar).
- [ ] Implement `getDocsPrevNext(page)` — flatten the nav tree in display order, return neighbors. Skip `hidden` pages.
- [ ] Implement `getDocsSearchDocuments()`.

**Verification:**

- [ ] Add a small diagnostics route or temporary log during development to inspect the page graph and resolved nav tree.
- [ ] Run `pnpm --filter @matter/docs typecheck`.
- [ ] Run `pnpm --filter @matter/docs build`.

---

## Phase 8.2 - Generic MDX Route

**Goal:** Render prose docs pages from the content source graph.

**Files:**

- Create: `apps/docs/src/app/(docs-content)/[...slug]/page.tsx`
- Create: `apps/docs/src/app/(docs-content)/layout.tsx`
- Create: `apps/docs/src/content/mdx.tsx`
- Fallback only: create `apps/docs/mdx-components.tsx` if Phase 8.0 chooses `@next/mdx`

### Task 1: Add catch-all page

- [ ] Implement `generateStaticParams()` from `getDocsStaticParams()`.
- [ ] Implement `generateMetadata()` from the page frontmatter.
- [ ] Resolve the requested slug with `getDocsPage()`.
- [ ] Call `notFound()` for unknown slugs.
- [ ] Render the MDX body with the approved renderer from Phase 8.0.

### Task 2: Add MDX component mapping

- [ ] Map standard markdown elements to Matter docs styles:
  - `h2`, `h3`
  - `p`
  - `a`
  - `ul`, `ol`, `li`
  - `code`, `pre`
  - `table`
- [ ] Expose a small custom component set:
  - `<Callout>`
  - `<Steps>`
  - `<CodeBlock>` or `<MdxCode>`
  - `<Cards>` only if immediately needed
- [ ] Do not expose arbitrary registry components yet.

### Task 3: Verify route priority

- [ ] Confirm `/getting-started`, `/cli`, `/changelog`, `/examples` render from MDX.
- [ ] Confirm `/guides/perf` and `/react/guides/three-r3f` render from MDX (deep paths).
- [ ] Confirm `/components/aurora` still renders the custom TSX component page.
- [ ] Confirm `/primitives/color-ramp` still renders the custom primitive page.
- [ ] Confirm `/recipes/plasma` still renders (existing route is left in place, just not navigated to).
- [ ] Confirm an unknown route returns Next's 404.

---

## Phase 8.3 - Docs Shell and Navigation

**Goal:** Make the generated content graph visible and useful. Visual polish stays minimal — user owns aesthetic via Figma.

**Files:**

- Create: `apps/docs/src/components/docs/DocsShell.tsx`
- Create: `apps/docs/src/components/docs/DocsSidebar.tsx`
- Create: `apps/docs/src/components/docs/Breadcrumbs.tsx`
- Create: `apps/docs/src/components/docs/TableOfContents.tsx`
- Create: `apps/docs/src/components/docs/PrevNext.tsx`
- Modify: `apps/docs/src/app/(docs-content)/layout.tsx`

### Task 1: Build the docs shell

- [ ] Add a two-column desktop layout: sidebar, article, optional TOC.
- [ ] Add a mobile nav treatment that does not crowd the existing top header.
- [ ] Keep the shell visually consistent with the existing docs app theme variables.
- [ ] Avoid generic docs-framework styling that fights Matter's eventual custom look — flag any non-obvious visual choices as "Figma will refine."

### Task 2: Sidebar (config-driven)

- [ ] Render nav from `getDocsNavTree()` (which walks `nav.config.ts`).
- [ ] Render the six top-level groups in config order: Overview, Components, Primitives, Guides, Frameworks, Reference.
- [ ] Render nested groups (e.g., Frameworks > React) with a one-level visual indent.
- [ ] Respect `hidden`.
- [ ] Highlight the active page.
- [ ] Keep ordering deterministic.
- [ ] Ensure long labels wrap cleanly on narrow widths.

### Task 3: Breadcrumbs and prev/next

- [ ] Render breadcrumbs from the nav tree (so labels match sidebar, not raw URL segments).
- [ ] Render previous/next links from the flattened nav order.
- [ ] Do not include hidden pages in prev/next.
- [ ] Do not cross group boundaries with prev/next unless adjacent in nav order.

### Task 4: Table of contents

- [ ] Render `h2` and `h3` headings.
- [ ] Link to stable heading ids.
- [ ] Keep the TOC hidden or collapsed on mobile.
- [ ] Verify heading links scroll to the correct anchor.

---

## Phase 8.4 - Initial Prose Content

**Goal:** Create the first MDX pages that validate the system and match the locked IA.

**Files:**

- Create: `apps/docs/content/docs/getting-started.mdx`
- Create: `apps/docs/content/docs/cli.mdx`
- Create: `apps/docs/content/docs/changelog.mdx`
- Create: `apps/docs/content/docs/examples.mdx`
- Create: `apps/docs/content/docs/guides/animation.mdx`
- Create: `apps/docs/content/docs/guides/perf.mdx`
- Create: `apps/docs/content/docs/guides/shared-scenes.mdx`
- Create: `apps/docs/content/docs/react/api.mdx`
- Create: `apps/docs/content/docs/react/guides/ssr-and-fallbacks.mdx`
- Create: `apps/docs/content/docs/react/guides/three-r3f.mdx`
- Create: `apps/docs/content/docs/reference/matter.mdx`

### Task 1: Write useful first-pass content

- [ ] **`/getting-started`** — install (`pnpm add @lovo/matter @lovo/matter-react`), initialize, add first component, wrap with `<MatterScene>`. React-shaped in v1, framework switcher deferred.
- [ ] **`/cli`** — `npx @lovo/matter-cli add <name>` usage, registry-source explanation, what gets copied.
- [ ] **`/changelog`** — first-pass content sources the engine package CHANGELOG.md (changesets workflow already in place). Cross-package aggregation is future work; for M8 a single-page summary is fine.
- [ ] **`/examples`** — stub page with a short intro and a placeholder for curated examples. The intent is that this page grows post-launch with hand-picked combinations.
- [ ] **`/guides/animation`** — signal-shaped props and MotionValue-compatible mental model (framework-agnostic).
- [ ] **`/guides/perf`** — pause-when-offscreen, DPR clamping, reduced motion, static render cases.
- [ ] **`/guides/shared-scenes`** — when to use one `<MatterScene>` with multiple components.
- [ ] **`/react/api`** — `@lovo/matter-react` exports: `<MatterScene>`, `useShaderMaterial`, hooks. Hand-written for M8; TypeDoc/API Extractor deferred.
- [ ] **`/react/guides/ssr-and-fallbacks`** — client-only WebGPU, fallbacks, `next/dynamic` patterns.
- [ ] **`/react/guides/three-r3f`** — Mode 2 escape hatch for users who own a Three/r3f scene.
- [ ] **`/reference/matter`** — engine API index pointing to package surfaces (TSL re-exports, primitives, runtime utilities, input source classes). Hand-written for M8.

### Task 2: Keep the prose honest

- [ ] Every code sample should match the current public packages and registry delivery model.
- [ ] Do not claim Vue/Svelte support is shipped.
- [ ] Do not claim a hosted registry endpoint exists.
- [ ] Mention WebGPU/TSL dependency clearly without making the getting-started path feel scary.
- [ ] Do not reference recipes in any MDX page (deferred from launch).

### Task 3: Use MDX features intentionally

- [ ] Use `<Callout>` for warnings around SSR/WebGPU support.
- [ ] Use `<Steps>` on getting started and CLI pages.
- [ ] Use code blocks for install and component usage.
- [ ] Avoid embedding live demos until the MDX component allow-list is designed.

---

## Phase 8.5 - Catalog Graph Integration

**Goal:** Bring custom TSX pages into the same nav/search model as MDX pages without rewriting them as MDX.

**Files:**

- Create: `apps/docs/src/content/catalog.ts`
- Create: `apps/docs/src/app/components/page.tsx` (top-level catalog index — does not yet exist)
- Modify: `apps/docs/src/content/nav.ts` to resolve `catalog` items
- Modify: `apps/docs/src/content/search.ts`
- Optionally modify: `apps/docs/src/app/primitives/page.tsx` to use the shared shell

### Task 1: Define synthetic catalog records

- [ ] Add synthetic records for each Tier 1 component from `registry/registry.json` or the existing docs component list.
- [ ] Add synthetic records for `PRIMITIVES` from `apps/docs/src/data/primitives.ts`.
- [ ] Do **not** add synthetic records for recipes (deferred from launch).
- [ ] Keep synthetic records shaped similarly to MDX records where practical:
  - `title`
  - `description`
  - `url`
  - `section` (`'components'` or `'primitives'`)
  - `order`
  - `tags`

### Task 2: Resolve catalog items in nav

- [ ] In `nav.ts`, implement the `catalog` item kind: when encountered, pull records from `catalog.ts` filtered by `source: 'components' | 'primitives'` and inject as nav items.
- [ ] Ensure synthetic catalog records can coexist with MDX records in the sidebar.
- [ ] Verify the rendered nav matches the IA group order: Overview → Components → Primitives → Guides → Frameworks → Reference.

### Task 3: Build top-level catalog index pages

- [ ] Create `apps/docs/src/app/components/page.tsx` — a grid/list of all Tier 1 components, linking to `/components/[slug]`. Use the same docs shell so navigation works consistently.
- [ ] Confirm `apps/docs/src/app/primitives/page.tsx` (already exists) integrates with the shared shell — minor refactor if needed.
- [ ] Both index pages should be discoverable from the sidebar group headers.

### Task 4: Do not over-refactor custom pages

- [ ] Do not rewrite all component pages into one generic renderer in this milestone unless it falls out naturally.
- [ ] If touching custom pages, prefer adding shared shell/nav wrappers over changing demo internals.
- [ ] Preserve registry-source byte-identical code display behavior.

---

## Phase 8.6 - Search Foundation

**Goal:** Produce a search input from the same content graph. Full-text search can be lightweight now and upgraded later.

**Files:**

- Modify: `apps/docs/src/content/search.ts`
- Create or modify: `apps/docs/src/components/SearchBar.tsx`
- Optionally create: `apps/docs/src/app/api/search/route.ts`
- Optionally modify: `apps/docs/src/app/layout.tsx`

### Task 1: Build search documents

- [ ] Include MDX pages with:
  - title
  - description
  - URL
  - section
  - headings
  - tags
  - plaintext excerpt if easy to extract safely
- [ ] Include synthetic catalog pages (components, primitives) with:
  - title
  - description
  - URL
  - section
  - tags
- [ ] Do **not** include `/recipes/*` (deferred from launch).
- [ ] Keep the search document shape independent of the UI so Pagefind or another indexer can consume it later.

### Task 2: Choose first search implementation

Pick one:

- [ ] **Option A - Lightweight local search:** expose a JSON/API feed and filter title/description/headings client-side. Good enough while docs are small.
- [ ] **Option B - Pagefind now:** run Pagefind after production build and load its static index. Better full-text, closer to the original docs spec, but more build plumbing.

Recommended for this milestone: **Option A**. It proves the content graph and UI, and does not block later Pagefind integration.

### Task 3: Add search UI

- [ ] Add a compact search trigger to the header.
- [ ] Support keyboard-friendly results.
- [ ] Show page section and description in results.
- [ ] Avoid SaaS search dependencies.

---

## Phase 8.7 - Verification and Cleanup

**Goal:** Prove the content plumbing works end-to-end and leave clear notes for future docs work.

### Task 1: Route audit

- [ ] Visit or build-check:
  - `/`
  - `/getting-started`
  - `/cli`
  - `/changelog`
  - `/examples`
  - `/guides/animation`
  - `/guides/perf`
  - `/guides/shared-scenes`
  - `/react/api`
  - `/react/guides/ssr-and-fallbacks`
  - `/react/guides/three-r3f`
  - `/reference/matter`
  - `/components`
  - `/components/aurora`
  - `/primitives`
  - `/primitives/color-ramp`
- [ ] Verify unknown routes return 404.
- [ ] Verify `/recipes/*` still renders (left in place but not surfaced).

### Task 2: Quality checks

- [ ] `pnpm --filter @matter/docs typecheck`
- [ ] `pnpm --filter @matter/docs build`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`

If a full root check is expensive, at minimum run docs typecheck/build and record what was skipped.

### Task 3: Visual sanity

- [ ] Start the docs dev server.
- [ ] Open the prose docs route in the browser.
- [ ] Check desktop and mobile widths.
- [ ] Confirm sidebar, TOC, breadcrumbs, and prev/next do not overlap content.
- [ ] Confirm custom component pages still render their WebGPU demos.
- [ ] Confirm the IA group order matches: Overview → Components → Primitives → Guides → Frameworks → Reference.

### Task 4: Documentation note

- [ ] Add a short note to this plan or a docs development note explaining how to add a new MDX page:
  1. create `apps/docs/content/docs/<path>.mdx`
  2. add frontmatter with the right `section`
  3. confirm the page appears under the expected sidebar group (and adjust `nav.config.ts` if a new section is being introduced)
  4. run docs build/typecheck
  5. verify nav/search

### Task 5: Capture future Figma integration points

- [ ] Add a short "Figma integration TODOs" note listing visual decisions deferred during M8 (sidebar styling, breadcrumb separator, TOC affordance, search trigger placement). This gives the Figma pass a punchlist rather than re-deriving it.

---

## Acceptance Criteria

- [ ] Prose docs are authored as MDX files outside `app/`.
- [ ] Frontmatter is validated with clear errors.
- [ ] `/getting-started`, `/cli`, `/changelog`, `/examples`, `/guides/*`, `/react/*`, and `/reference/*` render from MDX.
- [ ] Sidebar, breadcrumbs, TOC, and prev/next are derived from the content graph + `nav.config.ts`.
- [ ] Sidebar groups render in order: Overview → Components → Primitives → Guides → Frameworks → Reference.
- [ ] Custom interactive pages (`/components/[slug]`, `/primitives/[slug]`) continue to render normally.
- [ ] Components and primitives appear in the shared nav/search graph as synthetic records.
- [ ] Top-level `/components` and `/primitives` index pages exist and use the shared docs shell.
- [ ] Recipes are NOT surfaced in nav, sidebar, or search (existing `/recipes/*` routes still resolve).
- [ ] Search has at least metadata/headings coverage, with no SaaS dependency.
- [ ] Adding a new MDX page is documented and requires no component code changes.
- [ ] Adding a future framework (e.g., Vue) is a config edit in `nav.config.ts` plus new MDX, not a refactor.
- [ ] The implementation does not introduce Fumadocs.
- [ ] The docs app builds successfully.

---

## Future Work After M8

- Surface recipes again post-launch (re-enable `/recipes/*` in nav/search; consider whether the catalog model evolves).
- Generate props tables from component metadata or TypeScript declarations.
- Generate package API reference from TypeDoc/API Extractor (replaces hand-written `/react/api` and `/reference/matter`).
- Upgrade lightweight search to Pagefind full-text indexing.
- Allow a small set of live shader demos inside MDX after designing SSR-safe wrappers.
- Add related-docs links from shared tags and primitive/component relationships.
- Cross-package changelog aggregation (M8 ships a single-page summary sourced from engine CHANGELOG.md).
- Vue / Svelte framework hubs — add `/vue/*`, `/svelte/*` under the existing Frameworks group when bindings ship.
- Consider versioned docs only after the package has meaningful public releases.
- Apply the Figma design pass — chrome, type scale, spacing, hero, sidebar treatment.
