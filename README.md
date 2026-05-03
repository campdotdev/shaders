# Matter

React shader components powered by WebGPU and Three.js TSL.

> **Status:** Pre-release — Milestones 0 and 1 complete. `<LinearGradient>` runs end-to-end with WebGPU + Three.js TSL. v1 catalog under active development. Not yet published to npm.

## What is Matter?

Matter is a React component library for shader-driven backgrounds and interactive surfaces. It ships polished drop-in components like `<LinearGradient>`, `<Aurora>`, and `<DotField>` for developers who don't want to write shaders, alongside a primitives library and recipe gallery for those who do.

The full design is in [`docs/superpowers/specs/2026-05-02-matter-design.md`](./docs/superpowers/specs/2026-05-02-matter-design.md).

## Repository structure

```
apps/
├── docs/           # @matter/docs — Next.js docs site (Tweakpane-driven demos)
└── playground/     # @matter/playground — Vite app with M1 manual harnesses

packages/
├── matter/         # @lovo/matter — engine: TSL primitives, renderer, scheduler
├── matter-react/   # @lovo/matter-react — React binding
└── matter-cli/     # @lovo/matter-cli — copy-paste CLI

registry/           # @matter/registry — Tier 1 component source files (CLI consumes)

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
pnpm build       # build all packages + apps
pnpm typecheck   # typecheck all packages + apps
pnpm lint        # lint all packages + apps
pnpm test        # run all tests (Vitest in @lovo/matter)

# Live shader demo
pnpm --filter @matter/docs dev        # Next.js docs at http://localhost:3000

# Engine playground (per-phase manual harnesses)
pnpm --filter @matter/playground dev  # Vite at http://localhost:5173
```

## Roadmap

- ✅ **Milestone 0** — Repo bootstrap
- ✅ **Milestone 1** — Vertical slice: `<LinearGradient>` end-to-end (engine, React binding, registry component, Tweakpane-driven docs page)
- ⏳ **Milestone 2** — `@lovo/matter-cli` (copy-paste delivery)
- **Milestone 3** — The other 5 v1 components (MeshGradient, Aurora, DotField, NoiseField, Waves)
- **Milestone 4** — Docs site polish
- **Milestone 5** — Performance, testing, accessibility
- **Milestone 6** — v0.1.0 publish

## License

MIT — see [`LICENSE`](./LICENSE).
