---
id: SEED-001
status: dormant
planted: 2026-06-04
planted_during: MAT-7 (linear-gradient fix and review)
trigger_when: A second cursor-reactive component lands in registry/, OR the next time ShaderScene's prop API changes
scope: Medium
---

# SEED-001: Scene-level shared cursor signal

## Why This Matters

Today, every cursor-reactive component (`LinearGradient`, `DotField`, `WaveLines`, etc.) instantiates its own `CursorInput` via `useCursor()`. Each instance attaches its own pointer listeners and ticks on its own RAF/scheduler client, even when they're siblings inside the same `<ShaderScene>` watching the same canvas.

Two consequences:
1. **Runtime waste** — N components in one scene means N `CursorInput` instances doing the same pointer-tracking math. Currently masked because no scene uses more than one cursor-reactive component, but the cost compounds as the library grows.
2. **API noise** — every cursor-aware component carries an `interactive: boolean` prop (and the old `inputs.cursor` escape hatch, dropped in MAT-7). The prop is a per-component opt-in for what should be a scene-wide concern: "does this scene react to the cursor?"

The cleaner shape:
```tsx
<ShaderScene interactive>
  <LinearGradient />   {/* implicit: consumes scene cursor */}
  <DotField />         {/* same signal, same instance */}
</ShaderScene>
```

`interactive` lives on the scene. Components consume an implicit `useSceneCursor()` from context. Per-component opt-out remains possible if needed (default: consume; explicit `interactive={false}` to ignore).

## When to Surface

**Trigger:** A second cursor-reactive component lands in registry/, OR the next time ShaderScene's prop API changes.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Adding a new cursor-reactive component to `registry/`
- Any planned change to `<ShaderScene>`'s prop API
- A "matter-react core" or "scene API" milestone
- Performance-focused milestones touching the React binding

## Scope Estimate

**Medium** — touches `@lovo/matter-react` core (new context value on `<ShaderScene>`, new `useSceneCursor()` hook, deprecation path for `useCursor()` direct callers) plus migration in every cursor-aware registry component. Not a one-afternoon task, not a full milestone — probably 2–3 phases: (1) add scene-cursor primitive, (2) migrate registry components, (3) deprecate per-component `interactive` prop with a clean fallback.

## Breadcrumbs

Related code in the current codebase:

- [packages/matter-react/src/components/shader-scene/shader-scene.tsx](packages/matter-react/src/components/shader-scene/shader-scene.tsx) — where the `interactive` prop would land
- [packages/matter-react/src/hooks/use-cursor/use-cursor.ts](packages/matter-react/src/hooks/use-cursor/use-cursor.ts) — current per-component hook (would become `useSceneCursor()`-backed)
- [packages/matter/src/inputs/cursor-input/cursor-input.ts](packages/matter/src/inputs/cursor-input/cursor-input.ts) — the engine-side input that gets instantiated N times today
- [registry/linear-gradient/linear-gradient.tsx](registry/linear-gradient/linear-gradient.tsx) — example consumer (MAT-7 deliverable)
- [registry/dot-field.tsx](registry/dot-field.tsx) — example consumer
- [registry/wave-lines/wave-lines.tsx](registry/wave-lines/wave-lines.tsx) — example consumer

## Notes

Surfaced during MAT-7 (linear-gradient fix and review). The user asked why every component carries its own `interactive` prop and `cursor` plumbing — the right answer is "it shouldn't, the scene should own it," but doing the refactor inside MAT-7 would balloon the branch. Parked here instead.

Per MAT-7 decisions: `inputs.cursor` was dropped (no consumers); `interactive: boolean` was kept per-component pending this seed's resolution.
