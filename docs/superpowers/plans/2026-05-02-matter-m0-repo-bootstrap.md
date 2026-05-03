# Matter — Milestone 0: Repo Bootstrap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Matter monorepo with three empty-but-buildable package skeletons (`@lovo/matter`, `@lovo/matter-react`, `@lovo/matter-cli`), shared tooling (TypeScript, ESLint, Prettier, Turborepo), CI stubs, and LICENSE/README — the foundation that Milestones 1–6 build on.

**Architecture:** pnpm workspaces monorepo with Turborepo for task orchestration. Three publishable packages built with tsup (esbuild). Shared TypeScript and ESLint configs in `tooling/`. No code logic in this milestone — just structure that the next milestone immediately consumes.

**Tech Stack:** Node 22 LTS · pnpm 9 · TypeScript 5.6 · Turborepo 2 · tsup 8 · ESLint 9 (flat config) · Prettier 3 · GitHub Actions

---

## Scope

**In scope (this plan validates "tooling works"):**

- Git repo with the existing design doc as first commit
- Root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `turbo.json`
- Three publishable package skeletons (`packages/matter/`, `packages/matter-react/`, `packages/matter-cli/`) — each with `package.json`, `tsconfig.json`, `tsup.config.ts`, and a stub `src/index.ts`
- Shared tooling (`tooling/eslint-config/`, `tooling/tsconfig/`)
- `LICENSE` (MIT — confirm with user before commit if they prefer something else), `README.md`
- GitHub Actions CI workflow stub (`typecheck`, `lint`, `build` jobs)

**Out of scope (handled in later milestones):**

- `apps/docs/` (Next.js docs site) — Milestone 1 phase 1.7+ / Milestone 4
- `.storybook/` config — Milestone 1 phase 1.7
- `registry/` and `registry.json` — Milestone 1 phase 1.7
- Any actual exported APIs beyond `// stub` placeholders — Milestone 1+
- Vitest, Playwright — Milestone 1+ as needed
- Folder rename from `mattermix/` to `matter/` — manual chore deferred (see "Note on folder name" below)

**Note on folder name:** The folder is currently `/Users/hunter.garrett/Documents/_personal/mattermix/`. The npm packages will be `@lovo/matter*` regardless. The directory rename is purely cosmetic — handle it whenever convenient (in a separate terminal: `mv /Users/hunter.garrett/Documents/_personal/mattermix /Users/hunter.garrett/Documents/_personal/matter`). All commands in this plan use the current path; nothing breaks if you defer the rename indefinitely.

---

## Pre-flight checks

Before starting, verify:

- [ ] **Node 22 LTS or later installed.** Run: `node -v`. Expected: `v22.x.x` or later. If not, install via `nvm install 22 && nvm use 22`.
- [ ] **pnpm 9 or later installed.** Run: `pnpm -v`. Expected: `9.x.x` or later. If not, install via `corepack enable && corepack use pnpm@latest-9`.
- [ ] **Git installed.** Run: `git --version`. Expected: any recent version.
- [ ] **You are in `/Users/hunter.garrett/Documents/_personal/mattermix/`.** Run: `pwd`. If not, `cd` there.

---

## File structure produced by this milestone

```
mattermix/                              # (rename to matter/ deferred)
├── .git/                               # NEW — initialized in Task 1
├── .gitignore                          # NEW — Task 1
├── .nvmrc                              # NEW — Task 1
├── .prettierrc.json                    # NEW — Task 5
├── .prettierignore                     # NEW — Task 5
├── .github/
│   └── workflows/
│       └── ci.yml                      # NEW — Task 12
├── docs/
│   └── superpowers/
│       ├── specs/2026-05-02-matter-design.md   # EXISTS — committed in Task 1
│       └── plans/2026-05-02-matter-m0-repo-bootstrap.md   # EXISTS — this file
├── package.json                        # NEW — Task 2
├── pnpm-workspace.yaml                 # NEW — Task 2
├── tsconfig.base.json                  # NEW — Task 3
├── turbo.json                          # NEW — Task 4
├── eslint.config.js                    # NEW — Task 5
├── LICENSE                             # NEW — Task 10
├── README.md                           # NEW — Task 11
├── tooling/
│   ├── eslint-config/
│   │   ├── package.json                # NEW — Task 5
│   │   └── index.js                    # NEW — Task 5
│   └── tsconfig/
│       ├── package.json                # NEW — Task 6
│       ├── base.json                   # NEW — Task 6
│       ├── library.json                # NEW — Task 6
│       └── react-library.json          # NEW — Task 6
└── packages/
    ├── matter/                         # @lovo/matter
    │   ├── package.json                # NEW — Task 7
    │   ├── tsconfig.json               # NEW — Task 7
    │   ├── tsup.config.ts              # NEW — Task 7
    │   └── src/index.ts                # NEW — Task 7
    ├── matter-react/                   # @lovo/matter-react
    │   ├── package.json                # NEW — Task 8
    │   ├── tsconfig.json               # NEW — Task 8
    │   ├── tsup.config.ts              # NEW — Task 8
    │   └── src/index.ts                # NEW — Task 8
    └── matter-cli/                     # @lovo/matter-cli
        ├── package.json                # NEW — Task 9
        ├── tsconfig.json               # NEW — Task 9
        ├── tsup.config.ts              # NEW — Task 9
        └── src/index.ts                # NEW — Task 9
```

---

## Task 1: Initialize git and commit existing artifacts

**Files:**

- Create: `.gitignore`
- Create: `.nvmrc`

**Why this is first:** establishes the repo so every subsequent task can commit incrementally.

- [ ] **Step 1.1: Initialize git.**

```bash
cd /Users/hunter.garrett/Documents/_personal/mattermix
git init
```

Expected output: `Initialized empty Git repository in /Users/hunter.garrett/Documents/_personal/mattermix/.git/`

- [ ] **Step 1.2: Create `.gitignore` at repo root.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/.gitignore`

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build output
dist/
build/
out/
.turbo/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# Editor / OS
.DS_Store
Thumbs.db
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
.idea/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Caches
.cache/
.eslintcache

# Brainstorming companion (not source code)
.superpowers/
```

- [ ] **Step 1.3: Create `.nvmrc` to pin Node version.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/.nvmrc`

```
22
```

- [ ] **Step 1.4: Stage and verify what will be committed.**

```bash
git add .gitignore .nvmrc docs/
git status
```

Expected: shows `.gitignore`, `.nvmrc`, and the spec + this plan as new files. The `.superpowers/` brainstorm directory should NOT appear (excluded by `.gitignore`).

- [ ] **Step 1.5: Make the initial commit.**

```bash
git commit -m "chore: initial commit — design spec and M0 plan"
```

Expected: commit succeeds with the four files listed.

---

## Task 2: Root package.json and pnpm workspace

**Files:**

- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`

- [ ] **Step 2.1: Create root `package.json`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/package.json`

```json
{
  "name": "matter-monorepo",
  "private": true,
  "version": "0.0.0",
  "description": "Monorepo root for Matter — React shader components on WebGPU + TSL",
  "license": "MIT",
  "engines": {
    "node": ">=22"
  },
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf node_modules .turbo",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,yml,yaml}\""
  },
  "devDependencies": {
    "turbo": "^2.2.0",
    "typescript": "^5.6.0",
    "prettier": "^3.3.0"
  }
}
```

- [ ] **Step 2.2: Create `pnpm-workspace.yaml`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - 'tooling/*'
```

(`apps/*` is intentionally excluded for now — there are no apps in M0.)

- [ ] **Step 2.3: Install root dependencies.**

```bash
pnpm install
```

Expected: pnpm fetches `turbo`, `typescript`, `prettier`. `node_modules/` and `pnpm-lock.yaml` are created. No errors.

- [ ] **Step 2.4: Verify pnpm recognized the workspace.**

```bash
pnpm list -r
```

Expected: only the root package shown (since no workspace packages exist yet).

- [ ] **Step 2.5: Stage and commit.**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore: initialize pnpm workspace with root devDependencies"
```

---

## Task 3: Base TypeScript config

**Files:**

- Create: `tsconfig.base.json`

- [ ] **Step 3.1: Create `tsconfig.base.json` at repo root.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/tsconfig.base.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "moduleDetection": "force",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowJs": false,
    "forceConsistentCasingInFileNames": true,
    "incremental": true
  },
  "exclude": ["node_modules", "dist", "build", ".turbo", ".next"]
}
```

- [ ] **Step 3.2: Verify it parses.**

```bash
pnpm exec tsc --noEmit -p tsconfig.base.json 2>&1 | head
```

Expected: no error message about parsing the file. (It may complain that no input files match — that's fine, this is a base config.)

- [ ] **Step 3.3: Stage and commit.**

```bash
git add tsconfig.base.json
git commit -m "chore: add base tsconfig with strict settings"
```

---

## Task 4: Turborepo configuration

**Files:**

- Create: `turbo.json`

- [ ] **Step 4.1: Create `turbo.json` at repo root.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".turbo/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": ["*.tsbuildinfo"]
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

- [ ] **Step 4.2: Verify Turborepo loads the config.**

```bash
pnpm turbo run build --dry-run
```

Expected: output describes the task graph (no packages have a `build` script yet, so it shows zero tasks scheduled — that's correct).

- [ ] **Step 4.3: Stage and commit.**

```bash
git add turbo.json
git commit -m "chore: configure Turborepo task graph"
```

---

## Task 5: ESLint flat config + Prettier

**Files:**

- Create: `tooling/eslint-config/package.json`
- Create: `tooling/eslint-config/index.js`
- Create: `eslint.config.js` (root)
- Create: `.prettierrc.json`
- Create: `.prettierignore`

- [ ] **Step 5.1: Create `tooling/eslint-config/package.json`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/tooling/eslint-config/package.json`

```json
{
  "name": "@matter/eslint-config",
  "version": "0.0.0",
  "private": true,
  "main": "index.js",
  "type": "module",
  "dependencies": {
    "@eslint/js": "^9.13.0",
    "eslint-plugin-react": "^7.37.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "globals": "^15.11.0",
    "typescript-eslint": "^8.10.0"
  },
  "peerDependencies": {
    "eslint": "^9.13.0"
  }
}
```

- [ ] **Step 5.2: Create the shared ESLint config.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/tooling/eslint-config/index.js`

```js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // not needed in React 19
      'react/prop-types': 'off', // we use TS
    },
    settings: {
      react: { version: 'detect' },
    },
  },
)
```

- [ ] **Step 5.3: Create root `eslint.config.js` that re-exports the shared config.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/eslint.config.js`

```js
export { default } from '@matter/eslint-config'
```

- [ ] **Step 5.4: Add ESLint to root devDependencies.**

```bash
pnpm add -Dw eslint@^9.13.0
```

- [ ] **Step 5.5: Add the workspace dependency on `@matter/eslint-config` to root.**

Edit `/Users/hunter.garrett/Documents/_personal/mattermix/package.json` to add the dependency. The `devDependencies` section should now include the workspace reference:

```json
{
  "devDependencies": {
    "@matter/eslint-config": "workspace:*",
    "eslint": "^9.13.0",
    "prettier": "^3.3.0",
    "turbo": "^2.2.0",
    "typescript": "^5.6.0"
  }
}
```

(Keep all other fields unchanged.)

- [ ] **Step 5.6: Run install to wire the workspace package.**

```bash
pnpm install
```

Expected: pnpm installs the eslint-config workspace package and its peer/transitive deps (`@eslint/js`, `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `globals`). No errors.

- [ ] **Step 5.7: Create `.prettierrc.json`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/.prettierrc.json`

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always"
}
```

- [ ] **Step 5.8: Create `.prettierignore`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/.prettierignore`

```
node_modules/
dist/
build/
.turbo/
.next/
pnpm-lock.yaml
*.tsbuildinfo
.superpowers/
```

- [ ] **Step 5.9: Verify ESLint loads the config without error.**

```bash
pnpm exec eslint --version && pnpm exec eslint --print-config eslint.config.js > /dev/null
```

Expected: eslint version printed; second command exits 0 with no output.

- [ ] **Step 5.10: Verify Prettier finds files (will report none yet, that's fine).**

```bash
pnpm exec prettier --check "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}" || true
```

Expected: prettier may report a few files needing formatting (e.g., the JSON files we just wrote). Run `pnpm format` if you want auto-fix; otherwise just verify the command runs.

- [ ] **Step 5.11: Stage and commit.**

```bash
git add tooling/eslint-config/ eslint.config.js .prettierrc.json .prettierignore package.json pnpm-lock.yaml
git commit -m "chore: add ESLint flat config and Prettier"
```

---

## Task 6: Shared TypeScript configs

**Files:**

- Create: `tooling/tsconfig/package.json`
- Create: `tooling/tsconfig/base.json`
- Create: `tooling/tsconfig/library.json`
- Create: `tooling/tsconfig/react-library.json`

- [ ] **Step 6.1: Create `tooling/tsconfig/package.json`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/tooling/tsconfig/package.json`

```json
{
  "name": "@matter/tsconfig",
  "version": "0.0.0",
  "private": true,
  "files": ["base.json", "library.json", "react-library.json"]
}
```

- [ ] **Step 6.2: Create `tooling/tsconfig/base.json` (re-exports the root base for in-monorepo extension).**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/tooling/tsconfig/base.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.base.json"
}
```

- [ ] **Step 6.3: Create `tooling/tsconfig/library.json` for headless TS library packages.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/tooling/tsconfig/library.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 6.4: Create `tooling/tsconfig/react-library.json` for React-using packages.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/tooling/tsconfig/react-library.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./library.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

- [ ] **Step 6.5: Run pnpm install so the workspace registers `@matter/tsconfig`.**

```bash
pnpm install
```

Expected: no fetches (it's a local file-only package), but pnpm registers the workspace symlink.

- [ ] **Step 6.6: Verify the package is visible in the workspace.**

```bash
pnpm list -r --depth -1
```

Expected: lists `@matter/eslint-config` and `@matter/tsconfig` as workspace packages.

- [ ] **Step 6.7: Stage and commit.**

```bash
git add tooling/tsconfig/ pnpm-lock.yaml
git commit -m "chore: add shared TypeScript configs (library, react-library)"
```

---

## Task 7: `@lovo/matter` package skeleton (engine)

**Files:**

- Create: `packages/matter/package.json`
- Create: `packages/matter/tsconfig.json`
- Create: `packages/matter/tsup.config.ts`
- Create: `packages/matter/src/index.ts`

- [ ] **Step 7.1: Create `packages/matter/package.json`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/package.json`

```json
{
  "name": "@lovo/matter",
  "version": "0.0.0",
  "description": "Engine for Matter — TSL primitives, renderer, scheduler. Framework-agnostic.",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist"],
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "clean": "rm -rf dist .turbo *.tsbuildinfo"
  },
  "peerDependencies": {
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@matter/eslint-config": "workspace:*",
    "@matter/tsconfig": "workspace:*",
    "@types/three": "^0.170.0",
    "three": "^0.170.0",
    "tsup": "^8.3.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 7.2: Create `packages/matter/tsconfig.json`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/tsconfig.json`

```json
{
  "extends": "@matter/tsconfig/library.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 7.3: Create `packages/matter/tsup.config.ts`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/tsup.config.ts`

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['three'],
})
```

- [ ] **Step 7.4: Create `packages/matter/src/index.ts` (stub).**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter/src/index.ts`

```ts
// @lovo/matter — engine package.
// Implementation begins in Milestone 1. This stub exists so the package builds
// and its workspace wiring can be verified.

export const __MATTER_ENGINE_VERSION__ = '0.0.0' as const
```

- [ ] **Step 7.5: Install the package's deps.**

```bash
pnpm install
```

Expected: pnpm fetches `tsup`, `three`, `@types/three`. Success.

- [ ] **Step 7.6: Build the package.**

```bash
pnpm --filter @lovo/matter build
```

Expected: tsup creates `packages/matter/dist/` with `index.js`, `index.cjs`, `index.d.ts`, source maps. No errors.

- [ ] **Step 7.7: Typecheck the package.**

```bash
pnpm --filter @lovo/matter typecheck
```

Expected: exits 0.

- [ ] **Step 7.8: Lint the package.**

```bash
pnpm --filter @lovo/matter lint
```

Expected: no errors. (May warn about unused `__MATTER_ENGINE_VERSION__` — if so, the warning is fine and gets resolved when the engine actually exports things.)

- [ ] **Step 7.9: Stage and commit.**

```bash
git add packages/matter/ pnpm-lock.yaml
git commit -m "feat(matter): add @lovo/matter engine package skeleton"
```

---

## Task 8: `@lovo/matter-react` package skeleton (React binding)

**Files:**

- Create: `packages/matter-react/package.json`
- Create: `packages/matter-react/tsconfig.json`
- Create: `packages/matter-react/tsup.config.ts`
- Create: `packages/matter-react/src/index.ts`

- [ ] **Step 8.1: Create `packages/matter-react/package.json`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-react/package.json`

```json
{
  "name": "@lovo/matter-react",
  "version": "0.0.0",
  "description": "React binding for Matter — MatterScene, useShaderMaterial, input hooks.",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist"],
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "clean": "rm -rf dist .turbo *.tsbuildinfo"
  },
  "peerDependencies": {
    "@lovo/matter": "workspace:*",
    "react": "^19.0.0",
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@lovo/matter": "workspace:*",
    "@matter/eslint-config": "workspace:*",
    "@matter/tsconfig": "workspace:*",
    "@types/react": "^19.0.0",
    "@types/three": "^0.170.0",
    "react": "^19.0.0",
    "three": "^0.170.0",
    "tsup": "^8.3.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 8.2: Create `packages/matter-react/tsconfig.json`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-react/tsconfig.json`

```json
{
  "extends": "@matter/tsconfig/react-library.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 8.3: Create `packages/matter-react/tsup.config.ts`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-react/tsup.config.ts`

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'three', '@lovo/matter'],
})
```

- [ ] **Step 8.4: Create `packages/matter-react/src/index.ts` (stub).**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-react/src/index.ts`

```ts
// @lovo/matter-react — React binding for Matter.
// Implementation begins in Milestone 1. This stub exists so the package builds.

export const __MATTER_REACT_VERSION__ = '0.0.0' as const
```

- [ ] **Step 8.5: Install dependencies.**

```bash
pnpm install
```

Expected: pnpm fetches `react`, `@types/react`. The workspace dep on `@lovo/matter` resolves locally.

- [ ] **Step 8.6: Build, typecheck, and lint.**

```bash
pnpm --filter @lovo/matter-react build
pnpm --filter @lovo/matter-react typecheck
pnpm --filter @lovo/matter-react lint
```

Expected: all three exit 0. `dist/` contains the built artifacts.

- [ ] **Step 8.7: Stage and commit.**

```bash
git add packages/matter-react/ pnpm-lock.yaml
git commit -m "feat(matter-react): add @lovo/matter-react binding package skeleton"
```

---

## Task 9: `@lovo/matter-cli` package skeleton (CLI)

**Files:**

- Create: `packages/matter-cli/package.json`
- Create: `packages/matter-cli/tsconfig.json`
- Create: `packages/matter-cli/tsup.config.ts`
- Create: `packages/matter-cli/src/index.ts`

- [ ] **Step 9.1: Create `packages/matter-cli/package.json`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/package.json`

```json
{
  "name": "@lovo/matter-cli",
  "version": "0.0.0",
  "description": "CLI for Matter — copy-paste components from the registry into your project.",
  "license": "MIT",
  "type": "module",
  "bin": {
    "matter-cli": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "files": ["dist"],
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "clean": "rm -rf dist .turbo *.tsbuildinfo"
  },
  "engines": {
    "node": ">=22"
  },
  "devDependencies": {
    "@matter/eslint-config": "workspace:*",
    "@matter/tsconfig": "workspace:*",
    "@types/node": "^22.7.0",
    "tsup": "^8.3.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 9.2: Create `packages/matter-cli/tsconfig.json`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/tsconfig.json`

```json
{
  "extends": "@matter/tsconfig/library.json",
  "compilerOptions": {
    "outDir": "dist",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 9.3: Create `packages/matter-cli/tsup.config.ts`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/tsup.config.ts`

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
})
```

- [ ] **Step 9.4: Create `packages/matter-cli/src/index.ts` (stub).**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/index.ts`

```ts
// @lovo/matter-cli — copy-paste delivery for Matter components.
// Implementation begins in Milestone 2. This stub exists so the package builds.

const args = process.argv.slice(2)
console.log('matter-cli stub — implementation in Milestone 2.')
console.log('args:', args)
```

- [ ] **Step 9.5: Install dependencies.**

```bash
pnpm install
```

Expected: pnpm fetches `@types/node`.

- [ ] **Step 9.6: Build, typecheck, and lint.**

```bash
pnpm --filter @lovo/matter-cli build
pnpm --filter @lovo/matter-cli typecheck
pnpm --filter @lovo/matter-cli lint
```

Expected: all three exit 0.

- [ ] **Step 9.7: Smoke-test the built CLI.**

```bash
node packages/matter-cli/dist/index.js add foo
```

Expected output:

```
matter-cli stub — implementation in Milestone 2.
args: [ 'add', 'foo' ]
```

- [ ] **Step 9.8: Verify the bin shebang is in the output.**

```bash
head -1 packages/matter-cli/dist/index.js
```

Expected: `#!/usr/bin/env node`

- [ ] **Step 9.9: Stage and commit.**

```bash
git add packages/matter-cli/ pnpm-lock.yaml
git commit -m "feat(matter-cli): add @lovo/matter-cli package skeleton with stub entry"
```

---

## Task 10: LICENSE

**Files:**

- Create: `LICENSE`

- [ ] **Step 10.1: Confirm license choice.**

The plan defaults to **MIT**. If you want a different license (Apache 2.0, BSD 3-Clause, etc.), substitute below before writing the file. MIT is the de-facto standard for component libraries; recommended unless you have specific reason to choose otherwise.

- [ ] **Step 10.2: Create `LICENSE`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/LICENSE`

```
MIT License

Copyright (c) 2026 Hunter Garrett / Lovo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 10.3: Stage and commit.**

```bash
git add LICENSE
git commit -m "chore: add MIT LICENSE"
```

---

## Task 11: README

**Files:**

- Create: `README.md`

- [ ] **Step 11.1: Create `README.md`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/README.md`

````markdown
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
````

- [ ] **Step 11.2: Stage and commit.**

```bash
git add README.md
git commit -m "docs: add README with project overview and roadmap"
```

---

## Task 12: GitHub Actions CI stub

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 12.1: Create `.github/workflows/ci.yml`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    name: Build · Typecheck · Lint
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up pnpm
        uses: pnpm/action-setup@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Build
        run: pnpm build
```

- [ ] **Step 12.2: Stage and commit.**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions CI workflow (typecheck, lint, build)"
```

---

## Task 13: Final verification — full repo builds clean

This task validates the entire milestone. No new files; just running every script and confirming exit codes.

- [ ] **Step 13.1: Clean state.**

```bash
pnpm clean
```

Expected: removes all `dist/`, `.turbo/`, and `node_modules/` directories. May produce some "directory not found" notices for packages that didn't have these dirs — fine.

- [ ] **Step 13.2: Fresh install.**

```bash
pnpm install --frozen-lockfile
```

Expected: full restore from `pnpm-lock.yaml`, no errors.

- [ ] **Step 13.3: Typecheck the entire workspace.**

```bash
pnpm typecheck
```

Expected: Turborepo runs `typecheck` for all three packages in parallel; all exit 0.

- [ ] **Step 13.4: Lint the entire workspace.**

```bash
pnpm lint
```

Expected: all three packages lint clean.

- [ ] **Step 13.5: Build the entire workspace.**

```bash
pnpm build
```

Expected: tsup builds all three packages. `packages/{matter,matter-react,matter-cli}/dist/` contain `index.js`, `index.cjs` (where applicable), `index.d.ts`. Turborepo reports cache state.

- [ ] **Step 13.6: Verify the CLI bin still works after the full build.**

```bash
node packages/matter-cli/dist/index.js list
```

Expected: stub output as in step 9.7.

- [ ] **Step 13.7: Verify Turborepo cache HIT on rebuild.**

```bash
pnpm build
```

Expected: every task reports `>>> FULL TURBO` cache hits (since nothing changed). This proves caching works.

- [ ] **Step 13.8: Run Prettier check.**

```bash
pnpm exec prettier --check "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"
```

Expected: clean, or a small list of files needing formatting. Run `pnpm format` to fix any formatting drift.

- [ ] **Step 13.9: Final stage of any prettier-fixed files (if applicable).**

If `pnpm format` made changes:

```bash
git status
git add -A
git commit -m "chore: format with Prettier"
```

---

## Task 14: Mark Milestone 0 complete

- [ ] **Step 14.1: Tag the milestone (optional but recommended).**

```bash
git tag -a m0-complete -m "Milestone 0 complete: repo bootstrap"
```

- [ ] **Step 14.2: Verify final state.**

```bash
git log --oneline
```

Expected: a clean linear history of commits, roughly:

1. `chore: initial commit — design spec and M0 plan`
2. `chore: initialize pnpm workspace with root devDependencies`
3. `chore: add base tsconfig with strict settings`
4. `chore: configure Turborepo task graph`
5. `chore: add ESLint flat config and Prettier`
6. `chore: add shared TypeScript configs (library, react-library)`
7. `feat(matter): add @lovo/matter engine package skeleton`
8. `feat(matter-react): add @lovo/matter-react binding package skeleton`
9. `feat(matter-cli): add @lovo/matter-cli package skeleton with stub entry`
10. `chore: add MIT LICENSE`
11. `docs: add README with project overview and roadmap`
12. `ci: add GitHub Actions CI workflow (typecheck, lint, build)`
13. (optional) `chore: format with Prettier`

- [ ] **Step 14.3: Stop and play — what to verify by hand before moving on.**

Open the repo in your editor. Spend a few minutes:

- Browse the package skeletons. Notice how each one has the same shape (package.json + tsconfig + tsup config + src/index.ts) — this regularity will pay dividends when M1 adds real code.
- Run `pnpm dev` in one of the packages (e.g., `pnpm --filter @lovo/matter dev`) to see tsup's watch mode. Modify `src/index.ts`, save, watch it rebuild. Stop with `Ctrl+C`.
- Push the repo to GitHub (create a `lovo/matter` repo first if you want), let CI run, watch it pass.

When this feels solid and you're ready to write actual shader code, move on to writing the **Milestone 1 plan** (vertical slice — LinearGradient end-to-end). The next plan picks up from this committed state.

---

## What this milestone validated

| Architectural element            | How M0 validated it                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| Three-package split is buildable | Each package builds independently with tsup                                          |
| Workspace tooling cohesion       | Shared `@matter/eslint-config` and `@matter/tsconfig` packages work across all three |
| Turborepo caching                | Step 13.7 shows cache hits                                                           |
| Public API exports               | Each package has a working `exports` map (validated when consumers import in M1)     |
| CI baseline                      | `.github/workflows/ci.yml` runs typecheck/lint/build on every push                   |

---

## Notes for the executor

- **Commit boundaries are intentional.** Each task ends with a commit so the history reads as a clean progression of small additions. If you find yourself making a 200-line commit, that's a signal to break the task into more steps.
- **Don't add scope.** This milestone is _only_ tooling. No engine code, no React components, no docs site. Resist the urge to "while I'm here, add..." — that work is in M1+.
- **If a step's expected output doesn't match.** Stop. Read the actual output carefully — most failures here are version mismatches or typos in JSON/YAML. Don't paper over by adding workarounds; the foundation must be clean.
- **The `mattermix/` → `matter/` folder rename** can happen any time. It's purely cosmetic. Defer or do it now in a separate terminal — the plan's commands all use the current path.
