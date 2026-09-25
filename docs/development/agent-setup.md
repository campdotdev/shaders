# Set up coding agents on a new machine

The repo carries its own agent guide and two skills. Everything else lives at user scope and has to be installed on each machine.

## What arrives with the clone

- `AGENTS.md` at the repo root. `CLAUDE.md` imports it, so Claude Code, Codex, and OpenCode read the same file.
- The `react-doctor` and `resolve-pr-feedback` skills, in `.claude/skills/` with a plain-copy mirror in `.agents/skills/` for Codex. `react-doctor` calls `pnpm exec react-doctor` instead of the upstream `npx` on purpose, and its `SKILL.md` says why.

## Install the user-scope skills

1. Install the mattpocock skill set with `npx skills@latest add mattpocock/skills -g`. Take the `engineering` and `productivity` groups, and skip `in-progress` and `misc`.
2. Run `setup-matt-pocock-skills` once. It reads and writes the `## Agent skills` block in `AGENTS.md` and the three files in `docs/agents/` that block points to.
3. Install Fallow at user scope: the `fallow` CLI, the `fallow` and `fallow-review` skills, and the `fallow-mcp` server.
4. Install the `technical-writing`, `unslop`, and `design-engineering` skills into `~/.claude/skills/`. `design-engineering` builds on Emil Kowalski's animations.dev skills, which are also local.

## Reapply the local patches after an update

Two mattpocock skills are edited away from upstream on the author's machine. Neither change syncs, and `npx skills update` overwrites both. The upstream originals are kept outside the repo with the install backup.

- `implement` adds the three local review passes listed in `docs/agents/pull-requests.md`, and it commits before reviewing rather than after.
- `code-review` no longer reads a bare `#<n>` as a ticket ID. Squash merges put the GitHub PR number in the commit subject, and those numbers collide with live `SHA-` issues, so the skill once resolved the wrong spec without any error.
