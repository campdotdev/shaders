# Matter - Milestone 8: MDX content plumbing - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. If multiple workers are available, `superpowers:subagent-driven-development` is appropriate after Phase 8.1 because the content source, shell UI, and migrated MDX pages can be split into mostly independent work streams. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Matter's docs experience custom while replacing ad-hoc docs plumbing with a small, typed MDX content system. The docs site should support prose pages at `/getting-started`, `/guides/*`, and `/reference`, while preserving bespoke interactive pages for `/components/[slug]`, `/primitives/[slug]`, and `/recipes/[slug]`. End state: adding a prose docs page is mostly "create an MDX file with frontmatter"; navigation, breadcrumbs, TOC, prev/next links, metadata, and search input are derived from the content graph.

**Architecture:** This milestone deliberately does **not** adopt Fumadocs. Instead, it builds the useful subset Matter needs: a filesystem-backed MDX source layer, validated frontmatter, heading extraction, nav tree generation, route metadata, previous/next links, and a search document feed. The visual shell stays Matter-specific. The custom shader pages stay TSX-first and can opt into the same nav/search graph as synthetic pages.

**Decision:** Prefer a local-trusted MDX renderer (`next-mdx-remote/rsc`) for prose pages instead of `@next/mdx` file-routing. Rationale: the content graph can be built directly from the filesystem without generating static import maps, frontmatter can be parsed before rendering, and the catch-all docs route can stay data-driven. If Phase 8.0 proves this path awkward with React Server Components or MDX component mapping, fall back to `@next/mdx` plus a generated import map.

---

## Critical Context - Read This First

### Experience stays custom

Matter docs are not a generic markdown site. Component pages lead with live WebGPU demos, controls, registry source, and copy-paste workflows. This milestone should not turn `/components/[slug]` into MDX-first pages.

The intended split:

| Surface | Primary source | Notes |
| --- | --- | --- |
| `/`, `/components/[slug]`, `/primitives/[slug]`, `/recipes/[slug]` | TSX + typed catalog data | Custom interactive experience |
| `/getting-started`, `/guides/*`, `/reference` | MDX + frontmatter | Prose docs with custom MDX components |
| Sidebar/search graph | Combined source graph | MDX pages + synthetic catalog pages |

### Do not rebuild all of Fumadocs

Build only the pieces Matter needs now:

- page discovery
- frontmatter validation
- route metadata
- sidebar grouping and ordering
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

MDX pages can use small docs components (`<Callout>`, `<Steps>`, `<Tabs>`, `<CodeBlock>`), but should avoid importing registry components directly in MDX during this milestone. If a prose guide needs a live shader, expose a narrow allow-listed component from `_content/mdx.tsx` rather than allowing arbitrary imports.

### Route conflict warning

The generic MDX route will be a root-level catch-all. It must return `notFound()` for unknown slugs and coexist with existing specific routes:

- `/components/[slug]`
- `/primitives/[slug]`
- `/recipes/[slug]`
- `/dev/*`

Next should prioritize specific routes over catch-all routes, but verify this explicitly in Phase 8.2.

---

## Dependency Graph

| Phase | Depends on | Ships |
| --- | --- | --- |
| **8.0 - MDX renderer spike** | Current docs app | Confirms `next-mdx-remote/rsc` path or selects fallback |
| **8.1 - Content source layer** | 8.0 | Typed page graph, frontmatter schema, TOC extraction |
| **8.2 - Generic MDX route** | 8.1 | `/getting-started`, `/guides/*`, `/reference` renderer |
| **8.3 - Docs shell/navigation** | 8.1, 8.2 | Sidebar, breadcrumbs, TOC, prev/next |
| **8.4 - Initial prose content** | 8.2, 8.3 | First MDX docs pages from spec section 7.1 |
| **8.5 - Catalog graph integration** | 8.1, current custom pages | Components/primitives/recipes appear in shared nav/search graph |
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
│       ├── guides/
│       │   ├── animation.mdx
│       │   ├── perf.mdx
│       │   ├── shared-scenes.mdx
│       │   ├── ssr-and-fallbacks.mdx
│       │   └── three-r3f.mdx
│       └── reference/
│           └── index.mdx
├── app/
│   ├── (docs-content)/
│   │   ├── [...slug]/page.tsx
│   │   └── layout.tsx
│   ├── _content/
│   │   ├── catalog.ts
│   │   ├── mdx.tsx
│   │   ├── nav.ts
│   │   ├── schema.ts
│   │   ├── search.ts
│   │   ├── source.ts
│   │   ├── toc.ts
│   │   └── types.ts
│   ├── _components/
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
└── package.json
```

Exact paths can shift if the existing docs app has a stronger convention by implementation time, but keep the separation clear:

- `_content/` = data/source utilities
- `_components/docs/` = reusable docs chrome
- `content/docs/` = author-authored MDX
- `(docs-content)/[...slug]` = generic prose renderer

---

## Frontmatter Contract

Every MDX docs page should start with YAML frontmatter:

```mdx
---
title: Performance
description: Pause behavior, DPR limits, and render-on-demand patterns.
section: Guides
order: 50
---

# Performance
```

Required fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `title` | string | Page title, metadata, sidebar fallback |
| `description` | string | SEO/search/card summary |
| `section` | enum | Sidebar grouping |
| `order` | number | Sort order within section |

Optional fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `navTitle` | string | Short sidebar label when title is long |
| `hidden` | boolean | Renderable but omitted from nav |
| `status` | `"draft" \| "ready"` | Lets drafts exist without ambiguity |
| `tags` | string[] | Search filtering and future related-docs |

Initial section enum:

```ts
type DocsSection = 'Start' | 'Guides' | 'Reference'
```

Catalog pages (`components`, `primitives`, `recipes`) are synthetic records and do not use MDX frontmatter.

---

## Phase 8.0 - MDX Renderer Spike

**Goal:** Prove the MDX rendering path before building the content graph around it.

**Files:**

- Temporarily create: `apps/docs/content/docs/_spike.mdx`
- Temporarily create or modify: `apps/docs/app/(docs-content)/_spike/page.tsx`
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

- Create: `apps/docs/app/_content/types.ts`
- Create: `apps/docs/app/_content/schema.ts`
- Create: `apps/docs/app/_content/source.ts`
- Create: `apps/docs/app/_content/toc.ts`
- Create: `apps/docs/app/_content/nav.ts`
- Create: `apps/docs/app/_content/search.ts`

### Task 1: Define page types

- [ ] Define `DocsFrontmatter`, `DocsPage`, `DocsHeading`, `DocsNavSection`, `DocsNavItem`, `DocsSearchDocument`.
- [ ] Keep URL construction centralized. No page should hand-concatenate slugs except inside `_content/source.ts`.
- [ ] Include `sourcePath` on page records for diagnostics, but do not expose local filesystem paths in the rendered UI.

### Task 2: Validate frontmatter

- [ ] Add a `zod` schema for frontmatter.
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
  - `reference/index.mdx` -> `/reference`
- [ ] Sort pages by `section`, then `order`, then `title`.
- [ ] Cache filesystem reads with React/server cache or a simple module-level memo where appropriate.

### Task 4: Extract headings

- [ ] Implement heading extraction from MDX source using a structured parser or MDX-aware utility.
- [ ] Include only `h2` and `h3` in the sidebar TOC by default.
- [ ] Generate stable ids with `github-slugger`.
- [ ] Ensure headings inside code fences are ignored.

### Task 5: Build derived helpers

- [ ] Implement `getDocsPage(slugs: string[])`.
- [ ] Implement `getDocsStaticParams()`.
- [ ] Implement `getDocsNavTree()`.
- [ ] Implement `getDocsBreadcrumbs(page)`.
- [ ] Implement `getDocsPrevNext(page)`.
- [ ] Implement `getDocsSearchDocuments()`.

**Verification:**

- [ ] Add a small diagnostics route or temporary log during development to inspect the page graph.
- [ ] Run `pnpm --filter @matter/docs typecheck`.
- [ ] Run `pnpm --filter @matter/docs build`.

---

## Phase 8.2 - Generic MDX Route

**Goal:** Render prose docs pages from the content source graph.

**Files:**

- Create: `apps/docs/app/(docs-content)/[...slug]/page.tsx`
- Create: `apps/docs/app/(docs-content)/layout.tsx`
- Create: `apps/docs/app/_content/mdx.tsx`
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

- [ ] Confirm `/getting-started` renders from MDX.
- [ ] Confirm `/components/aurora` still renders the custom TSX component page.
- [ ] Confirm `/primitives/color-ramp` still renders the custom primitive page.
- [ ] Confirm `/recipes/plasma` still renders the custom recipe page.
- [ ] Confirm an unknown route returns Next's 404.

---

## Phase 8.3 - Docs Shell and Navigation

**Goal:** Make the generated content graph visible and useful.

**Files:**

- Create: `apps/docs/app/_components/docs/DocsShell.tsx`
- Create: `apps/docs/app/_components/docs/DocsSidebar.tsx`
- Create: `apps/docs/app/_components/docs/Breadcrumbs.tsx`
- Create: `apps/docs/app/_components/docs/TableOfContents.tsx`
- Create: `apps/docs/app/_components/docs/PrevNext.tsx`
- Modify: `apps/docs/app/(docs-content)/layout.tsx`

### Task 1: Build the docs shell

- [ ] Add a two-column desktop layout: sidebar, article, optional TOC.
- [ ] Add a mobile nav treatment that does not crowd the existing top header.
- [ ] Keep the shell visually consistent with the existing docs app theme variables.
- [ ] Avoid generic docs-framework styling that fights Matter's eventual custom look.

### Task 2: Sidebar

- [ ] Render nav sections from `getDocsNavTree()`.
- [ ] Respect `hidden`.
- [ ] Highlight the active page.
- [ ] Keep ordering deterministic.
- [ ] Ensure long labels wrap cleanly on narrow widths.

### Task 3: Breadcrumbs and prev/next

- [ ] Render breadcrumbs from page URL segments and frontmatter.
- [ ] Render previous/next links from the sorted nav order.
- [ ] Do not include hidden pages in prev/next.

### Task 4: Table of contents

- [ ] Render `h2` and `h3` headings.
- [ ] Link to stable heading ids.
- [ ] Keep the TOC hidden or collapsed on mobile.
- [ ] Verify heading links scroll to the correct anchor.

---

## Phase 8.4 - Initial Prose Content

**Goal:** Create the first MDX pages that validate the system and match the approved docs IA.

**Files:**

- Create: `apps/docs/content/docs/getting-started.mdx`
- Create: `apps/docs/content/docs/guides/animation.mdx`
- Create: `apps/docs/content/docs/guides/perf.mdx`
- Create: `apps/docs/content/docs/guides/shared-scenes.mdx`
- Create: `apps/docs/content/docs/guides/ssr-and-fallbacks.mdx`
- Create: `apps/docs/content/docs/guides/three-r3f.mdx`
- Create: `apps/docs/content/docs/reference/index.mdx`

### Task 1: Write useful first-pass content

- [ ] `/getting-started`: install, initialize, add first component, wrap with `<MatterScene>`.
- [ ] `/guides/animation`: signal-shaped props and MotionValue-compatible mental model.
- [ ] `/guides/perf`: pause-when-offscreen, DPR clamping, reduced motion, static render cases.
- [ ] `/guides/shared-scenes`: when to use one `<MatterScene>` with multiple components.
- [ ] `/guides/ssr-and-fallbacks`: client-only WebGPU, fallbacks, Next dynamic import pattern.
- [ ] `/guides/three-r3f`: Mode 2 escape hatch for users who own a Three/r3f scene.
- [ ] `/reference`: index page that points to package APIs and catalog docs; full generated API extraction is deferred.

### Task 2: Keep the prose honest

- [ ] Every code sample should match the current public packages and registry delivery model.
- [ ] Do not claim Vue/Svelte support is shipped.
- [ ] Do not claim a hosted registry endpoint exists.
- [ ] Mention WebGPU/TSL dependency clearly without making the getting-started path feel scary.

### Task 3: Use MDX features intentionally

- [ ] Use `<Callout>` for warnings around SSR/WebGPU support.
- [ ] Use `<Steps>` on getting started.
- [ ] Use code blocks for install and component usage.
- [ ] Avoid embedding live demos until the MDX component allow-list is designed.

---

## Phase 8.5 - Catalog Graph Integration

**Goal:** Bring custom TSX pages into the same nav/search model as MDX pages without rewriting them as MDX.

**Files:**

- Create: `apps/docs/app/_content/catalog.ts`
- Modify: `apps/docs/app/_content/nav.ts`
- Modify: `apps/docs/app/_content/search.ts`
- Optionally modify: `apps/docs/app/page.tsx`
- Optionally modify: custom component/primitive/recipe index pages

### Task 1: Define synthetic catalog records

- [ ] Add synthetic records for each Tier 1 component from `registry/registry.json` or the existing docs component list.
- [ ] Add synthetic records for `PRIMITIVES`.
- [ ] Add synthetic records for `RECIPES`.
- [ ] Keep synthetic records shaped similarly to MDX records where practical:
  - `title`
  - `description`
  - `url`
  - `section`
  - `order`
  - `tags`

### Task 2: Merge catalog records into navigation

- [ ] Add top-level nav groups:
  - Start
  - Components
  - Primitives
  - Recipes
  - Guides
  - Reference
- [ ] Ensure MDX pages and synthetic pages can coexist in the same sidebar.
- [ ] Ensure the nav order matches Matter's learning path:
  1. Getting Started
  2. Components
  3. Primitives
  4. Recipes
  5. Guides
  6. Reference

### Task 3: Do not over-refactor custom pages

- [ ] Do not rewrite all component pages into one generic renderer in this milestone unless it falls out naturally.
- [ ] If touching custom pages, prefer adding shared shell/nav wrappers over changing demo internals.
- [ ] Preserve registry-source byte-identical code display behavior.

---

## Phase 8.6 - Search Foundation

**Goal:** Produce a search input from the same content graph. Full-text search can be lightweight now and upgraded later.

**Files:**

- Modify: `apps/docs/app/_content/search.ts`
- Create or modify: `apps/docs/app/_components/SearchBar.tsx`
- Optionally create: `apps/docs/app/api/search/route.ts`
- Optionally modify: `apps/docs/app/layout.tsx`

### Task 1: Build search documents

- [ ] Include MDX pages with:
  - title
  - description
  - URL
  - section
  - headings
  - tags
  - plaintext excerpt if easy to extract safely
- [ ] Include synthetic catalog pages with:
  - title
  - description
  - URL
  - section
  - tags
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
  - `/guides/animation`
  - `/guides/perf`
  - `/guides/shared-scenes`
  - `/guides/ssr-and-fallbacks`
  - `/guides/three-r3f`
  - `/reference`
  - `/components/aurora`
  - `/primitives/color-ramp`
  - `/recipes/plasma`
- [ ] Verify unknown routes return 404.

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

### Task 4: Documentation note

- [ ] Add a short note to this plan or a docs development note explaining how to add a new MDX page:
  1. create `apps/docs/content/docs/<path>.mdx`
  2. add frontmatter
  3. run docs build/typecheck
  4. verify nav/search

---

## Acceptance Criteria

- [ ] Prose docs are authored as MDX files outside `app/`.
- [ ] Frontmatter is validated with clear errors.
- [ ] `/getting-started`, `/guides/*`, and `/reference` render from MDX.
- [ ] Sidebar, breadcrumbs, TOC, and prev/next are derived from the content graph.
- [ ] Custom interactive pages continue to render normally.
- [ ] Components, primitives, and recipes appear in the shared nav/search graph as synthetic records.
- [ ] Search has at least metadata/headings coverage, with no SaaS dependency.
- [ ] The implementation does not introduce Fumadocs.
- [ ] The docs app builds successfully.

---

## Future Work After M8

- Generate props tables from component metadata or TypeScript declarations.
- Generate package API reference from TypeDoc/API Extractor.
- Upgrade lightweight search to Pagefind full-text indexing.
- Allow a small set of live shader demos inside MDX after designing SSR-safe wrappers.
- Add related-docs links from shared tags and primitive/component relationships.
- Consider versioned docs only after the package has meaningful public releases.
