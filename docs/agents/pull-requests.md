# Pull requests and review

Read this when you finish a branch: before you run the reviews, write the PR body, or work through review-bot findings.

## Write a short, why-led PR body

Structure the body with real markdown headings, so a reviewer can find the part they care about without reading end to end:

- `## Why`: one or two sentences of motivation.
- `## What changes`: the changes, grouped by concept rather than by commit. With more than one concept, give each its own `###` and one paragraph. A concept that needs two paragraphs is two concepts, or one of the paragraphs is history.
- `## Known limitations`, only when there are some.

Frame each change by why it matters. Use bullets only where the items really are a list. Leave out test plans, follow-up lists, and links to planning artifacts such as `.planning/` or memory files. The prose should sound like a person wrote it.

The body you write has a ceiling of 400 words, and a typical feature PR wants about 250. A review bot's summary comment doesn't count. The ceiling is not a target and 250 is not a floor: a one-line doc fix can take forty words. Past 400, something in the body is not for the reviewer. Two cuts keep it under:

- Mention a rejected alternative only when a reviewer would otherwise propose it. Dead ends from the session are debrief, not review material.
- When the reasoning is already in the diff, in a code comment, a doc, or a changeset, write "documented in X" and stop. A second copy drifts from the first.

## Run the prose pass

Run PR bodies, commit messages, changesets, and docs through the `technical-writing` skill before the PR opens. It applies `unslop` for AI-writing patterns. Look for it in `.claude/skills/`, then in your harness's skill directory, which is `~/.claude/skills/` for Claude Code. It sets `disable-model-invocation: true`, so an agent that honors that field never loads it on its own. Read its `SKILL.md` and work through the review checklist at the end. A PR body skips only the Diátaxis layer.

## Review in order

Six reviewers run on every change: two locally before the push, and four on the pull request. A seventh joins the local set on wide or multi-commit branches. Each answers a different question, so none replaces another.

| When                               | Reviewer                      | What it checks                                                         |
| ---------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| Uncommitted work, during the build | `/ocr-delegate-review`        | Workspace mechanics, including untracked files, with per-file coverage |
| After the commit, before the push  | `/code-review`                | The repo's documented standards, and the diff against its ticket       |
| Wide or multi-commit branches      | `/ocr-delegate-review-branch` | Every file the branch touches, across all its commits                  |
| After the push                     | Greptile                      | The pull request                                                       |
| After the push                     | Codex                         | The pull request                                                       |
| After the push                     | Copilot                       | The pull request                                                       |
| After the push                     | React Doctor                  | The pull request                                                       |

The `implement` skill runs the three local reviewers in that order. The order matters: `/code-review` and `/ocr-delegate-review-branch` both resolve git refs, so running either before the commit reviews the previous state and misses the new work.

Open Code Review supplies deterministic file selection and a coverage checklist, and the agent does the review itself through the `open-code-review-delegate` skill. The repo has no `rule.json` for it, so it reviews against its own defaults as the generic mechanics pass. Repo conventions are `/code-review`'s job.

## Run Fallow before the push

Fallow is installed at user scope, not in the repo: the `fallow` CLI, the `fallow` and `fallow-review` skills, and the `fallow-mcp` server. Its config is `.fallowrc.json` at the repo root. It is a deterministic check, not a reviewer, so `implement` does not run it.

- Before the push, run `fallow audit --base origin/main`. It reports the dead code, complexity, and duplication the branch adds, and exits 1 on a fail verdict.
- To review a diff or a pull request, load the `fallow-review` skill.
- Before you delete code that Fallow reports as unused, run `fallow dead-code --trace <file>:<export>` to confirm nothing reaches it.

## Work through bot findings with `resolve-pr-feedback`

After the bots post, run the `resolve-pr-feedback` skill rather than reading comments by hand. The bots split their findings across inline threads, issue comments, and review bodies, and the skill's registry knows where each one puts them. It proposes each fix for approval, applies and validates the approved ones, then commits, pushes, and resolves the threads. Check every finding against the gotchas in `docs/agents/` before you accept it.
