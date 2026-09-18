# Domain docs

How the engineering skills consume this repo's domain documentation. The layout is single-context: one `CONTEXT.md` and one `docs/adr/`, both at the repo root.

## Read these before you explore

- `CONTEXT.md` at the repo root. It defines the domain terms this project uses.
- `docs/adr/`. Read the records that touch the area you are about to change.

If either is missing, continue without comment. Do not flag the absence, and do not propose creating either up front. The `domain-modeling` skill creates them when a term or a decision actually resolves. `grill-with-docs` and `improve-codebase-architecture` both reach it.

## Check the existing record before you write an ADR

Read the decisions already made before you record a new one. If the question is answered, cite the answer instead of copying it into `docs/adr/`.

Two places hold that history:

- **Linear**, on the Shaders team, for anything specced since 2026-09-17. `to-spec` publishes the spec as an issue, so the decisions sit in the issue and its comments.
- **`docs/superpowers/specs/`**, for features that predate the switch. Every file there has a `## Decisions` section near the top, and files written before 2026-09-12 also close with `## Appendix A: decision history`, which holds the longer reasoning. Check both sections.

`docs/superpowers/` is frozen and gitignored, so it is absent on a fresh clone. When it is absent, Linear and `docs/adr/` are the only decision records available.

## File structure

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-<slug>.md
│   └── 0002-<slug>.md
├── packages/
└── apps/
```

## Use the glossary's vocabulary

When your output names a domain concept, use the term as `CONTEXT.md` defines it. This applies to issue titles, refactor proposals, hypotheses, and test names. Do not drift to a synonym the glossary avoids.

If the concept is not in the glossary, treat that as a signal. Either you are inventing language the project does not use, which is worth reconsidering, or there is a real gap worth noting for `domain-modeling`.

## Flag ADR conflicts

If your output contradicts an ADR, say so rather than overriding it silently:

> Contradicts ADR-0007 (event-sourced orders), but worth reopening because…
