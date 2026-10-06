# Set up coding agents on a new machine

The repo carries its own agent guide and one skill. Everything else lives at user scope and has to be installed on each machine.

## What arrives with the clone

- `AGENTS.md` at the repo root. `CLAUDE.md` imports it, so Claude Code, Codex, and OpenCode read the same file.
- The `react-doctor` skill, in `.claude/skills/` with a plain-copy mirror in `.agents/skills/` for Codex. It calls `pnpm exec react-doctor` instead of the upstream `npx` on purpose, and its `SKILL.md` says why.

## Install the user-scope skills

1. Install the mattpocock skill set with `npx skills@latest add mattpocock/skills -g`. Take the `engineering` and `productivity` groups, and skip `in-progress` and `misc`. Also skip `pr`, because its PR-body template conflicts with the one in `docs/agents/pull-requests.md`.
2. Run `setup-matt-pocock-skills` once. It reads and writes the `## Agent skills` block in `AGENTS.md` and the three files in `docs/agents/` that block points to.
3. Install Fallow's `fallow` and `fallow-review` skills and the `fallow-mcp` server at user scope. The `fallow` CLI arrives with `pnpm install` as a root devDependency.
4. Install the `technical-writing`, `unslop`, `design-engineering`, `resolve-pr-feedback`, and `watch-pr` skills into `~/.claude/skills/`, and into `~/.agents/skills/` for Codex. `design-engineering` builds on Emil Kowalski's animations.dev skills, which are also local.
5. Install the GitButler CLI with `curl -fsSL https://gitbutler.com/install.sh | sh`, then its `gitbutler` skill with `but skill install --global`. Run `but config forge auth` so `but pr` can open pull requests.

## Put the checkout in GitButler workspace mode

Run `but setup` once in the main checkout. It switches the checkout to `gitbutler/workspace` and installs the `pre-commit` and `post-checkout` hooks that `docs/agents/version-control.md` describes. To go back to plain Git, run `but teardown`, but only when no other agent is working in the checkout. It checks out a branch, which takes the checkout out of workspace mode for every session.

## Keep the local patches through an update

Four mattpocock skills are edited away from upstream on the author's machine. The edited copies live in the author's `campdotdev/agent-config` repo, which links them over the `npx skills` install. After an update, its `scripts/link.sh` puts them back over anything the update replaced. That repo's README has the update steps.

- `implement` runs `/code-review` as its local review, as `docs/agents/pull-requests.md` describes, and it commits before reviewing rather than after. In a GitButler workspace, it names the branch to review.
- `implement-spec` keeps its integration branch, its ticket branches, and its merges in worktrees when the checkout is a GitButler workspace. `docs/agents/version-control.md` lists it among the tasks that get a worktree.
- `code-review` reviews a named branch instead of `HEAD`, because `HEAD` in a GitButler workspace merges every applied branch.
- `code-review` no longer reads a bare `#<n>` as a ticket ID. Squash merges put the GitHub PR number in the commit subject, and those numbers collide with live `SHA-` issues, so the skill once resolved the wrong spec without any error.
- `grill-with-docs` closes each session with a walkthrough of the decisions, with real before-and-after code.
