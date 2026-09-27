#!/usr/bin/env bash
# Waits until Copilot has reviewed the current head commit of a pull request,
# then prints the verdict heading from its review overview and exits. The
# watch-pr skill runs this between rounds of resolve-pr-feedback, so each round
# starts from a review of the code it is about to change.
#
# Usage: wait-for-copilot.sh <pr-number>
#
# Exit codes, each with one line on stdout:
#   0  "reviewed <sha>: <verdict>", such as "🟢 Approval recommended"
#   2  "timeout: ...", no review of the head arrived in time
#   3  "stopped: ...", the pull request was merged or closed

set -u

PR="$1"

# Copilot took 5 to 7 minutes per review on PRs #188 and #202. Thirty minutes
# covers a slow queue. Raise it if reviews start timing out, lower it to hear
# about a missing review sooner.
WAIT_MINUTES=30

# Seconds between checks. Each check makes two GitHub API calls.
POLL_SECONDS=60

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
DEADLINE=$(($(date +%s) + WAIT_MINUTES * 60))

while :; do
  # Read the head on every check rather than once, so a push that lands while
  # this waits moves the target to the new commit instead of timing out.
  PR_INFO=$(gh pr view "$PR" --json state,headRefOid -q '.state + " " + .headRefOid' || true)
  STATE=${PR_INFO%% *}
  SHA=${PR_INFO##* }

  if [ "$STATE" = MERGED ] || [ "$STATE" = CLOSED ]; then
    echo "stopped: PR #$PR is $STATE"
    exit 3
  fi

  # Copilot always submits its review as COMMENTED, never APPROVED, so the
  # verdict lives in the overview's first "### " heading. Print one
  # "<commit> <verdict>" line per Copilot review, then keep the last one whose
  # commit is the head. A failed API call prints nothing, and the loop tries
  # again on the next check.
  VERDICT=$(gh api "repos/$REPO/pulls/$PR/reviews" --paginate \
    --jq '.[] | select(.user.login == "copilot-pull-request-reviewer[bot]") | "\(.commit_id) \((.body | capture("### (?<v>[^\n]+)").v) // "no verdict")"' \
    | awk -v sha="$SHA" '$1 == sha { verdict = substr($0, length($1) + 2) } END { if (verdict != "") print verdict }')

  if [ -n "$SHA" ] && [ -n "$VERDICT" ]; then
    echo "reviewed $SHA: $VERDICT"
    exit 0
  fi

  if [ "$(date +%s)" -ge "$DEADLINE" ]; then
    echo "timeout: Copilot has not reviewed ${SHA:-the head} after $WAIT_MINUTES minutes"
    exit 2
  fi

  sleep "$POLL_SECONDS"
done
