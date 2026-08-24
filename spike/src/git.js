// Worktree per writing step. Never touches the user's working tree.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// argv, never a shell. Branch names are built from ticket and task ids, and task ids come from a
// tasks.yaml an agent wrote — so they are untrusted input reaching a command line. See Q-0011.
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function ensureWorktree(repoDir, branch, base) {
  const root = path.join(repoDir, '.harness', 'worktrees');
  const dir = path.join(root, branch.replace(/\//g, '__'));
  if (fs.existsSync(dir)) return dir;
  fs.mkdirSync(root, { recursive: true });
  ensureExcluded(repoDir, '.harness/');
  const branchExists = safe(() => git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], repoDir));
  if (branchExists) {
    git(['worktree', 'add', dir, branch], repoDir);
  } else {
    const baseExists = base && safe(() => git(['rev-parse', '--verify', '--quiet', `refs/heads/${base}`], repoDir));
    git(['worktree', 'add', '-b', branch, dir, baseExists ? base : 'HEAD'], repoDir);
  }
  return dir;
}

export function removeWorktree(repoDir, branch, { deleteBranch = false } = {}) {
  const dir = path.join(repoDir, '.harness', 'worktrees', branch.replace(/\//g, '__'));
  if (fs.existsSync(dir)) git(['worktree', 'remove', '--force', dir], repoDir);
  if (deleteBranch) safe(() => git(['branch', '-D', branch], repoDir));
}

// Where a ticket's code actually is, derived from git at the moment of asking and never stored —
// a persisted copy of a git fact drifts the first time someone merges by hand, and a wrong field
// is believed. Returns null when repoDir is not a git work tree (or git itself is unavailable):
// the caller renders as it always did, because containment is information, never a failure.
//
// The per-invocation probes (work tree + shallow, base ref, the branch list) run once here; each
// call to stateOf() then costs at most two more git spawns, so a board of n tickets issues at
// most 2n + 3. The branch list is read once via for-each-ref and each ticket's `branch` value —
// untrusted, agent-written frontmatter — is matched against it as a plain string, so a hostile
// name never reaches a git command line at all; the refs/heads/… forms passed below are only
// ever names that came out of git. See Q-0036.
export function containment(repoDir, base) {
  let probe;
  try { probe = git(['rev-parse', '--is-inside-work-tree', '--is-shallow-repository'], repoDir); }
  catch { return null; }
  const [inWorkTree, shallow] = probe.split('\n').map((line) => line.trim() === 'true');
  if (!inWorkTree) return null;
  const baseResolves = safe(() => git(['rev-parse', '--verify', '--quiet', `refs/heads/${base}^{commit}`], repoDir)) != null;
  const branches = new Set((safe(() => git(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], repoDir)) ?? '')
    .split('\n').filter(Boolean));
  return {
    // null → the branch does not resolve to a local ref; the row renders unannotated.
    // Otherwise exactly one of the three states, selected from git's own exit codes and nothing
    // else: merge-base --is-ancestor exits 0 → contained, 1 → provably not contained, anything
    // else → indeterminate. "Not contained" is never inferred from a failure. The shallow rule is
    // deliberately asymmetric: ancestry found in the history that is present is real, so exit 0
    // stays contained, while history that is absent cannot disprove ancestry, so exit 1 becomes
    // indeterminate rather than a confident falsehood.
    stateOf(branch) {
      if (typeof branch !== 'string' || !branches.has(branch)) return null;
      if (!baseResolves) return { state: 'indeterminate', reason: 'missing ref' };
      try { git(['merge-base', '--is-ancestor', `refs/heads/${branch}`, `refs/heads/${base}`], repoDir); }
      catch (e) {
        if (e.status !== 1) return { state: 'indeterminate', reason: 'git failed' };
        if (shallow) return { state: 'indeterminate', reason: 'shallow clone' };
        // Commits reachable from the ticket branch and not from the base — not the symmetric
        // difference, and only computed for a proven not-contained result.
        const ahead = safe(() => git(['rev-list', '--count', `refs/heads/${base}..refs/heads/${branch}`], repoDir));
        if (ahead == null) return { state: 'indeterminate', reason: 'git failed' };
        return { state: 'not-contained', ahead: Number(ahead) };
      }
      return { state: 'contained' };
    },
  };
}

export function ensureExcluded(repoDir, pattern) {
  let f;
  try {
    const resolved = git(['rev-parse', '--git-path', 'info/exclude'], repoDir);
    f = path.isAbsolute(resolved) ? resolved : path.resolve(repoDir, resolved);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    if (!cur.split('\n').includes(pattern)) fs.appendFileSync(f, `${cur.endsWith('\n') || !cur ? '' : '\n'}${pattern}\n`);
  } catch (e) {
    const target = f ?? path.join(repoDir, '.git', 'info', 'exclude');
    console.warn(`warning: could not add ${pattern} to ${target}: ${e.message}`);
  }
}

const safe = (fn) => { try { return fn(); } catch { return null; } };
