# @mattermix/shaders-cli

shadcn-style copy-paste CLI for **Matter** — fetch polished shader components from the registry into your project, where they're yours to edit.

## Install

```bash
npm install -D @mattermix/shaders-cli
# or run ad-hoc: npx @mattermix/shaders-cli <command>
```

Requires Node 22+.

## Usage

### One-time setup

```bash
npx shaders-cli init
```

Writes `shaders.config.json` to your project root with sensible defaults:

```json
{
  "componentsDir": "src/components/matter",
  "registryUrl": "https://raw.githubusercontent.com/mattermix/shaders/${ref}/registry",
  "aliases": { "@/": "src/" }
}
```

The `${ref}` placeholder is auto-substituted with the CLI's published version tag (e.g., `v0.1.0`), so you get a stable snapshot. Override with `--reference <tag|branch|sha>` if you want to track `main` or a specific commit.

### List available components

```bash
npx shaders-cli list
```

### Copy a component into your project

```bash
npx shaders-cli add linear-gradient
# or multiple at once:
npx shaders-cli add linear-gradient aurora dot-field
```

The component lands in `componentsDir` (default `src/components/matter/`) — you own it from that point forward.

### Refresh a previously-added component

```bash
# Refresh one (errors if you have local edits):
npx shaders-cli update linear-gradient

# Refresh all, overwriting local edits:
npx shaders-cli update --force
```

### Render a static fallback image

Render a Matter component tree to an image for use as the `poster` in `<ShaderPoster>` — eliminates the visible blank canvas during WebGPU initialization.

```bash
npx shaders-cli poster --source <file> --output <path> [options]
```

| Flag               | Default    | Description                                                                                          |
| ------------------ | ---------- | ---------------------------------------------------------------------------------------------------- |
| `--source <file>`           | (required) | Path to a `.tsx`/`.ts` file whose chosen export renders the full tree (must include `<ShaderScene>`) |
| `--output <path>`           | (required) | Where to write the image. Extension optional — `--format` decides. Parent directories auto-created.    |
| `--format <format>`         | `jpg`      | Output format: `png` or `jpg`. Default is `jpg` — best size/quality for most shaders.                |
| `--quality <n>`             | `80`       | JPEG quality 1–100. Ignored for PNG.                                                                 |
| `--export-name <name>`      | `default`  | Named export to render.                                                                              |
| `--capture-delay <seconds>` | `0`        | Wait this long after the first non-blank frame before snapshotting.                                  |
| `--width <px>`              | `1280`     | Render width.                                                                                        |
| `--height <px>`             | `720`      | Render height.                                                                                       |
| `--device-scale-factor <n>` | `2`        | Capture device pixel ratio. Default matches the live renderer's DPR cap for crisp posters on retina. |

#### Which format should I pick?

The default (JPEG q80) handles most shaders well. PNG wins on shaders with large flat-color regions where its lossless palette compression beats JPEG's DCT. As a rule of thumb:

| Use PNG (`--format png`) for…     | Use the default JPEG for…                  |
| --------------------------------- | ------------------------------------------ |
| `LinearGradient` with hard stops  | `Aurora` and similar gradient-heavy scenes |
| `SimplexNoise` with contour bands | `MeshGradient` (smooth color flow)         |
| Anything with < ~20 unique colors | `Grain` (high-entropy noise)           |

If unsure, run both — the difference can be 3–7× either direction.

**Requires Playwright** as a peer dependency:

```bash
pnpm add -D playwright
pnpm exec playwright install chromium
```

**Examples:**

```bash
# Default — writes ./public/hero.jpg (JPEG q80)
npx shaders-cli poster --source ./src/components/matter/hero.tsx --output ./public/hero.jpg

# Posterized shader — PNG compresses smaller
npx shaders-cli poster --source ./gradient.tsx --output ./public/gradient.png --format png

# Higher quality JPEG
npx shaders-cli poster --source ./aurora.tsx --output ./public/aurora.jpg --quality 92
```

Wire it up:

```tsx
import { ShaderPoster } from '@mattermix/shaders-react/poster';

<ShaderPoster poster={<img src="/hero.jpg" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}>
  <ShaderScene>
    <LinearGradient ... />
  </ShaderScene>
</ShaderPoster>
```

**Limitations:**

- The component you point at must render the entire tree (including `<ShaderScene>`); the CLI doesn't wrap.
- Components that depend on app-context hooks (`useTheme`, `useRouter`, etc.) won't render in the headless harness. Extract a presentational child.
- WebP and AVIF are not supported (would require an extra dependency for marginal savings over JPEG).

## v1 components

`linear-gradient`, `mesh-gradient`, `aurora`, `dot-field`, `simplex-noise`, `wave-lines`.

Each component depends on `@mattermix/shaders` and `@mattermix/shaders-react`, which you install separately:

```bash
npm install @mattermix/shaders @mattermix/shaders-react three
```

## Docs

<https://github.com/mattermix/shaders>

## License

MIT — see [LICENSE](./LICENSE).
