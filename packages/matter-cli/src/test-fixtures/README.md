# Test fixtures

These files are consumed by `vitest` tests in this package. They mimic the
shape of `registry/registry.json` and a Tier 1 component, but exist
exclusively to exercise the CLI without requiring network access or a
checked-out remote.

- `registry/registry.json` — minimal registry manifest with one component
- `registry/synthetic-component.tsx` — tiny component source used to
  exercise import rewriting and add/update flows

The synthetic component imports from `@matter-internal/lib` — a deliberate
fake alias used by `transforms/rewriteImports.test.ts` to verify the
rewriter applies the user's `aliases` config.
