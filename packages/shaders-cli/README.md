# @camp-dev/shaders-cli

Dev-time CLI for **Shaders**. It has one command, `poster`, which renders a Shaders component tree to a static image so `<ShaderPoster>` has something to show while WebGPU starts up.

Components themselves ship in `@camp-dev/shaders`. Nothing here copies files into your project.

## Install

```bash
pnpm add -D @camp-dev/shaders-cli playwright
pnpm exec playwright install chromium
```

Requires Node 22 or later. Playwright is an optional peer dependency: the CLI drives the copy your project installs, so the poster renders with the same package versions your app uses.

## Render a poster

```bash
npx shaders-cli poster --source ./src/hero.tsx --output ./public/hero.jpg
```

The source file's chosen export must render the whole tree, including `<ShaderScene>`. The CLI bundles that file with esbuild against your project's `node_modules`, serves it to headless Chromium, waits for the first frame with content, and writes the screenshot. The animation clock is pinned to zero, so the same source produces the same image every run.

| Flag                        | Default    | What it does                                                                                                       |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `--source <file>`           | required   | A `.tsx` or `.ts` file whose export renders the full tree.                                                         |
| `--output <path>`           | required   | Where to write the image. The extension is optional; `--format` decides it. Parent directories are created.        |
| `--format <format>`         | `jpg`      | `png` or `jpg`.                                                                                                    |
| `--quality <n>`             | `80`       | JPEG quality from 1 to 100. Ignored for PNG.                                                                       |
| `--export-name <name>`      | `default`  | Which export of the source file to render.                                                                         |
| `--capture-delay <seconds>` | `0`        | How long to wait after the first frame with content before capturing.                                              |
| `--width <px>`              | `1280`     | Render width, up to 4096.                                                                                          |
| `--height <px>`             | `720`      | Render height, up to 4096.                                                                                         |
| `--device-scale-factor <n>` | `2`        | Capture device pixel ratio. The default matches the live renderer's cap, so posters stay crisp on retina displays. |
| `--background <color>`      | none       | A CSS color composited behind the shader before capture. Use it for shaders with a transparent base layer.         |

If no frame with content arrives within 10 seconds, the command fails with an error rather than writing a blank image.

### Pick a format

The default, JPEG at quality 80, suits most shaders. PNG wins on shaders with large flat regions, where lossless compression beats JPEG.

| Use `--format png` for                 | Use the default JPEG for             |
| -------------------------------------- | ------------------------------------ |
| `LinearGradient` with hard stops       | `Aurora` and other gradient-heavy scenes |
| `SimplexNoise` with contour bands      | `MeshGradient`                        |
| Anything with fewer than about 20 colors | `Grain` and other high-entropy noise |

If you are unsure, render both. The size difference runs several times in either direction.

### Wire it up

The command prints the `<ShaderPoster>` wrapper when it finishes, with the path filled in. Add the imports and it is ready to use:

```tsx
import { ShaderScene, LinearGradient } from '@camp-dev/shaders';
import { ShaderPoster } from '@camp-dev/shaders/poster';

<ShaderPoster poster={<img src="/hero.jpg" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}>
  <ShaderScene>
    <LinearGradient />
  </ShaderScene>
</ShaderPoster>
```

`@camp-dev/shaders/poster` imports no three.js, so a server-rendered page can put the poster in its initial HTML while the scene loads behind a dynamic import.

### Limitations

- The source export has to render the entire tree. The CLI does not wrap it in `<ShaderScene>` for you.
- Components that read app context, such as a theme or router hook, do not render in the headless harness. Extract a presentational child and point `--source` at that.
- WebP and AVIF output are not supported.

## Docs

<https://github.com/campdotdev/shaders>

## License

MIT. See [LICENSE](./LICENSE).
