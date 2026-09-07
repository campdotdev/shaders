# Test fixtures

These files are consumed by `vitest` tests in this package. They exist to
exercise the poster pipeline without a real project.

- `posters/*.tsx` — small component trees the poster end-to-end and bundle
  tests render: a single gradient, a gradient with grain, an aurora that
  needs a capture delay, a named export, and a trivial non-shader component.

The poster tests bundle these against this package's own `node_modules`, so
`@camp-dev/shaders` resolves to the workspace package's built `dist`. Build
the package before running them.
