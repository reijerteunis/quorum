#!/usr/bin/env bash
# Q-0009's freeze guard. No ticket in the port's set may modify or delete a file under
# spike/src/: the spike is the harness these fifteen tickets are developed with, and the port's
# only independent witness. See harness/port-charter.md §3 for the rule, the exemption path and
# the list of tickets this applies to — that file is the single source of truth, and the block
# it carries is parsed here rather than duplicated.
#
# The freeze has two halves and this guard reports them separately, because a check that skips
# its subject must not report success (DECISIONS, 2026-08-25):
#   branch-scope  — did this child's branch touch spike/src?      ACTIVE now.
#   freeze-SHA    — has main acquired a spike/src change since?   SKIPPED until a SHA is recorded.
#
# Usage: BRANCH=<ref-name> BASE=<base-branch> .github/scripts/port-freeze-guard.sh
# Exit 0 = the branch is clear or out of scope; exit 1 = the freeze is broken, or the guard
# could not answer. A guard that cannot answer fails closed; it never passes on ignorance.

set -uo pipefail

BRANCH="${BRANCH:?BRANCH is required (the ref being checked)}"
BASE="${BASE:-main}"
CHARTER="${CHARTER:-harness/port-charter.md}"

fail() { printf '::error::%s\n' "$1"; printf '\nport-freeze: FAILED — %s\n' "$1"; exit 1; }
note() { printf '::notice::%s\n' "$1"; }

# --- the policy, read from the charter -------------------------------------------------------
[ -f "$CHARTER" ] || fail "$CHARTER is missing, so the freeze policy cannot be read. The guard refuses to pass on a policy it cannot find."

block=$(sed -n '/port-freeze:begin/,/port-freeze:end/p' "$CHARTER")
children=$(printf '%s\n' "$block" | sed -n 's/^children:[[:space:]]*//p')
freeze_sha=$(printf '%s\n' "$block" | sed -n 's/^freeze-sha:[[:space:]]*//p')
trailer=$(printf '%s\n' "$block" | sed -n 's/^exemption-trailer:[[:space:]]*//p')

[ -n "$children" ] && [ -n "$freeze_sha" ] && [ -n "$trailer" ] || \
  fail "$CHARTER has no readable port-freeze block (need children, freeze-sha and exemption-trailer). The guard refuses to pass on a policy it cannot parse."

# --- is this branch in scope? ----------------------------------------------------------------
ticket=$(printf '%s\n' "$BRANCH" | sed -n 's|^harness/\(Q-[0-9][0-9]*\)/.*|\1|p')
if [ -z "$ticket" ]; then
  note "port-freeze: '$BRANCH' is not a harness/<ticket>/… branch — the freeze does not apply."
  exit 0
fi
case " $children " in
  *" $ticket "*) : ;;
  *)
    note "port-freeze: $ticket is not one of Q-0009's fourteen children — the freeze does not apply. Q-0038 and Q-0040 change spike/src legitimately."
    exit 0 ;;
esac

# --- can the guard answer at all? ------------------------------------------------------------
# A shallow clone or a missing base has no merge base, so the diff below would be empty for the
# wrong reason. Report that, do not read it as clean.
if [ "$(git rev-parse --is-shallow-repository 2>/dev/null)" = "true" ]; then
  fail "the repository is a shallow clone, so the diff against $BASE cannot be computed. An unanswerable check is not a clean one — run this job with fetch-depth: 0."
fi
git rev-parse --verify --quiet "$BASE" >/dev/null || \
  fail "base branch '$BASE' is not available in this checkout, so the diff cannot be computed."
merge_base=$(git merge-base "$BASE" HEAD 2>/dev/null) || merge_base=""
[ -n "$merge_base" ] || fail "no merge base between '$BASE' and HEAD, so the diff cannot be computed."

# The question this answers: what has *this branch* changed under spike/src since it forked from
# the base? Diffing from the merge base is that question — equivalently `$BASE...HEAD`. Diffing
# `$BASE HEAD` directly would be a different one, and would also report what the base changed,
# which is not this branch's doing. (Q-0034: before trusting a git command as evidence, state
# which question it answers.)
touched=$(git diff --name-status "$merge_base" HEAD -- spike/src) || \
  fail "git diff over spike/src failed, so the guard cannot answer."

# --- the branch-scope half: ACTIVE ------------------------------------------------------------
if [ -n "$touched" ]; then
  exemption=$(git log --format=%B "$merge_base..HEAD" | grep -m1 "^$trailer:" || true)
  if [ -n "$exemption" ]; then
    note "port-freeze: exemption honoured for $ticket — $exemption"
    printf '\nport-freeze: branch-scope EXEMPT. %s touches spike/src under a recorded exemption:\n  %s\nFiles:\n%s\n' \
      "$ticket" "$exemption" "$touched"
  else
    printf '\nFiles under spike/src changed by %s:\n%s\n' "$ticket" "$touched"
    fail "$ticket is one of Q-0009's fourteen port children, and the port freeze forbids it changing spike/src. The spike stays authoritative and green until the cutover — it is the harness these tickets run on and the port's only independent witness. See $CHARTER §3. If this change is genuinely required, add a commit trailer '$trailer: $ticket <why>' and it will be honoured."
  fi
else
  note "port-freeze: branch-scope clear — $ticket changed no file under spike/src."
  printf '\nport-freeze: branch-scope CLEAR for %s (no spike/src changes since %s).\n' "$ticket" "${merge_base:0:7}"
fi

# --- the freeze-SHA half: SKIPPED until a SHA exists -------------------------------------------
# Reported, never silently omitted. Silence must never render as a green tick.
if [ "$freeze_sha" = "not-yet-recorded" ]; then
  printf '::warning::port-freeze: the freeze-SHA half was SKIPPED, not passed — no freeze SHA is recorded in %s yet (Q-0037..Q-0040 are unsettled).\n' "$CHARTER"
  printf 'port-freeze: freeze-SHA SKIPPED — no SHA recorded in %s. This job did NOT verify that main is unchanged under spike/src since the port began; that half of the freeze is inert. It is not a pass.\n' "$CHARTER"
else
  printf 'port-freeze: freeze-SHA recorded as %s. Verifying it at the cutover is Q-0055 (CO-1), not this job.\n' "$freeze_sha"
fi

exit 0
