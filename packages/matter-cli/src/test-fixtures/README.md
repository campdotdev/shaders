# Test fixtures

These files are consumed by `vitest` tests in this package. They mimic the
shape of `registry/registry.json` and a Tier 1 component, but exist
exclusively to exercise the CLI without requiring network access or a
checked-out remote.

- `registry/registry.json` — minimal registry manifest
- `registry/synthetic-component.tsx` — tiny single-file component used to
  exercise import rewriting and add/update flows
- `registry/nested-component/` and `registry/sibling-component/` — two
  multi-file components mirroring the real registry's wrapper + shader split
- `registry/utils/color.ts` — shared helper both of them import, so tests can
  cover a file claimed by more than one component

The synthetic component is deliberately flat. The nested pair exists because
that flatness once hid a bug: `add` copied only the entry point, so every real
component installed with unresolvable imports.

The synthetic component imports from `@matter-internal/lib` — a deliberate
fake alias used by `transforms/rewriteImports.test.ts` to verify the
rewriter applies the user's `aliases` config.
