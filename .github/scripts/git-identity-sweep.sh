#!/usr/bin/env bash
# The hostile-environment sweep for "A test's verdict is a property of the commit, not of the
# checkout or the account" (docs/decisions, 2026-08-30).
#
# It runs both suites in an environment where git can resolve no identity, so a test that depends
# on the account it runs as fails here and nowhere else. It is the ORACLE: complete over the whole
# class, and slow. packages/core/src/git-identity.test.ts is the tripwire — cheap, inside the
# ordinary suite, and partial, because it sees literals only.
#
# Defined once, in this file, because CI and a maintainer must run byte-identically the same thing.
# A definition restated in ci.yml or in a package.json script would drift, and a developer could
# then not reproduce what CI claims.
#
# ---------------------------------------------------------------------------------------------
# WHAT DOES AND DOES NOT DISCRIMINATE. Measured 2026-08-30 on git 2.55.0, darwin 25.3.0, with
# `git var GIT_COMMITTER_IDENT` — which resolves an identity without a repository, a temp
# directory or a commit object. Recorded here because two earlier attempts at a local red both
# failed, in opposite directions, and the next person will otherwise repeat them.
#
#   ambient                                            -> Ruud <info@ruud.tech>
#   GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=...  -> Ruud van Engelenhoven <…@…​.local>
#                                                         the OS USER RECORD still answers, so
#                                                         this does not discriminate: uncorrected
#                                                         code passes.
#   ...plus user.useConfigOnly=true                    -> "Committer identity unknown", non-zero
#   ...that, plus -c user.email=… -c user.name=…       -> qa <q@a>
#
# Only the last two rows are the check. Two holes were measured in them and both are closed below:
# an exported EMAIL or GIT_AUTHOR_NAME survives every GIT_CONFIG_* variable, and useConfigOnly
# forbids INFERENCE but not CONFIGURATION, so a repository-local or worktree [user] section makes
# a contributor's clone permissive while a bare one is strict.
#
# NOT the negative probe: an empty GIT_COMMITTER_NAME. An environment variable outranks a -c flag,
# so that setup rejects corrected code too — it would report the class as caught while catching
# everything. Measured: it fails all 44 tests in diff.test.ts, fixed or not.
# ---------------------------------------------------------------------------------------------

set -uo pipefail

phase=""
fail() {
  echo "::error::git-identity sweep failed in phase '${phase}': $*" >&2
  exit 1
}

# ---- phase: isolation -------------------------------------------------------------------------
phase="isolation"

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || fail "not inside a git repository"
cd "$repo_root" || fail "cannot enter ${repo_root}"

# A local or worktree identity survives everything below, so refuse rather than clear it: clearing
# a maintainer's configuration is not this script's business, and continuing would be permissive.
for scope in local worktree; do
  for key in user.name user.email; do
    if value=$(git config --"${scope}" --get "${key}" 2>/dev/null); then
      fail "the checkout carries a ${scope}-scoped ${key} (${value}); it would satisfy git under this environment and make the sweep permissive. Unset it, or run the sweep in a clean clone."
    fi
  done
done

# HOME is deliberately NOT replaced, and the reason is measured rather than assumed.
# GIT_CONFIG_GLOBAL replaces BOTH global paths git would otherwise read — ~/.gitconfig and
# ~/.config/git/config — so an empty HOME adds nothing for identity, while it does move pnpm's
# store: with one, `pnpm install --frozen-lockfile` aborts with ERR_PNPM_ABORTED_REMOVE_MODULES_DIR
# and would want to delete the developer's node_modules. The probe below is the oracle, so this is
# a question of what the environment achieves and not of how it is spelled: if any of this stops
# neutralising identity, the negative probe resolves and the run stops there.
export GIT_CONFIG_GLOBAL="${repo_root}/.git/sweep-gitconfig-absent"
rm -f "${GIT_CONFIG_GLOBAL}" || fail "cannot ensure ${GIT_CONFIG_GLOBAL} is absent"
export GIT_CONFIG_NOSYSTEM=1
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=user.useConfigOnly GIT_CONFIG_VALUE_0=true
unset GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_AUTHOR_DATE
unset GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL GIT_COMMITTER_DATE
unset EMAIL

# ---- phase: probe -----------------------------------------------------------------------------
# The environment is itself a check, so it must have a subject. Every mechanism above rests on
# git's treatment of user.useConfigOnly and on GIT_CONFIG_COUNT not outranking a -c flag; a git
# upgrade, a runner image with a system identity, or an earlier `git config --global` each turn the
# sweep permissive — and a permissive sweep is green over everything.
phase="probe"

for var in GIT_AUTHOR_IDENT GIT_COMMITTER_IDENT; do
  if out=$(git var "${var}" 2>&1); then
    fail "the negative probe did not discriminate: \`git var ${var}\` resolved '${out}' where it must fail. The environment is permissive and every suite below would pass vacuously."
  fi
done

for var in GIT_AUTHOR_IDENT GIT_COMMITTER_IDENT; do
  if ! out=$(git -c user.email=probe@sweep -c user.name=probe var "${var}" 2>&1); then
    fail "the positive probe did not resolve: \`git -c user.email=… -c user.name=… var ${var}\` failed with '${out}'. The environment rejects corrected code too, so it would report this class as caught while catching everything."
  fi
done

echo "git-identity sweep: environment discriminates (negative and positive probes both as expected)"

# ---- phase: install ---------------------------------------------------------------------------
# Byte-identically what the `workspace` and `spike` jobs run. A sweep that installs differently
# from the jobs it is the strict twin of can differ in verdict for a reason other than the
# environment, which is the one variable it exists to isolate. `npm install` is not lockfile-frozen
# and Q-0038 measured one moving fast-uri and producing a different tree.
phase="install"

pnpm install --frozen-lockfile || fail "pnpm install --frozen-lockfile did not complete; the workspace suite below is UNRUN, not passing"
( cd spike && npm ci ) || fail "npm ci in spike/ did not complete; the spike suite below is UNRUN, not passing"

# ---- phase: spike suite -----------------------------------------------------------------------
phase="spike suite"
( cd spike && npm test ) || fail "the spike regression suite is RED under a git configuration that resolves no identity"

# ---- phase: workspace suite -------------------------------------------------------------------
phase="workspace suite"
pnpm turbo run test --force || fail "the workspace suite is RED under a git configuration that resolves no identity"

echo "git-identity sweep: both suites executed and green with no resolvable git identity"
