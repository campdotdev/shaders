# React Doctor local triage playbook

Use this playbook when a user asks a coding agent to scan, triage, or fix React Doctor findings. Do not assume continuous integration (CI) or GitHub automation exists. Follow repository instructions and preserve all preexisting user changes.

## 0. Agree on scope and delivery

Inspect `git status --porcelain=v1` and the repository instructions before editing.

Choose a scan scope:

| Intent                                       | Flags                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| Uncommitted files, including untracked files | `--scope files --base HEAD --include-untracked`                         |
| Changes introduced by the branch             | `--scope changed --include-untracked` plus an explicit or verified base |
| Entire selected project                      | `--scope full`                                                          |

Honor an explicit user scope even when the tree is clean. For a monorepo, select the requested package with `--project`; otherwise use the package the user is editing.

Choose a delivery mode before external mutations:

- **Working tree (default):** leave unstaged local edits. Do not commit, push, or create GitHub artifacts.
- **Pull request (PR) mode:** only when explicitly selected. This creates branches, commits, pushes, PRs, labels, and one tracking issue. Require authenticated `gh`, a clean base worktree, and an up-to-date default branch.

In PR mode, resolve the target branch and base SHA before scanning. Run the initial scan from an isolated worktree at that exact SHA. Use the same base for every bucket, manifest, permalink, and integration rescan.

## 1. Establish a baseline

Create a fresh run directory and never reuse global diagnostic or prompt files from an earlier run:

```bash
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/react-doctor.XXXXXX")"
```

Inspect `--version` and `--help` before selecting an executable. Require support for every requested flag. Prefer a compatible project-local React Doctor; otherwise resolve one supported version once. Use the same pinned command for scan, `why`, `rules explain`, and every rescan. Require JavaScript Object Notation (JSON) `schemaVersion === 3`. Stop with a version mismatch before reading report fields when another schema is returned.

Run the selected scan with JSON output and a nonblocking exit policy:

```bash
PROJECT_ROOT="$PWD"
REACT_DOCTOR_VERSION="resolved_version_here"
DOCTOR=(npx -y "react-doctor@$REACT_DOCTOR_VERSION")
SCOPE_ARGS=(--scope files --base HEAD --include-untracked)
PROJECT_ARGS=()
"${DOCTOR[@]}" --json --blocking none --yes "${SCOPE_ARGS[@]}" "${PROJECT_ARGS[@]}" > "$RUN_DIR/initial.json"
```

This block shows the pinned-package fallback. For a compatible project-local executable, resolve its absolute path from `PROJECT_ROOT` and assign `DOCTOR=("$PROJECT_LOCAL_DOCTOR")`. Do not assume the binary is installed at the repository root. Set `SCOPE_ARGS` from the selected scope table. In a monorepo, update `PROJECT_ROOT` to the selected package path and set `PROJECT_ARGS=(--project "$PROJECT_ROOT")`.

Parse the report even if the process exits nonzero. A scan is usable only when the JSON parses and `ok === true`. On failure, report the JSON error message and chain; JSON-mode failures may be written to stdout.

For a partial scope, independently determine whether the selected project contains changed supported source files. If none exist, report **Skipped: no applicable source files in the selected scope**. This is neither a clean React scan nor an incomplete scan. Treat a missing project as incomplete only when eligible files were expected.

Do not call an empty diagnostic list clean unless all of these hold:

- React was not explicitly undetected.
- Every selected project is present and complete.
- The requested lint coverage completed.
- No required check was unexpectedly skipped.
- The baseline is not degraded.
- At least the expected project and file scope was analyzed.

Otherwise report an incomplete scan and its exact coverage reason. Record the version, schema version, selected projects, command, coverage state, and the initial `summary.score`. Never reconstruct the score manually.

Before editing, run the same repository-mandated test, typecheck, lint, and format-check suite that final validation will use. Record each command, exit status, and failure fingerprint. A later failure is caused by the bucket only when it is new or worsened; unchanged failures remain explicitly preexisting. If the full baseline cannot run, do not attribute a later full-suite failure to the edit.

## 2. Build evidence-backed work items

Read `projects[].diagnostics`, not only a flattened top-level array. Identify each occurrence by project root, normalized path, rule key, diagnostic id, and location. Group occurrences sharing `fixGroupId` so one root-cause fix is not applied repeatedly.

Read `.react-doctor/false-positives.md` when present. A suppression is valid only when every documented predicate is observed. Record the file, line, predicate, and the read or search evidence. For ambiguity, use the pinned command with project identity: `"${DOCTOR[@]}" why --cwd "$PROJECT_ROOT" "$NORMALIZED_PATH:$LINE_NUMBER"` or the exact `--project` selection. Never resolve a flattened monorepo path from the repository root.

Fetch canonical guidance once per unique rule into the fresh run directory. Build `PLUGIN` and `RULE` from the occurrence key:

```bash
RULE_URL="https://www.react.doctor/prompts/rules/$PLUGIN/$RULE.md"
RULE_TMP="$RUN_DIR/$PLUGIN-$RULE.tmp"
RULE_FILE="$RUN_DIR/$PLUGIN-$RULE.md"
HTTP_STATUS="$(curl --silent --show-error --location --header "Cache-Control: no-cache" --output "$RULE_TMP" --write-out "%{http_code}" "$RULE_URL")"
```

Require HTTP 200, verify the requested key and required headings, then atomically rename the temporary file. A 200 proves route availability, not detector-version parity. Compare published rule-set metadata with the scanner/plugin release. If they cannot be correlated, treat exact applicability as inconclusive and use matched local `rules explain` output. Treat outcomes separately:

- `200`: use `## Validation prompt` for applicability and `## Fix prompt` for this occurrence.
- `404`: record version drift; try the local `rules explain` output and diagnostic help.
- Transport, Transport Layer Security (TLS), or server error: report unavailable guidance; do not reuse stale data.

`## Repository-wide copy prompt` is not an occurrence-level recipe. Never paste it into a file, bucket, or single-diagnostic subtask.

For every surviving work item, record detector evidence, applicability facts, assumptions, missing evidence, the occurrence's proof class, and one outcome:

- **Confirmed failure:** the invariant or policy is established and violated.
- **Rejected:** a documented exception or false-positive predicate is proven.
- **Needs evidence:** named evidence can still be collected.
- **Unavailable:** required evidence cannot be collected in this run.
- **Waived with evidence:** the failure is established, but an authorized, scoped, evidenced exception applies. Record its authority and review or expiry condition. A waiver is not a pass or false positive.
- **Observation:** a preference or optional tradeoff is recorded without claiming a defect.

Design-tagged rules are disabled by default, but the tag is not a proof class. Some are creative-direction preferences; others are accessibility, behavior, compatibility, or performance risks. Follow the rule page's Assessment and Verify with metadata. Never auto-ship a creative-direction change without explicit design-review authorization, a supplied brief, rendered comparison, and local design-system context.

Performance findings are hypotheses unless the rule proves a correctness bug. Do not infer slowness from syntax. Establish whether the bottleneck is network/server, shipped JavaScript, React render/commit, effects, style/layout/paint, memory, or third party. Prefer production traces, field metrics, bundle evidence, or repeated controlled measurements appropriate to the claim.

Process confirmed errors before warnings. Within severity, use the rule priority/tier, security and correctness risk, `fixGroupId`, and dependency order. Missing priority is unranked and uses the engine's P3 fallback; it does not override occurrence severity. Do not prioritize by count alone.

## 3. Edit safely

Apply the smallest local change that fixes the confirmed root cause. Preserve behavior, public interfaces, accessibility, failure semantics, visual intent, and repository conventions.

Before each edit, retain the exact preimage of agent-owned hunks. In a dirty working tree, never use `git restore`, `git checkout --`, `git reset`, or whole-file replacement to undo work. Reverse only agent-owned hunks. If an agent hunk overlaps a preexisting user hunk and cannot be reversed safely, stop and report the overlap.

Do not suppress or disable a correctness rule merely to clear the report. For a design review, keeping an intentional pattern with documented evidence is a valid outcome.

Manifest and lockfile edits are allowed only when the confirmed canonical fix explicitly requires a dependency addition, removal, replacement, or upgrade. Use the repository package manager and defer risky major upgrades for human approval.

React-specific checks:

- Confirm framework and React version gates before using newer APIs.
- With React Compiler, confirm the component is compiled before changing memoization. Existing manual memoization may encode observable identity or comparator behavior; remove it only with focused testing.
- Do not claim `startTransition` debounces, cancels network work, moves computation off-thread, or reduces total work.
- Do not use hydration-warning suppression as a flicker fix.

React Native preflight:

- Read the manifest, lockfile, app configuration, React Native and Expo versions, New Architecture status, Reanimated major, list-library major, and affected platform files.
- Defer a fix that needs an absent native dependency, linking, Pods, Gradle changes, or an architecture migration unless the user authorized that scope.
- Do not batch navigation, gesture, safe-area, native dependency, or native configuration changes as mechanical file-local edits.
- Verify gesture semantics, navigation, keyboard behavior, safe areas, linkage, and performance on proportional release-build devices; report unavailable platforms.

When batching local work, partition by proven file ownership and dependency order. Concurrent writers must never share a file.

PR-mode parallelism requires a separate `git worktree` directory per bucket. Compute file overlap first. Assign an overlapping file to one bucket or make the buckets an ordered dependency chain; category buckets are not inherently file-disjoint.

## 4. Verify the outcome

A finding counts as fixed only when all applicable checks pass:

1. Focused tests for the changed behavior.
2. The repository-mandated typecheck, lint, test, and formatting checks.
3. A React Doctor rescan using the same executable version, scope, projects, and original categories to prove the target disappeared.
4. A separate unfiltered regression scan over the affected projects or files to prove no cross-category diagnostic was introduced. If only a filtered scan is available, say “no new diagnostic in the selected categories.”
5. Runtime, rendered, accessibility, or performance evidence required by the claim was actually collected.

Prefer a nonmutating format-check command. If repository instructions require a mutating formatter, limit it to agent-touched files where possible, inspect its diff, and attribute every extra change. Never run a repository-wide mutating formatter over unrelated dirty work without approval.

For visual changes, inspect the affected state at relevant viewport, theme, input, reduced-motion, zoom/reflow, and right-to-left (RTL) settings where applicable. If a check could not run, mark it **not run**; never convert unavailable evidence into a pass.

Use the final successful report's `summary.score` as the after score. Label every score with its scanner version, project, scope, and category selection. Never compare scores from different selections. In PR mode, claim a combined projected score only after applying all candidate patches to a temporary integration worktree and rescanning it. Otherwise report verified diagnostic counts and omit the projection.

## 5. Deliver

### Working-tree mode

Leave changes unstaged. Summarize:

- Scan version, scope, selected projects, and coverage state.
- Confirmed fixes, rejected false positives with evidence, inconclusive items, and safe rollbacks.
- Initial and final scanner-reported scores when both scans used the same complete selection.
- Changed files and checks run, including explicit not-run checks.

### PR mode

Use one isolated worktree per file-disjoint bucket. Include machine-readable ownership, bucket, base-SHA, and diagnostic-manifest markers in each PR body. Carry a prior PR forward only when its open state, exact head, base SHA, ownership marker, bucket marker, and diagnostic manifest match.

Create missing labels without `--force`; never overwrite an existing label's metadata. Mutate only PRs and issues carrying this workflow's ownership marker. If multiple owned tracking issues exist, report the conflict.

If push succeeds but PR creation fails, preserve and report the remote branch and recovery path. Do not call the bucket completed or silently delete the branch.

Before committing, compare the worktree diff with the bucket's diagnostic and collateral manifest. Stop on unexplained files. Stage explicit paths or hunks; never use `git add -A` or `git add .`. Recheck the staged diff before committing.

The tracking issue is a live dashboard of verified open PRs, not a score projection. Close it only when no owned PR remains open. A clean run with no open PR needs no fabricated tracking-issue link.

## Stop conditions

Item-local uncertainty, sensitivity, or missing evidence defers only that item; continue with independent work. Stop the whole run when a blocker invalidates scan coverage, shared ownership, dependency order, or authority for all remaining work. Also stop when edits overlap user work unsafely or a remote mutation partially succeeds. Do not turn uncertainty into a suppression, fix, pass, score, or PR.
