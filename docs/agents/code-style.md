# Code style

Read this before you write or edit code in `packages/` or `apps/`. ESLint, Prettier, and `tsc` enforce the mechanical rules. This file covers the conventions they cannot check.

## Components and props

- Destructure props in the component signature, and set defaults inline, as in `function MeshGradient({ speed = 2 }: MeshGradientProps)`. Order the destructured fields to match the interface.
- Name props with everyday words, not GPU jargon: `waviness` over `turbulence`, `coverage` or `radius` over `falloff`, and `balance` over `bias`. When two components share a concept, they share the name. `CONTEXT.md` defines the names for position props and reactions, such as `center` and `swellCenter`.
- Add only what the task needs. A prop that does nothing on a component, added so its API matches another's, is still a prop to document and maintain. Grain and Dither take no `colorSpace`, because neither computes a midpoint between colors.
- Use clear names over abbreviations such as `u`, `cfg`, `ctx`, or `cb`. Loop counters and math or shader locals that mirror the math, such as `x` and `y`, are the exceptions.
- Use no emojis in code, comments, or strings.

## JSDoc on every user-facing prop

`apps/docs/src/content/props.ts` fails the docs build when a prop on a `*Props` interface has no JSDoc. Write it on the wrapper's `*Props`, the `*ShaderProps` mirror, and nested types such as `WaveLine` and `ColorStop`.

Each comment says what the prop controls, what 0 and 1 mean for a normalized prop, and the units. Only the wrapper states the default, in a sentence that starts "Defaults to". The mirror leaves that sentence out. Every `AnimatableProp<T>` prop ends with the sentence "Accepts a static value or an animation signal." Plain props do not. `props.ts` strips both sentences from the API table, which shows them in their own columns, so keep each one a separate sentence.

## Comments

Comments explain the code, not the stack. The reader knows React and TypeScript, but not this codebase or GPU work. Every substantive file gets:

- A file-top summary of 2 to 5 lines: what the file is, why it exists, and how it connects to its neighbors. In a client component, put `'use client'` on line 1 and the summary under it.
- Section titles as a `// ----` divider plus a short plain-language title. In a shader they follow the pixel's journey. In an infrastructure file they follow the lifecycle.
- TSL math worked through, not labeled: the inputs, what the expression computes, how it behaves at 0, at 1, and at the extremes, and each trick named, such as aspect correction, a `oneMinus()` dial flip, or an epsilon.
- The job of each non-trivial effect or memo, never how the hook itself works.
- A short plain-words gloss the first time a GPU term appears in a file, so every file reads on its own.
- Each constant's units, and what turning it up or down does.

`packages/shaders/src/components/wave-lines/shader.tsx` and `packages/shaders/src/components/vignette/shader.tsx` are the models. Comment only what the code does not already say, and state only what you have checked against the code. To cite a gotcha, use its name and the file that holds it, as in "the vec-uniform gotcha in `docs/agents/tsl.md`".

## Tests

- Write tests first for Tier 2 primitives and CLI logic. The `tdd` skill runs the loop.
- For how a shader looks, the test is a docs demo plus a Playwright visual regression spec, described in `docs/development/visual-regression.md`. Leave the GPU unmocked, and leave "does this gradient look right" to the screenshot.
