# Triage labels

The `triage` skill speaks in five canonical roles. This file maps each role to the label string used in Linear on the Shaders team.

| Role in the skills | Label in Linear   | Meaning                                       |
| ------------------ | ----------------- | --------------------------------------------- |
| `needs-triage`     | `needs-triage`    | A maintainer has not yet evaluated the issue   |
| `needs-info`       | `needs-info`      | Waiting on the reporter for more information   |
| `ready-for-agent`  | `ready-for-agent` | Fully specified, ready for an unattended agent |
| `ready-for-human`  | `ready-for-human` | Needs a human to implement it                  |
| `wontfix`          | `wontfix`         | Will not be actioned                           |

When a skill names a role, apply the matching label string from this table.

## Add a label with `addLabels`, never with `labels`

`mcp__linear__save_issue` treats `labels` as the issue's complete label set. An issue carrying `Feature` that you save with `labels: ["needs-triage"]` loses `Feature`. Pass `addLabels` instead, which appends and never removes. Use `removeLabels` to drop one.
