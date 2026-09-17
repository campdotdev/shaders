# Domain docs

How the engineering skills consume this repo's domain documentation. The layout is single-context: one `CONTEXT.md` and one `docs/adr/`, both at the repo root.

## Read these before you explore

- `CONTEXT.md` at the repo root. It defines the domain terms this project uses.
- `docs/adr/`. Read the records that touch the area you are about to change.

If either is missing, continue without comment. Do not flag the absence, and do not propose creating either up front. The `domain-modeling` skill creates them when a term or a decision actually resolves. `grill-with-docs` and `improve-codebase-architecture` both reach it.

## Check the spec before you write an ADR

`docs/superpowers/specs/` holds one spec per feature, and each spec ends with an Appendix A recording its decision history. Read the relevant spec first. If Appendix A already answers the question, cite the spec instead of copying the answer into `docs/adr/`.

`docs/superpowers/` is gitignored, so it is absent on a fresh clone. When it is absent, `docs/adr/` is the only decision record available.

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
