# Shaders

Shaders is a React shader component library built on WebGPU and Three.js TSL. The repo is a pnpm workspace that Turborepo orchestrates, and the root `devEngines` pin runs every `pnpm` script on Node 22.

## Project shape

- **Two packages.** `@camp-dev/shaders` holds everything users import. `@camp-dev/shaders-cli` has one command, `poster`. Two apps sit beside them: `@shaders/docs` is the docs site, and `@shaders/docs-tests` holds the Playwright visual-regression and a11y suites.
- **Two tiers.** Tier 1 is the components under `packages/shaders/src/components/`, such as `<LinearGradient>`, imported from the package root. Tier 2 is the TSL primitives, such as `fractalNoise` and `voronoi`. The package exports them for Mode 2, and they have no doc pages of their own.
- **Two rendering modes.** In Mode 1, every Tier 1 component needs an explicit `<ShaderScene>` wrap, and you compose by stacking children in one scene. In Mode 2, users call `useShaderMaterial` inside their own r3f `<Canvas>`. Nothing auto-detects `@react-three/fiber`.
- **The engine is framework-free.** `src/engine.ts` is the barrel for the primitives, renderer, scheduler, and inputs. `src/react/` and `src/components/` import it rather than the root index, so dependencies run from root to components to react to engine, and never back. A `no-restricted-imports` block in `eslint.config.js` rejects React, `src/react`, and `src/components` everywhere in `packages/shaders/src` except those two folders and the root entries `index.ts`, `gamut.ts`, and `poster.ts`. The rule keeps the engine extractable for a second framework binding.

## Where things live

- Specs, tickets, backlog, and status are in Linear, on the Shaders team. New work produces no spec file in the repo.
- Decisions that outlive their ticket are in `docs/adr/`.
- The domain vocabulary is in `CONTEXT.md`. Use its terms in code, issues, and docs.
- Older implementation decisions are in git history.

## Read the doc for your task first

Before you start one of these tasks, read the doc beside it:

| Task                                                                                         | Doc                                     |
| -------------------------------------------------------------------------------------------- | --------------------------------------- |
| Write or change TSL, uniforms, materials, shader hooks, the renderer, or the output stage    | `docs/agents/tsl.md`                    |
| Write or edit code in `packages/` or `apps/`                                                 | `docs/agents/code-style.md`             |
| Work in `apps/docs`, add a component, or pick gradient colors                                | `docs/agents/docs-site.md`              |
| Change a dependency, a tsconfig, `turbo.json`, or a workflow, fix a CI failure, or publish   | `docs/agents/build-and-ci.md`           |
| Run `pnpm snap` or Playwright, or fix a failing visual spec                                  | `docs/development/visual-regression.md` |
| Finish a branch: run the reviews, write the PR body, or resolve bot findings                 | `docs/agents/pull-requests.md`          |

Code comments cite gotchas by name, such as "the vec-uniform gotcha". To find one, search `docs/agents/` for the name.

## Build shaders in gated phases

Shaders doubles as the author's shader-learning project. When you build or rebuild a shader, work in small phases. End each phase at something the author can open in the docs site, then stop: show the diff, explain the new TSL and GPU concepts, and wait for the author to react in the dev server. This rule overrides any continuous-execution default in your harness. A clean compile is not approval. `docs/agents/tsl.md` has the full process.

## Git

- Put every change on a branch and open a PR, including a one-line doc fix. Never push to `main`. If a commit lands on local `main`, move it to a branch and reset `main` to `origin/main`.
- When you finish a branch, push it and open a PR. Don't merge locally, and don't ask which integration option to use.
- Write commit messages as Conventional Commits, such as `feat(shaders): …` or `docs: …`. The scope is the package name without `@camp-dev/`. Use no emojis.
- Leave AI attribution off commits and PR bodies: no "Generated with" line and no `Co-Authored-By` trailer for an agent.
- Before a PR opens, run its body, the commit messages, any changeset, and any docs through the `technical-writing` skill, as `docs/agents/pull-requests.md` describes.

## Scope

These are planned for v2 or later, even where they would be easy: image and video filters, particle systems, 3D objects and materials, text effects, Vue and Svelte bindings, a hosted registry endpoint, audio-reactive primitives, a built-in animation library, CSS custom-property theming, and per-component material hooks. Shaders accepts MotionValue-shaped signals in place of an animation library.

The author picks the docs site's hosting platform at deploy time. Ask rather than recommend one.

## Agent skills

This repo uses the mattpocock skill set: `ask-matt` routes to the right skill, `tdd` runs test-first work, and `diagnosing-bugs` runs diagnosis. `docs/development/agent-setup.md` covers installing it.

### Issue tracker

Linear, on the Shaders team, with the `SHA-` prefix, reached through the Linear MCP server. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles keep their default names as Linear labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and one `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Repo-local skills

`react-doctor` and `resolve-pr-feedback` live in `.claude/skills/`, with a plain copy in `.agents/skills/` for Codex. When you edit one, copy it to both. `diff -rq .claude/skills .agents/skills` should print nothing.

## Keep this file small

`CLAUDE.md` imports this file, and every agent loads it on every turn. Session memory does not sync across machines, so record a durable preference or gotcha in the doc under `docs/agents/` that owns its topic. Add a line here only when every task needs it.
