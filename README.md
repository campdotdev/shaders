# Shaders

React shader components powered by WebGPU and Three.js TSL.

## What is Shaders?

Shaders is a React component library for shader-driven backgrounds and interactive surfaces. It ships drop-in components like `<LinearGradient>`, `<Aurora>`, and `<DotField>` for developers who don't want to write shaders, alongside the TSL primitives they are built from for those who do.

```bash
pnpm add @camp-dev/shaders three
```

```tsx
import { LinearGradient, ShaderScene } from '@camp-dev/shaders'

export function Hero() {
  return (
    <ShaderScene style={{ height: '60vh' }}>
      <LinearGradient />
    </ShaderScene>
  )
}
```

## Repository structure

```
apps/
├── docs/           # @shaders/docs — Next.js docs site
├── docs-tests/     # @shaders/docs-tests — Playwright visual and a11y suites
└── editor/         # @shaders/editor — node editor over the same primitives

packages/
├── shaders/        # @camp-dev/shaders — components, React binding, TSL primitives, renderer
└── shaders-cli/    # @camp-dev/shaders-cli — the poster command

tooling/
└── tsconfig/       # shared TypeScript configs
```

## Development

Requires Node 22 and pnpm 10. `.node-version` pins the exact Node release, and every `pnpm` script runs under it.

```bash
pnpm install
pnpm build       # build all packages and apps
pnpm typecheck
pnpm lint
pnpm test        # Vitest across the workspace

pnpm dev:docs    # docs site at http://localhost:3000
pnpm dev:editor  # node editor at http://localhost:3005
```

## Releasing

Releases go through [Changesets](https://github.com/changesets/changesets). Add a changeset with `pnpm changeset` in the PR that makes the change. Merging to `main` opens or updates a "chore: version packages" PR, and merging that PR publishes both packages to npm and tags the release.

## License

MIT — see [`LICENSE`](./LICENSE).
