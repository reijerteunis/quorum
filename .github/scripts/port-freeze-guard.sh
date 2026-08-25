#!/usr/bin/env bash
# Q-0009's freeze guard. No ticket in the port's set may modify or delete a file under
# spike/src/: the spike is the harness these fifteen tickets are developed with, and the port's
# only independent witness. See harness/port-charter.md §3 for the rule, the exemption path and
# the list of tickets this applies to — that file is the single source of truth, and the block it
# carries is parsed here rather than duplicated.
#
# The freeze has two halves, and they are *separate CI jobs* rather than two sections of one
# report, because a check that skips its subject must not report success (DECISIONS, 2026-08-25).
# A green tick is a claim, and one job cannot make it for a half it did not run:
#
#   branch-scope  did this child's branch touch spike/src?          ACTIVE — passes or fails.
#   freeze-sha    has the base acquired a spike/src change since?   Runs only once a SHA is
#                                                                   recorded in the charter; until
#                                                                   then its job is *skipped* by
#                                                                   the workflow, which GitHub
#                                                                   renders as skipped and not as
#                                                                   a pass.
#
# Usage:
#   HALF=policy       [CHARTER=…]                    .github/scripts/port-freeze-guard.sh
#   HALF=branch-scope BRANCH=<ref-name> [BASE=<ref>] .github/scripts/port-freeze-guard.sh
#   HALF=freeze-sha                     [BASE=<ref>] .github/scripts/port-freeze-guard.sh
#
# `policy` parses the charter and, when $GITHUB_OUTPUT is set, emits `freeze_sha=<value>` so the
# workflow can decide whether the freeze-sha job has a subject at all.
#
# Exit 0 = the half ran and the branch is clear, exempt or out of scope. Exit 1 = the freeze is
# broken, or the guard could not answer. A guard that cannot answer fails closed; it never passes
# on ignorance, and it never reports success for a half it did not perform.
#
# Every direction below is exercised by `node .github/scripts/port-freeze-guard.test.mjs`, which
# builds its own throwaway repository rather than leaving scratch branches in this one.

set -uo pipefail

HALF="${HALF:?HALF is required (policy | branch-scope | freeze-sha)}"
BASE="${BASE:-main}"
CHARTER="${CHARTER:-harness/port-charter.md}"

fail() { printf '::error::%s\n' "$1"; printf '\nport-freeze: FAILED — %s\n' "$1"; exit 1; }
note() { printf '::notice::%s\n' "$1"; }

# --- the policy, read from the charter -------------------------------------------------------
[ -f "$CHARTER" ] || fail "$CHARTER is missing, so the freeze policy cannot be read. The guard refuses to pass on a policy it cannot find."

block=$(sed -n '/port-freeze:begin/,/port-freeze:end/p' "$CHARTER" | tr -d '\r')
children=$(printf '%s\n' "$block" | sed -n 's/^children:[[:space:]]*//p')
freeze_sha=$(printf '%s\n' "$block" | sed -n 's/^freeze-sha:[[:space:]]*//p')
trailer=$(printf '%s\n' "$block" | sed -n 's/^exemption-trailer:[[:space:]]*//p')

[ -n "$children" ] && [ -n "$freeze_sha" ] && [ -n "$trailer" ] || \
  fail "$CHARTER has no readable port-freeze block (need children, freeze-sha and exemption-trailer). The guard refuses to pass on a policy it cannot parse."

# The trailer is interpolated into the exemption pattern below, so it has to be a plain token. A
# charter edit that made it `.*` would otherwise widen the exemption into a wildcard silently.
printf '%s' "$trailer" | grep -qE '^[A-Za-z][A-Za-z0-9-]*$' || \
  fail "exemption-trailer '$trailer' in $CHARTER is not a plain token ([A-Za-z][A-Za-z0-9-]*), and it is used as a pattern. The guard refuses a policy it cannot match literally."

# --- can the guard read enough git history to answer? -----------------------------------------
# A shallow clone or a missing base yields an empty diff for the wrong reason. Report that; never
# read it as clean. The shallow probe is itself three-valued — an unanswered probe is not a `false`
# (invariant 8: `shallowState()`, DECISIONS 2026-08-25).
require_history() {
  local shallow
  shallow=$(git rev-parse --is-shallow-repository 2>/dev/null) || shallow=""
  case "$shallow" in
    true)  fail "the repository is a shallow clone, so the diff against $BASE cannot be computed. An unanswerable check is not a clean one — run this job with fetch-depth: 0." ;;
    false) : ;;
    *)     fail "git could not say whether this is a shallow clone, so no diff computed here can be trusted. The guard refuses to answer from a repository it cannot characterise." ;;
  esac
  git rev-parse --verify --quiet "$BASE" >/dev/null || \
    fail "base branch '$BASE' is not available in this checkout, so the diff cannot be computed."
}

case "$HALF" in

# --- policy: what does the charter authorise? -------------------------------------------------
policy)
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf 'freeze_sha=%s\n' "$freeze_sha" >> "$GITHUB_OUTPUT"
  fi
  printf 'port-freeze: policy read from %s\n  children:          %s\n  freeze-sha:        %s\n  exemption-trailer: %s\n' \
    "$CHARTER" "$children" "$freeze_sha" "$trailer"
  if [ "$freeze_sha" = "not-yet-recorded" ]; then
    printf '\nport-freeze: the freeze-SHA half has no subject yet, so its job is SKIPPED — not passed.\nRecording a SHA in %s is what gives that half something to verify (Q-0037..Q-0040 must settle first).\n' "$CHARTER"
  fi
  exit 0 ;;

# --- branch-scope: ACTIVE ----------------------------------------------------------------------
branch-scope)
  BRANCH="${BRANCH:?BRANCH is required for the branch-scope half (the ref being checked)}"

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

  require_history
  merge_base=$(git merge-base "$BASE" HEAD 2>/dev/null) || merge_base=""
  [ -n "$merge_base" ] || fail "no merge base between '$BASE' and HEAD, so the diff cannot be computed."

  # The question this answers: what has *this branch* changed under spike/src since it forked from
  # the base? Diffing from the merge base is that question — equivalently `$BASE...HEAD`. Diffing
  # `$BASE HEAD` directly would be a different one, and would also report what the base changed,
  # which is not this branch's doing. (Q-0034: before trusting a git command as evidence, state
  # which question it answers.)
  touched=$(git diff --name-status "$merge_base" HEAD -- spike/src) || \
    fail "git diff over spike/src failed, so the guard cannot answer."

  if [ -z "$touched" ]; then
    note "port-freeze: branch-scope clear — $ticket changed no file under spike/src."
    printf '\nport-freeze: branch-scope CLEAR for %s (no spike/src changes since %s).\n' "$ticket" "${merge_base:0:7}"
    exit 0
  fi

  # An exemption is honoured only in its complete form: the trailer at column 0, *this branch's*
  # ticket id, and a non-empty reason. A bare `Port-freeze-exemption:` line, or one naming another
  # ticket, is not an exemption — it is a malformed one, and it is reported as such rather than
  # obeyed. Q-0009 review iteration 1.
  bodies=$(git log --format=%B "$merge_base..HEAD" | tr -d '\r')
  candidates=$(printf '%s\n' "$bodies" | grep -E "^${trailer}:" || true)
  exemption=$(printf '%s\n' "$bodies" | grep -m1 -E "^${trailer}:[[:space:]]+${ticket}[[:space:]]+[^[:space:]]" || true)

  if [ -n "$exemption" ]; then
    note "port-freeze: exemption honoured for $ticket — $exemption"
    printf '\nport-freeze: branch-scope EXEMPT. %s touches spike/src under a recorded exemption:\n  %s\nFiles:\n%s\n' \
      "$ticket" "$exemption" "$touched"
    exit 0
  fi

  printf '\nFiles under spike/src changed by %s:\n%s\n' "$ticket" "$touched"
  if [ -n "$candidates" ]; then
    printf '\n%s line(s) found on this branch but NOT honoured:\n%s\n' "$trailer" "$candidates"
    fail "$ticket touches spike/src and every '$trailer' line on this branch is malformed or names another ticket. An exemption must read exactly '$trailer: $ticket <one line saying what and why>' — this branch's ticket id and a non-empty reason — so that an accidental or unrelated trailer cannot disable the freeze. See $CHARTER §3."
  fi
  fail "$ticket is one of Q-0009's fourteen port children, and the port freeze forbids it changing spike/src. The spike stays authoritative and green until the cutover — it is the harness these tickets run on and the port's only independent witness. See $CHARTER §3. If this change is genuinely required, add a commit trailer '$trailer: $ticket <why>' and it will be honoured." ;;

# --- freeze-sha: runs only once the charter names a SHA ---------------------------------------
freeze-sha)
  if [ "$freeze_sha" = "not-yet-recorded" ]; then
    # The workflow conditions this job on a SHA existing, so reaching here means it was invoked
    # anyway. Refuse: an unrun check is not a clean one, and reporting success for it is the exact
    # failure this guard was written to avoid.
    fail "no freeze SHA is recorded in $CHARTER, so this half has nothing to verify. It is SKIPPED, not passed — and this script will not exit 0 to say otherwise. Record a SHA in the charter's port-freeze block once Q-0037..Q-0040 are settled."
  fi

  require_history
  git cat-file -e "${freeze_sha}^{commit}" 2>/dev/null || \
    fail "the freeze SHA '$freeze_sha' recorded in $CHARTER is not a commit in this repository, so the freeze cannot be verified against it."

  # Which question does the diff below answer? "What has $BASE acquired under spike/src since the
  # freeze point?" — and only if the freeze point is an ancestor of $BASE. If it is not, the same
  # command answers "how do these two trees differ", which is a different question and would be
  # reported as a freeze violation it is not. Three-valued, like every ancestry read in this
  # repository (invariant 8): 0 ancestor, 1 provably not, anything else could not answer.
  git merge-base --is-ancestor "$freeze_sha" "$BASE" 2>/dev/null
  case "$?" in
    0) : ;;
    1) fail "the freeze SHA ${freeze_sha:0:7} is not an ancestor of $BASE, so a diff between them does not answer 'what has $BASE acquired since the freeze'. Re-record the freeze SHA in $CHARTER against the history $BASE actually has." ;;
    *) fail "git could not decide whether ${freeze_sha:0:7} is an ancestor of $BASE, so the freeze cannot be verified. The guard fails rather than assume either answer." ;;
  esac

  moved=$(git diff --name-status "$freeze_sha" "$BASE" -- spike/src) || \
    fail "git diff between ${freeze_sha:0:7} and $BASE over spike/src failed, so the guard cannot answer."

  if [ -n "$moved" ]; then
    printf '\nFiles under spike/src that differ between the freeze SHA and %s:\n%s\n' "$BASE" "$moved"
    fail "$BASE has acquired changes under spike/src since the freeze at ${freeze_sha:0:7}. The port's witness has moved: a fix landing in the spike after its module was ported is absent from the port, and both suites stay green while the product is wrong. See $CHARTER §3."
  fi

  note "port-freeze: freeze-SHA clear — $BASE holds no spike/src change since ${freeze_sha:0:7}."
  printf '\nport-freeze: freeze-SHA CLEAR — %s is identical to %s under spike/src.\n' "$BASE" "${freeze_sha:0:7}"
  exit 0 ;;

*)
  fail "unknown HALF '$HALF' — expected policy, branch-scope or freeze-sha." ;;
esac
