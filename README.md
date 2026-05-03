# Matter

React shader components powered by WebGPU and Three.js TSL.

> **Status:** Pre-release — Milestone 0 (repo bootstrap) complete. v1 catalog and tooling under active development. Not yet published to npm.

## What is Matter?

Matter is a React component library for shader-driven backgrounds and interactive surfaces. It ships polished drop-in components like `<LinearGradient>`, `<Aurora>`, and `<DotField>` for developers who don't want to write shaders, alongside a primitives library and recipe gallery for those who do.

The full design is in [`docs/superpowers/specs/2026-05-02-matter-design.md`](./docs/superpowers/specs/2026-05-02-matter-design.md).

## Repository structure

```
packages/
├── matter/         # @lovo/matter — engine: TSL primitives, renderer, scheduler
├── matter-react/   # @lovo/matter-react — React binding
└── matter-cli/     # @lovo/matter-cli — copy-paste CLI

tooling/
├── eslint-config/  # shared ESLint flat config
└── tsconfig/       # shared TypeScript configs

docs/
└── superpowers/
    ├── specs/      # design documents
    └── plans/      # implementation plans
```

## Development

Requires Node 22+ and pnpm 9+.

```bash
pnpm install
pnpm build       # build all packages
pnpm typecheck   # typecheck all packages
pnpm lint        # lint all packages
pnpm test        # run all tests (none yet — coming in M1+)
```

## Roadmap

- ✅ **Milestone 0** — Repo bootstrap (this milestone)
- ⏳ **Milestone 1** — Vertical slice: `<LinearGradient>` end-to-end
- **Milestone 2** — `@lovo/matter-cli` (copy-paste delivery)
- **Milestone 3** — The other 5 v1 components (MeshGradient, Aurora, DotField, NoiseField, Waves)
- **Milestone 4** — Docs site polish
- **Milestone 5** — Performance, testing, accessibility
- **Milestone 6** — v0.1.0 publish

## License

MIT — see [`LICENSE`](./LICENSE).
