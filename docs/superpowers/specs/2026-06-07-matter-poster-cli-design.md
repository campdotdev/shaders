# Matter poster CLI — design

Date: 2026-06-07
Status: Approved (pending implementation plan)

## 1. Goal

Add a `matter poster` command to `@lovo/matter-cli` that produces a static PNG of a Matter component tree (with the user's actual props and composition) so it can be used as `<ShaderScene fallback={...}>`. The PNG fills the first-paint window between mount and WebGPU-renderer-ready, eliminating the visible blank canvas while the GPU pipeline initializes.

The source of truth is the user's own `.tsx` file. Pointing at the file means props, composition (stacked overlays like `<Grain>` on top of `<LinearGradient>`), and any local shader edits are all reflected automatically.

## 2. Non-goals (v1)

- Not auto-wired into the component; CLI writes the PNG and prints a wiring snippet for the user to paste.
- Not bundled into `matter add`; `poster` is a separate, opt-in command.
- No hosted render endpoint; the command runs entirely on the user's machine.
- No animated posters (APNG/WebM); PNG only.
- No CSS-equivalent fallback components (that path is v2; see the matter design spec §5.2).
- No registry-canonical render path. Posters always come from a user-owned file. (Users who haven't created a component file yet copy one in via `matter add` first.)
- No support for components that depend on app-context hooks (`useTheme`, `useRouter`, etc.). Documented constraint: extract a presentational child to point at.

## 3. CLI surface

```
matter poster --from <file> --out <path> [options]

Required:
  --from <file>           Path to a .tsx/.ts file. The chosen export must be a
                          React component that renders the full tree to capture,
                          including <ShaderScene> at the root.
  --out <path>            Path where the PNG will be written. Parent directories
                          are auto-created (consistent with `add`).

Optional:
  --export <name>         Named export to render. Default: "default".
  --time <seconds>        Wait this long after the first non-blank frame before
                          snapshotting. Default: 0 (snapshot the first non-blank
                          frame). Useful for slow-developing shaders (aurora).
  --width <px>            Render width.  Default: 1280.
  --height <px>           Render height. Default: 720.
```

### Success output

```
Wrote poster: ./public/hero.png (1280×720, 142 KB)

Wire it up inside ./components/matter/hero.tsx:
  <ShaderScene fallback={<img src="/hero.png" alt="" />}>
    ...
  </ShaderScene>
```

### Example invocations

```bash
# Single component, default export
matter poster --from ./components/matter/hero.tsx --out ./public/hero.png

# Named export, custom dimensions, slower-developing shader
matter poster \
  --from ./components/matter/aurora-hero.tsx \
  --export AuroraHero \
  --out ./public/aurora.png \
  --width 1920 --height 1080 \
  --time 3.0
```

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ matter-cli process (commands/poster.ts)                          │
│                                                                  │
│  1. Validate flags; resolve --from to absolute path.             │
│  2. Walk up to find user's package.json → projectRoot.           │
│  3. Check Playwright is installed in user's project; if not,     │
│     exit 1 with install hint.                                    │
│  4. esbuild.build({                                              │
│       entryPoints: [<bundled harness shell>],                    │
│       define: {                                                  │
│         __MATTER_USER_MODULE_PATH: <absolute --from>,            │
│         __MATTER_EXPORT_NAME: <--export or "default">            │
│       },                                                         │
│       resolveDir: projectRoot,                                   │
│       bundle: true, format: 'esm', platform: 'browser',          │
│       jsx: 'automatic',                                          │
│       loader: { '.tsx': 'tsx', '.ts': 'ts' },                    │
│       write: false                                               │
│     })                                                           │
│     → in-memory ESM bundle (react, three/webgpu, matter,         │
│       and the user's component all resolved from THEIR           │
│       node_modules — single copy of three guaranteed).           │
│  5. Start ephemeral HTTP server on 127.0.0.1:<random>.           │
│     Serves: /index.html, /harness.js, /config.json               │
│  6. Launch Playwright Chromium (headless, WebGPU enabled).       │
│  7. page.setViewportSize({ width, height }).                     │
│  8. page.goto(http://127.0.0.1:<port>/).                         │
│  9. page.waitForFunction(() => window.__matterReady, timeout 10s)│
│ 10. If --time N: await sleep(N * 1000).                          │
│ 11. canvas = page.locator('canvas').first()                      │
│     buffer = await canvas.screenshot({ type: 'png' })            │
│ 12. fs.writeFile(--out, buffer)                                  │
│ 13. Close browser; close HTTP server.                            │
│ 14. Print snippet (see §3).                                      │
└──────────────────────────────────────────────────────────────────┘
```

### Harness shell

Lives at `packages/matter-cli/src/harness/index.tsx`. esbuild compiles it as the entry point, substituting the `__MATTER_USER_MODULE_PATH` and `__MATTER_EXPORT_NAME` defines.

```tsx
// Pseudocode — actual implementation handles default vs named export
import { createRoot } from 'react-dom/client'
import * as UserModule from '__MATTER_USER_MODULE_PATH'

const Component = UserModule[__MATTER_EXPORT_NAME]

const root = createRoot(document.getElementById('root')!)
root.render(<Component />)

// Frame-ready watcher — see §5
```

The harness HTML is a minimal shell:

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>matter poster</title>
<style>html,body,#root{margin:0;height:100%;background:#000}</style>
</head><body><div id="root"></div><script type="module" src="/harness.js"></script></body></html>
```

### Resolution rule

`esbuild`'s `resolveDir` is set to the user's project root. Every import — `react`, `three/webgpu`, `@lovo/matter`, `@lovo/matter-react`, and the user's component file — resolves against the user's `node_modules`. This guarantees a single copy of `three` in the bundle (gotcha #13 in CLAUDE.md) and uses whatever versions the user has actually installed.

## 5. Frame-ready detection

The harness signals readiness via `window.__matterReady`. Algorithm:

1. After React renders, locate the `<canvas>` element under `#root`.
2. Subscribe to `requestAnimationFrame`; on each tick:
   a. Sample a 4×4 region from the center of the canvas. Implementation should be backend-agnostic (works for both WebGL2 and WebGPU contexts) — the exact API (`readPixels`, `copyExternalImageToTexture` → readback, `canvas.toBlob`, etc.) is a plan-level decision; the contract is "obtain RGB values from a small region of the current canvas".
   b. Consider the frame "non-blank" if any RGB channel of any pixel is > 2 (small noise floor to ignore precision artifacts).
3. On first non-blank frame, set `window.__matterReady = true`.
4. If `--time N` was requested, the CLI sleeps N seconds *after* `__matterReady` flips (not from page load) — this gives consistent "post-init evolution" timing regardless of how long WebGPU init takes.

### Edge cases

- **Subtractive overlays alone** (e.g., grain with no base in subtractive mode) will render full black indefinitely. The 10-second `waitForFunction` timeout catches this and exits 1 with a hint: `"no canvas content detected within 10s; does your component render a ShaderScene with a visible base layer?"`
- **Components that render briefly visible then re-blank** (transitions, async asset loads): out of scope. We snapshot the first non-blank frame regardless.
- **WebGPU vs WebGL2 backend selection**: TSL auto-falls-back. The frame-ready helper detects which context the canvas has and reads pixels accordingly.

## 6. Error handling

Missing parent directories for `--out` are auto-created silently (consistent with `add`); not a failure mode. Real failures all exit 1:

| Failure                                                | Behavior                                                                                                              |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `--from` file missing                                  | `--from <path>: file not found`                                                                                       |
| `--export <name>` not found in module                  | Lists available exports                                                                                               |
| esbuild fails (TS error, unresolved import)            | Surfaces esbuild's diagnostic verbatim                                                                                |
| Playwright not installed in user's project             | `Install playwright to use this command: pnpm add -D playwright && pnpm exec playwright install chromium`             |
| WebGPU + WebGL2 both unavailable in Chromium           | Dumps Playwright's GPU info                                                                                           |
| Component throws on render (hook context, etc.)        | Captures page-side console error + stack; hint about app-context hooks (see §2)                                       |
| Frame-ready times out (10s)                            | `no canvas content detected within 10s; does your component render a ShaderScene with a visible base layer?`          |
| `--width`/`--height` non-positive or > 4096            | `--width/--height must be a positive integer ≤ 4096`                                                                  |

## 7. Packaging and dependencies

### Runtime deps added to `@lovo/matter-cli`

- `esbuild` — needed for on-demand bundling of the user's component file. ~10MB installed. Added to `dependencies`.

### Optional peer dep added to `@lovo/matter-cli`

- `playwright` — required only for the `poster` command. Declared as:
  ```json
  "peerDependencies": { "playwright": "*" },
  "peerDependenciesMeta": { "playwright": { "optional": true } }
  ```
  The `poster` command checks `require.resolve('playwright', { paths: [projectRoot] })` at startup; missing → exit 1 with the install hint above. Other commands (`add`, `init`, `list`, `update`) do not import Playwright.

### What ships in the CLI bundle

The harness shell source (`src/harness/index.tsx`) and HTML template ship as **source**, not pre-bundled. The user's project provides `react`, `react-dom`, `three`, `@lovo/matter*`; esbuild bundles them on demand at poster time. This is what keeps the CLI installed-size small and what avoids the two-copies-of-three trap.

## 8. Testing strategy

Three layers, mirroring the existing CLI test patterns:

1. **Unit (vitest)** — flag parsing, error message formatting, snippet rendering. No filesystem, no browser, no esbuild. Located in `packages/matter-cli/src/commands/poster.test.ts`.

2. **Integration (vitest + node http + esbuild)** — fixture `.tsx` files in `packages/matter-cli/src/test-fixtures/posters/` are bundled by the real esbuild path; the ephemeral HTTP server boots and serves the expected routes. Playwright is mocked at this layer (we test orchestration, not browser behavior).

3. **End-to-end (vitest, env-gated)** — gated behind `MATTER_E2E=1`. One test per representative fixture:
   - `single-linear-gradient.tsx` — minimal case
   - `gradient-plus-grain.tsx` — composition with overlay
   - `aurora-with-time.tsx` — exercises `--time` flag

   Each runs the full path (esbuild → http server → real Playwright → PNG written). Asserts: PNG file exists, dimensions match `--width`/`--height`, file size is non-trivial (> 1KB) and below a sanity cap (< 5MB at 1280×720). **No pixel-level visual regression** — that's covered by the M5 docs-site Playwright suite. Here we only assert "the pipeline produced a real PNG".

Fixtures import directly from the workspace `@lovo/matter-react`, which exercises the user-file-resolution path end-to-end against real dependencies.

## 9. Out of scope (v1, reaffirmed)

- Animated posters (APNG/WebM/MP4)
- WebP/JPG output
- Cursor position flag (`--cursor`); defaults to center
- Multiple presets per component in one command (script your shell)
- Auto-regen on prop change (CI hook, file watcher)
- Pixel-level visual regression for the poster pipeline itself
- Capturing the user's surrounding page DOM (just the canvas)

## 10. Decisions log

Captured here so the rationale survives.

| #   | Decision                                                                | Rationale                                                                                                                          |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Standalone command (`matter poster`), not folded into `add`             | `add` stays fast and offline; posters are an opt-in step                                                                           |
| 2   | Local Playwright as optional peer dep (not hosted endpoint)             | OSS project; no infra to host; no per-screenshot costs; works offline                                                              |
| 3   | Render user's file (not registry canonical + JSON props)                | Source of truth is the user's JSX; composition is free; no per-component schema to maintain                                        |
| 4   | esbuild + user's `node_modules` resolution                              | Guarantees single copy of `three` (CLAUDE.md gotcha #13); reflects exactly what the user shipped                                   |
| 5   | First non-blank frame by default, `--time N` for later                  | Skips the WebGPU init blank flash automatically; deterministic across hardware                                                     |
| 6   | 4×4 pixel sample (not 1×1)                                              | Avoids false negatives on shaders that legitimately render a black center pixel                                                    |
| 7   | Required `--out`, no default                                            | No assumptions about framework conventions; explicit is better than magic                                                          |
| 8   | Manual wiring (CLI prints snippet)                                      | Respects the copy-paste philosophy; user owns the component file                                                                   |
| 9   | PNG only in v1                                                          | Broadest browser support; lossless; format flag adds complexity for marginal benefit                                               |
| 10  | 1280×720 default                                                        | Matches common hero/section use cases; overridable                                                                                 |
| 11  | 10s frame-ready timeout                                                 | Generous enough for slow hardware + first WebGPU compile; short enough to surface real failures fast                               |
