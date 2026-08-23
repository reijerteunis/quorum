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

function ensureExcluded(repoDir, pattern) {
  const f = path.join(repoDir, '.git', 'info', 'exclude');
  if (!fs.existsSync(path.dirname(f))) return;
  const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  if (!cur.split('\n').includes(pattern)) fs.appendFileSync(f, `${cur.endsWith('\n') || !cur ? '' : '\n'}${pattern}\n`);
}

const safe = (fn) => { try { return fn(); } catch { return null; } };
