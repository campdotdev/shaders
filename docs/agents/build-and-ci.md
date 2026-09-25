# Build, CI, and release

Read this before you change a dependency, a `package.json`, a tsconfig, `turbo.json`, or a workflow, when CI fails, or before you publish. For the Playwright suites, read `docs/development/visual-regression.md` instead.

## Run on Node 22

The docs production build, `next build` with static export, fails without an error on Node 23: it exits 0 and writes no `out/`. The missing directory then breaks pagefind and `pnpm snap`. Run the pinned Node 22 rather than changing config. `.node-version`, at 22.22.2, is the source of truth. `.nvmrc`, at 22, is the loose copy that fnm reads. The root `devEngines` pin runs every `pnpm` script on Node 22.22.2.

## Ship the lockfile with every dependency change

Every CI job starts with `pnpm install --frozen-lockfile`. A `package.json` dependency change without the matching `pnpm-lock.yaml` kills every job at install, and `ERR_PNPM_OUTDATED_LOCKFILE` looks like everything failing at once.

Read the lockfile diff before you commit it. Any resolution step, such as `pnpm add`, `pnpm remove`, or `pnpm install --lockfile-only`, can rewrite the `node@runtime:22.22.2` entry, which is the resolved form of the `devEngines` pin. Under pnpm 10.34 that entry is a `resolution: type: variations` block that lists one tarball per platform. A resolution step has twice degraded it to `version: 0.0.0` without anyone noticing. Check that the block still names 22.22.2, then run `pnpm install --frozen-lockfile` again.

## Run Prettier before you commit

CI runs Prettier over the whole repo through `pnpm format:check`, separately from lint. Its import-sort plugin reorders imports, so run `prettier --write` on the files you changed. Markdown and MDX are in `.prettierignore`.

In a client component, put `'use client'` on line 1 and any comment below it. With a comment above the directive, the plugin inserts a second copy of the directive on every run, so `--write` never converges and `format:check` keeps failing.

## The docs site compiles the package from source

`apps/docs/next.config.ts` aliases `@camp-dev/shaders` and its `color`, `gamut`, and `poster` subpaths to files under `packages/shaders/src`, in its `webpack()` hook. A module rule scoped to that directory maps the package's `.js` import specifiers onto `.ts`, and `apps/docs/tsconfig.json` mirrors the aliases under `paths`. Shader edits hot-reload in the dev server with no build step.

The docs site's Vitest run still resolves the package through `dist`, which is why `turbo.json` builds before test. If a package edit shows in the browser but not in the docs tests, or the reverse, run `pnpm --filter @camp-dev/shaders build` to refresh the test side.

Turborepo (`turbo`) runs the workspace tasks. The docs site bundles with webpack, not Turbopack, so bundler config goes in that `webpack()` hook.

## tsconfig

- `tooling/tsconfig/library.json` writes its paths with `${configDir}`, such as `${configDir}/dist`. Leave `rootDir` out. tsup's DTS build loads the tsconfig through `load-tsconfig`, which does not substitute `${configDir}`.
- `incremental: true` with `tsc --noEmit` needs `tsBuildInfoFile`, which `library.json` sets. Error TS5074 means it got lost.
- `apps/docs/tsconfig.json` extends `../../tooling/tsconfig/base.json` by relative path, while every other workspace uses the `@shaders/tsconfig` package form. Keep it relative. Fallow's resolver drops `paths` when `extends` goes through a workspace package.
- A new workspace's Vitest config needs `passWithNoTests: true`. Vitest exits 1 when it finds no test files.

## Publish to npm

Releases run from `.github/workflows/release.yml` with OIDC trusted publishing. `pnpm publish` always hands the upload to whichever `npm` is on PATH, and the working combination is pnpm 10 plus `npm install -g npm@11`. E404 or ENEEDAUTH on publish means the auth chain failed, not that the package is missing. Four things break the chain:

- npm 10 has no OIDC support, which gives ENEEDAUTH.
- npm 12 rejects the `--git-checks` flag that pnpm forwards, which gives EUNKNOWNCONFIG.
- A `registry-url` in `setup-node` writes an empty-token auth line that skips OIDC, so the upload goes out anonymous and comes back as E404.
- A package that has never been published gives ENEEDAUTH, because npmjs.com has no settings page to hold a trusted publisher until the first version exists.

To publish a new package's first version:

1. Run `npm login` from a directory outside the repo. The root `devEngines` pin rejects bare `npm` inside it.
2. Run `pnpm publish` from the package directory.
3. On the package's settings page on npmjs.com, add a trusted publisher with organization `campdotdev`, repository `shaders`, and workflow `release.yml`, and tick "Allow npm publish". `changeset publish` calls plain `npm publish` rather than the staged flow. Both packages get the same entry, because the token names the workflow, not the package directory.
4. Run `pnpm exec changeset tag` and push the tags. `changeset publish` creates tags only after it publishes, so a manual first publish leaves them missing.
