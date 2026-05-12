# M7 baseline — captured 2026-05-12

| Command | Wall time | Exit | Notes |
|---|---|---|---|
| pnpm install --frozen-lockfile | 0.7s | 0 | Lockfile up to date, nothing to install |
| pnpm typecheck | 7.0s | 0 | 4 cached; turbo warning: no outputs key for docs#typecheck (pre-existing) |
| pnpm lint | 2.6s | 0 | 2 cached; MODULE_TYPELESS_PACKAGE_JSON warnings (pre-existing, cosmetic) |
| pnpm build | 13.3s | 0 | 2 cached; full Next.js docs site SSG included |
| pnpm test | 3.8s | 0 | 2 cached; 22 test files, 80 tests (55 matter + 25 matter-react) all pass |
| pnpm smoke | 2.3s | 0 | add + update --force, byte-identical file check passed |

dist/ artifacts present:
- packages/matter/dist:
```
drwxr-xr-x@  9 hunter.garrett  staff     288 May 11 18:52 .
drwxr-xr-x@ 15 hunter.garrett  staff     480 May 12 17:03 ..
-rw-r--r--@  1 hunter.garrett  staff  190046 May  8 16:12 .tsbuildinfo
-rw-r--r--@  1 hunter.garrett  staff   15149 May 11 18:52 index.cjs
-rw-r--r--@  1 hunter.garrett  staff   41409 May 11 18:52 index.cjs.map
-rw-r--r--@  1 hunter.garrett  staff   14993 May 11 18:52 index.d.cts
-rw-r--r--@  1 hunter.garrett  staff   14993 May 11 18:52 index.d.ts
-rw-r--r--@  1 hunter.garrett  staff   13009 May 11 18:52 index.js
-rw-r--r--@  1 hunter.garrett  staff   39565 May 11 18:52 index.js.map
```
- packages/matter-react/dist:
```
drwxr-xr-x@  9 hunter.garrett  staff     288 May 12 17:03 .
drwxr-xr-x@ 15 hunter.garrett  staff     480 May 12 17:03 ..
-rw-r--r--@  1 hunter.garrett  staff  193585 May  8 16:09 .tsbuildinfo
-rw-r--r--@  1 hunter.garrett  staff   14423 May 12 17:03 index.cjs
-rw-r--r--@  1 hunter.garrett  staff   31665 May 12 17:03 index.cjs.map
-rw-r--r--@  1 hunter.garrett  staff    7199 May 12 17:03 index.d.cts
-rw-r--r--@  1 hunter.garrett  staff    7199 May 12 17:03 index.d.ts
-rw-r--r--@  1 hunter.garrett  staff   12612 May 12 17:03 index.js
-rw-r--r--@  1 hunter.garrett  staff   30808 May 12 17:03 index.js.map
```
- packages/matter-cli/dist:
```
drwxr-xr-x@ 20 hunter.garrett  staff    640 May 12 17:03 .
drwxr-xr-x@ 15 hunter.garrett  staff    480 May 12 17:03 ..
-rw-r--r--@  1 hunter.garrett  staff  60290 May 10 08:24 .tsbuildinfo
-rwxr-xr-x@  1 hunter.garrett  staff    189 May 12 17:03 add-WFXJ7HFS.js
-rw-r--r--@  1 hunter.garrett  staff     71 May 12 17:03 add-WFXJ7HFS.js.map
-rwxr-xr-x@  1 hunter.garrett  staff   2503 May 12 17:03 chunk-PWYRLP7T.js
-rw-r--r--@  1 hunter.garrett  staff   4817 May 12 17:03 chunk-PWYRLP7T.js.map
-rwxr-xr-x@  1 hunter.garrett  staff   2168 May 12 17:03 chunk-QTD5MDLV.js
-rw-r--r--@  1 hunter.garrett  staff   5572 May 12 17:03 chunk-QTD5MDLV.js.map
```

## Vite+ install (Task A.1 — captured 2026-05-12)

- `node -v`: v24.15.0 (drift: .nvmrc says 22 — see concerns below)
- `pnpm -v`: 9.12.3 (drift: packageManager field says 9.12.0 — see concerns below)
- `which vp`: shell function wrapping `command vp` (installed via Vite+ CLI installer; resolves via PATH)
- `vp --version`: vp v0.1.14

**Concerns (non-fatal):**
- Node.js is v24.15.0, not v22.x as specified in `.nvmrc`. This is a version ahead of what the plan assumed. No failures observed; document in case any tool behaves differently under v24.
- pnpm is 9.12.3 vs the pinned `9.12.0` in `packageManager`. Patch-level drift only; no failures observed.
- `vp --version` output also shows all local Vite+ tools (vite, rolldown, vitest, oxfmt, oxlint, tsdown) as "Not found" — expected at this baseline stage before `vp install` / `vp migrate` runs. The `Package manager` and `Node.js` lines confirm `vp` is correctly detecting the environment.

### `vp --help` (first 30 lines)
```
VITE+ - The Unified Toolchain for the Web

Usage: vp [COMMAND]

Start:
  create      Create a new project from a template
  migrate     Migrate an existing project to Vite+
  config      Configure hooks and agent integration
  staged      Run linters on staged files
  install, i  Install all dependencies, or add packages if package names are provided
  env         Manage Node.js versions

Develop:
  dev    Run the development server
  check  Run format, lint, and type checks
  lint   Lint code
  fmt    Format code
  test   Run tests

Execute:
  run    Run tasks
  exec   Execute a command from local node_modules/.bin
  dlx    Execute a package binary without installing it as a dependency
  cache  Manage the task cache

Build:
  build    Build for production
  pack     Build library
  preview  Preview production build
```

### `vp env --help` (first 30 lines)
```
VITE+ - The Unified Toolchain for the Web

Usage: vp env [COMMAND]

Manage Node.js versions

Setup:
  setup  Create or update shims in VITE_PLUS_HOME/bin
  on     Enable managed mode - shims always use vite-plus managed Node.js
  off    Enable system-first mode - shims prefer system Node.js, fallback to managed
  print  Print shell snippet to set environment for current session

Manage:
  default    Set or show the global default Node.js version
  pin        Pin a Node.js version in the current directory (creates .node-version)
  unpin      Remove the .node-version file from current directory (alias for `pin --unpin`)
  use        Use a specific Node.js version for this shell session
  install    Install a Node.js version [aliases: i]
  uninstall  Uninstall a Node.js version [aliases: uni]
  exec       Execute a command with a specific Node.js version [aliases: run]

Inspect:
  current      Show current environment information
  doctor       Run diagnostics and show environment status
  which        Show path to the tool that would be executed
  list         List locally installed Node.js versions [aliases: ls]
  list-remote  List available Node.js versions from the registry [aliases: ls-remote]

Examples:
  Setup:
```

### `vp install --help` (first 30 lines)
```
VITE+ - The Unified Toolchain for the Web

Usage: vp install [OPTIONS] [PACKAGES]... [-- <PASS_THROUGH_ARGS>...]

Install all dependencies, or add packages if package names are provided

Arguments:
  [PACKAGES]...           Packages to add (if provided, acts as `vp add`)
  [PASS_THROUGH_ARGS]...  Additional arguments to pass through to the package manager

Options:
  -P, --prod            Do not install devDependencies
  -D, --dev             Only install devDependencies (install) / Save to devDependencies (add)
  --no-optional         Do not install optionalDependencies
  --frozen-lockfile     Fail if lockfile needs to be updated (CI mode)
  --no-frozen-lockfile  Allow lockfile updates (opposite of --frozen-lockfile)
  --lockfile-only       Only update lockfile, don't install
  --prefer-offline      Use cached packages when available
  --offline             Only use packages already in cache
  -f, --force           Force reinstall all dependencies
  --ignore-scripts      Do not run lifecycle scripts
  --no-lockfile         Don't read or generate lockfile
  --fix-lockfile        Fix broken lockfile entries (pnpm and yarn@2+ only)
  --shamefully-hoist    Create flat `node_modules` (pnpm only)
  --resolution-only     Re-run resolution for peer dependency analysis (pnpm only)
  --silent              Suppress output (silent mode)
  --filter <PATTERN>    Filter packages in monorepo (can be used multiple times)
  -w, --workspace-root  Install in workspace root only
  -E, --save-exact      Save exact version (only when adding packages)
  --save-peer           Save to peerDependencies (only when adding packages)
```

### `vp migrate --help` (first 30 lines)
```
VITE+ - The Unified Toolchain for the Web

Usage: vp migrate [PATH] [OPTIONS]

Migrate standalone Vite, Vitest, Oxlint, Oxfmt, and Prettier projects to unified Vite+.

Arguments:
  PATH  Target directory to migrate (default: current directory)

Options:
  --agent NAME      Write agent instructions file into the project (e.g. chatgpt, claude, opencode).
  --no-agent        Skip writing agent instructions file
  --editor NAME     Write editor config files into the project.
  --no-editor       Skip writing editor config files
  --hooks           Set up pre-commit hooks (default in non-interactive mode)
  --no-hooks        Skip pre-commit hooks setup
  --no-interactive  Run in non-interactive mode (skip prompts and use defaults)
  -h, --help        Show this help message

Examples:
  # Migrate current package
  vp migrate

  # Migrate specific directory
  vp migrate my-app

  # Non-interactive mode
  vp migrate --no-interactive

Migration Prompt:
```
