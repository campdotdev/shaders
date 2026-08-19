# Issue tracker: Linear

Issues and specs for this repo live in Linear, on the **Matter** team, with the `MAT-` identifier prefix. Reach Linear through the Linear MCP server, not a CLI. There is no `linear` binary here, and the MCP tools are the only supported path.

Skills from the mattpocock set look for this file. It is the hand-written Linear equivalent of the `issue-tracker-github.md` template that ships with `setup-matt-pocock-skills`, which covers only GitHub, GitLab, and local markdown.

## Conventions

- **Create an issue**: `mcp__linear__save_issue` with `team: "Matter"` and a `title`. Omit `id` when creating. Pass the body as `description` in Markdown, with literal newlines rather than escape sequences.
- **Read an issue**: `mcp__linear__get_issue` with the identifier, such as `MAT-104`. Pass `includeRelations: true` whenever blocking edges matter, because relations are omitted by default.
- **List issues**: `mcp__linear__list_issues`, filtered by `team`, `state`, `assignee`, `label`, or `parentId`.
- **Comment**: `mcp__linear__save_comment`.
- **Read comments**: `mcp__linear__list_comments`.
- **Apply labels**: `mcp__linear__save_issue` with `labels`. See the label trap below before you use it.
- **Close**: `mcp__linear__save_issue` with `state: "Done"`, or `state: "Canceled"` when the work is being dropped rather than finished.

### Three traps

1. **`labels` replaces the entire label set.** It is not additive. An issue carrying `Feature` that you save with `labels: ["wayfinder:map"]` loses `Feature`. Read the current labels with `get_issue` first, then pass the union. Omitting `labels` leaves them untouched, which is what you usually want.
2. **`blocks` and `blockedBy` are append-only.** Saving them never removes an existing edge. Use `removeBlocks` and `removeBlockedBy` to drop one.
3. **Linear has no open or closed flag.** It has workflow states with a type. On this team the states are `Backlog` (backlog), `Todo` (unstarted), `In Progress` (started), `In Review` (started), `Done` (completed), `Canceled` (canceled), and `Duplicate` (duplicate). Treat backlog, unstarted, and started as open. Treat completed and canceled as closed.

## When a skill says "publish to the issue tracker"

Create a Linear issue on the Matter team.

## When a skill says "fetch the relevant ticket"

Call `get_issue` with the `MAT-` identifier, then `list_comments` for the discussion.

## Wayfinding operations

Used by `/wayfinder`. The **map** is one issue, and its tickets are child issues of it.

**Prerequisite.** The five labels wayfinder needs do not exist on this team yet. The Matter team currently carries only `Improvement`, `Feature`, and `Bug`. Create `wayfinder:map`, `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, and `wayfinder:task` with `mcp__linear__create_issue_label` before charting a first map.

- **Map**: one issue labelled `wayfinder:map`, holding the Destination, Notes, Decisions-so-far, Not-yet-specified, and Out-of-scope body. Create it with `save_issue`, passing `team: "Matter"` and `labels: ["wayfinder:map"]`.
- **Child ticket**: an issue created with `parentId` set to the map's identifier, which makes it a Linear sub-issue and renders under the map in Linear's own UI. Label it `wayfinder:<type>`, one of `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- **Blocking**: Linear's native issue relations, which render as a visible blocked banner in the UI. Wire an edge with `save_issue` on the blocked ticket, passing `blockedBy: ["MAT-123"]`, or from the other side with `blocks`. Create the issues first and wire the edges in a second pass, because both ends need identifiers before they can reference each other. A ticket is unblocked when every issue blocking it sits in a closed state.
- **Frontier query**: `list_issues` with `parentId` set to the map, then keep the ones whose state is open, whose `assignee` is empty, and which `get_issue` with `includeRelations: true` shows has no open blocker. First in map order wins.
- **Claim**: `save_issue` with `assignee: "me"`. This is the session's first write, before any other work, so a concurrent session skips the ticket.
- **Resolve**: post the answer with `save_comment`, set the ticket to `state: "Done"`, then append a context pointer to the map's Decisions-so-far.

### Appending to the map without rewriting it

`save_issue` takes a `patch` array that applies edits atomically against the current description, which avoids re-sending the whole map body and avoids clobbering a concurrent session's edit. Anchor on the heading:

```json
{
  "id": "MAT-000",
  "patch": [
    {
      "op": "insert_after",
      "anchor": "## Decisions so far",
      "text": "\n\n- [Ticket title](url): one-line gist of the answer"
    }
  ]
}
```

Every anchor must match the current content exactly once, and one failing operation aborts the whole save.

## Scope note

Linear is the only place for project management and tracking, per AGENTS.md. Wayfinder decision tickets live alongside feature tickets on the same team, so close them as they resolve. A decision ticket left open after its answer landed is the same failure as a stale status section in a spec.
