# @lovo/matter-cli

shadcn-style copy-paste CLI for **Matter** — fetch polished shader components from the registry into your project, where they're yours to edit.

## Install

```bash
npm install -D @lovo/matter-cli
# or run ad-hoc: npx @lovo/matter-cli <command>
```

Requires Node 22+.

## Usage

### One-time setup

```bash
npx matter-cli init
```

Writes `matter.config.json` to your project root with sensible defaults:

```json
{
  "componentsDir": "src/components/matter",
  "registryUrl": "https://raw.githubusercontent.com/lovo-hq/matter/${ref}/registry",
  "aliases": { "@/": "src/" },
  "tsx": true
}
```

The `${ref}` placeholder is auto-substituted with the CLI's published version tag (e.g., `v0.1.0`), so you get a stable snapshot. Override with `--ref <tag|branch|sha>` if you want to track `main` or a specific commit.

### List available components

```bash
npx matter-cli list
```

### Copy a component into your project

```bash
npx matter-cli add linear-gradient
# or multiple at once:
npx matter-cli add linear-gradient aurora dot-field
```

The component lands in `componentsDir` (default `src/components/matter/`) — you own it from that point forward.

### Refresh a previously-added component

```bash
# Refresh one (errors if you have local edits):
npx matter-cli update linear-gradient

# Refresh all, overwriting local edits:
npx matter-cli update --force
```

### Render a static fallback image

Render a Matter component tree to a PNG for use as a `<ShaderScene fallback>` — eliminates the visible blank canvas during WebGPU initialization.

```bash
npx matter-cli poster --from <file> --out <path> [options]
```

| Flag               | Default    | Description                                                                                          |
| ------------------ | ---------- | ---------------------------------------------------------------------------------------------------- |
| `--from <file>`    | (required) | Path to a `.tsx`/`.ts` file whose chosen export renders the full tree (must include `<ShaderScene>`) |
| `--out <path>`     | (required) | Where to write the PNG. Parent directories are created automatically.                                |
| `--export <name>`  | `default`  | Named export to render.                                                                              |
| `--time <seconds>` | `0`        | Wait this long after the first non-blank frame before snapshotting.                                  |
| `--width <px>`     | `1280`     | Render width.                                                                                        |
| `--height <px>`    | `720`      | Render height.                                                                                       |

**Requires Playwright** as a peer dependency:

```bash
pnpm add -D playwright
pnpm exec playwright install chromium
```

**Example:**

```bash
npx matter-cli poster --from ./src/components/matter/hero.tsx --out ./public/hero.png
```

Wire it up:

```tsx
<ShaderScene fallback={<img src="/hero.png" alt="" />}>
  <LinearGradient ... />
</ShaderScene>
```

**Limitations:**

- The component you point at must render the entire tree (including `<ShaderScene>`); the CLI doesn't wrap.
- Components that depend on app-context hooks (`useTheme`, `useRouter`, etc.) won't render in the headless harness. Extract a presentational child.
- Output is always PNG (animated formats, JPG, WebP are out of scope for v1).

## v1 components

`linear-gradient`, `mesh-gradient`, `aurora`, `dot-field`, `simplex-noise`, `waves`.

Each component depends on `@lovo/matter` and `@lovo/matter-react`, which you install separately:

```bash
npm install @lovo/matter @lovo/matter-react three
```

## Docs

<https://github.com/lovo-hq/matter>

## License

MIT — see [LICENSE](./LICENSE).
