# Version control

Read this before you commit, branch, push, or open a PR. The `gitbutler` skill has the `but` command recipes. This doc has the repo's rules for using them.

## Share one workspace

The main checkout runs in GitButler workspace mode. `HEAD` is `gitbutler/workspace`, a merge commit that GitButler rebuilds from every applied branch. Several agents can edit this one folder at the same time, and each session commits its own changes to its own branch.

- Make every version-control write through `but`: commit, amend, branch, push, and PR. GitButler's `pre-commit` hook rejects `git commit` on `gitbutler/workspace`. A `git checkout` or `git switch` takes the whole checkout out of workspace mode, for every agent at once. Read-only Git commands such as `git log`, `git diff`, `git show`, and `git blame` are fine.
- Give each session one branch. Take its name from the Linear ticket, such as `hunter/sha-180-build-the-components-index-cards`, or use `hunter/<slug>` when there is no ticket. Create it with the first commit: `but commit -b <branch> -m "<message>" <ids>`.
- Commit only the files and hunks your session changed. Pass their IDs from `but diff`. Leave other agents' uncommitted changes and branches alone, even when they sit in a file you also edited.
- When `but commit` refuses because your change builds on another branch's commits, stack your branch on that branch: `but move <your-branch> --above <other-branch>`.
- Update from `main` with `but pull`. It rebases every applied branch, so run `but pull --check` first, and ask before a pull that would conflict with another agent's branch.
- To recover from a bad history edit, use `but undo` or `but oplog restore`. Don't pile more edits on top of the bad one.

## Finish a branch

Finishing a branch means pushing it and opening a PR. This rule overrides any global GitButler instruction that says not to push or open PRs without being asked.

1. Commit to your branch, then run the reviews in `docs/agents/pull-requests.md` against that branch.
2. Open the PR with `but pr new <branch> -F <body-file>`. It pushes the branch first. For a stack, `but pr new <top-branch>` opens a PR for each branch and sets each PR's base.
3. Never run `but land`. `main` changes only through merged PRs.

## Review a branch, not `HEAD`

`HEAD` holds every applied branch, so a diff against `HEAD` mixes your work with every other agent's. Name your branch instead:

```bash
git diff origin/main...<branch>
git log --oneline origin/main..<branch>
```

The branch holds only committed work, so commit before you review.

Local checks read the working tree, not a branch. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm exec fallow audit`, and Playwright all see every applied branch at once. A branch can pass locally only because another branch supplies a symbol it imports. CI checks each PR alone, so it catches that case. If CI reports a missing export that exists locally, stack your branch on the branch that adds it.

## Use a worktree when a task needs isolation

Use a separate worktree only for these tasks:

- Competing attempts at the same task.
- Regenerating visual baselines while another applied branch changes the pages the spec renders. `pnpm snap` captures whatever the working tree renders.
- A dependency upgrade that changes behavior, because `pnpm install` rewrites `node_modules` for every agent.

Create the worktree from `origin/main`, never from `HEAD`. `HEAD` is the workspace commit, and GitButler's `post-checkout` hook removes GitButler's hooks for the whole repo when a checkout leaves that commit. `but commit` does not work in a linked worktree, so use plain Git there.

```bash
git worktree add .worktrees/<name> -b <branch> origin/main
cd .worktrees/<name> && pnpm install
```

After the PR merges, run `git worktree remove .worktrees/<name>`.
