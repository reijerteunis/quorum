// fan_out: expand solution/tasks.yaml into one worktree step per task, in dependency waves.
// integrate: merge branches into the ticket branch in a worktree and run the test command.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import YAML from 'yaml';
import { ensureWorktree } from './git.js';

export class IntegrationError extends Error {}

// ---------- tasks ----------

export function loadTasks(ticket) {
  const f = path.join(ticket.dir, 'solution', 'tasks.yaml');
  if (fs.existsSync(f)) return YAML.parse(fs.readFileSync(f, 'utf8')).tasks ?? [];
  // Fallback: first ```yaml block containing `tasks:` in solution.md → persist as tasks.yaml
  const doc = path.join(ticket.dir, 'solution', 'solution.md');
  if (!fs.existsSync(doc)) throw new IntegrationError('no solution/tasks.yaml and no solution/solution.md');
  const m = [...fs.readFileSync(doc, 'utf8').matchAll(/```ya?ml\n([\s\S]*?)```/g)].map((x) => x[1]).find((y) => /^tasks:/m.test(y));
  if (!m) throw new IntegrationError('solution.md has no ```yaml block with tasks:');
  fs.writeFileSync(f, m);
  return YAML.parse(m).tasks ?? [];
}

// Narrow a fan-out to the tasks that still fail. A depends_on naming a task outside the scope is
// already satisfied — that task succeeded and its branch is merged — so it is dropped rather than
// left for waves() to report as an unresolvable cycle. Q-0006's run 11 crashed on exactly that.
export function scopeToFailing(tasks, failing) {
  const kept = tasks.filter((t) => failing.has(t.id));
  const ids = new Set(kept.map((t) => t.id));
  return kept.map((t) => ({ ...t, depends_on: (t.depends_on ?? []).filter((d) => ids.has(d)) }));
}

// Group tasks into waves: a task runs once all its depends_on are in earlier waves.
export function waves(tasks) {
  const done = new Set(); const out = [];
  let remaining = [...tasks];
  while (remaining.length) {
    const ready = remaining.filter((t) => (t.depends_on ?? []).every((d) => done.has(d)));
    if (!ready.length) throw new IntegrationError(`dependency cycle or unknown depends_on among: ${remaining.map((t) => t.id).join(', ')}`);
    out.push(ready); ready.forEach((t) => done.add(t.id));
    remaining = remaining.filter((t) => !ready.includes(t));
  }
  return out;
}

export function taskVars(task) {
  return { 'task.id': task.id, 'task.role': task.role, 'task.title': task.title, role: task.role };
}

export function taskPromptSection(task, worktreeDir) {
  const parts = [`\n# Task ${task.id} (${task.role}): ${task.title}`];
  if (task.description) parts.push(task.description);
  for (const c of task.contracts ?? []) {
    const f = path.join(worktreeDir, c);
    parts.push(`\n## Contract: ${c}\n\n${fs.existsSync(f) ? '```\n' + fs.readFileSync(f, 'utf8').trim() + '\n```' : '(file not found in worktree — treat as a blocker and say so in summary)'}`);
  }
  if (task.depends_on?.length) parts.push(`\nDepends on: ${task.depends_on.join(', ')} (already merged into your base branch).`);
  return parts.join('\n');
}

// ---------- git helpers ----------

// argv, never a shell. A step summary written by an agent becomes a commit message, so this is
// untrusted text on a command line: backticks in one crashed a run, and `$(…)` would have been
// executed rather than committed. Branch names carry agent-authored task ids for the same reason.
// See Q-0011.
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const safe = (fn) => { try { return fn(); } catch { return null; } };

export function branchExists(repo, b) { return Boolean(safe(() => git(['rev-parse', '--verify', '--quiet', `refs/heads/${b}`], repo))); }

// The engine owns everything under backlog/: a ticket's stage, counters, history and cost, and the
// per-stage artifacts it writes itself into the main worktree. A worktree is a full checkout, so
// backlog/ is sitting there in every step's working directory — and an agent's edit to it is never
// authoritative. Q-0011's architect rewrote a ticket's frontmatter on its branch, resetting
// `iterations` to {} and deleting three history entries with their costs; only a merge conflict
// caught it, which is luck rather than design. Discard those edits and restore the worktree, so a
// dirty backlog cannot block the next merge either. Reported through onDiscard, never silently.
export function commitAll(dir, message, onDiscard) {
  const dirty = (safe(() => git(['status', '--porcelain', '--', 'backlog'], dir)) ?? '')
    .split('\n').map((l) => l.slice(3).trim()).filter(Boolean);
  if (dirty.length) {
    safe(() => git(['checkout', '--', 'backlog'], dir));   // revert tracked edits
    safe(() => git(['clean', '-qfd', '--', 'backlog'], dir)); // drop files the agent added
    onDiscard?.(dirty);
  }
  git(['add', '-A'], dir);
  const staged = git(['diff', '--cached', '--name-only'], dir);
  if (!staged) return null;
  git(['-c', 'user.email=harness@local', '-c', 'user.name=harness', 'commit', '-q', '-m', message], dir);
  return staged.split('\n');
}

// A run that does not complete must leave the ticket branch as it found it. integrate merges task
// branches before anyone knows whether the run will succeed, and an exhausted or aborted run used
// to leave those merges behind permanently — so the next stage measured its red phase against a
// tree that already contained the implementation. Nothing is lost by rolling back: each task's work
// stays on its own branch. See Q-0033.
export function branchHead(repo, branch) { return safe(() => git(['rev-parse', branch], repo)); }

export function resetBranchTo(repo, branch, sha) {
  const dir = path.join(repo, '.harness', 'worktrees', branch.replace(/\//g, '__'));
  if (fs.existsSync(dir)) { git(['reset', '--hard', sha], dir); safe(() => git(['clean', '-qfd'], dir)); }
  else git(['branch', '-f', branch, sha], repo);
}

// Merge `branch` into the checked-out branch of `dir`. Returns {ok, conflicts[]}.
export function mergeInto(dir, branch) {
  try {
    git(['-c', 'user.email=harness@local', '-c', 'user.name=harness', 'merge', '--no-ff', '--no-edit', branch], dir);
    return { ok: true, conflicts: [] };
  } catch (e) {
    const conflicts = (safe(() => git(['diff', '--name-only', '--diff-filter=U'], dir)) ?? '').split('\n').filter(Boolean);
    safe(() => git(['merge', '--abort'], dir));
    return { ok: false, conflicts, error: String(e.stderr ?? e.message).slice(-500) };
  }
}

// The capture directory's name prefix. Named rather than inlined: it is what packages/core's
// turbo-inputs guard registers the twin's reads against, and the two trees stay legible together.
const CAPTURE_PREFIX = 'quorum-command-';

// A capture failure, as one error that can never be mistaken for something the command did. It
// throws rather than reporting: a new result field would be ignored by the one line that decides
// tests=ok, and reusing code/timedOut makes an infrastructure failure indistinguishable from a
// verdict. The engine's tests= line is never reached on a throw, so a broken capture can satisfy
// neither `expect: pass` nor `expect: fail`. See Q-0070.
const captureFailure = (what, cause) =>
  new Error(`runCommand could not ${what}: ${cause?.message ?? String(cause)}. `
    + "The command's output was not captured, so no result is reported for it.");

const readCapture = (file) => {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw captureFailure(`read back what the command wrote to ${path.basename(file)}`, e);
  }
};

// A project's own test command runs here, and a hung one used to hang the whole flow forever with
// no output: Q-0011's integrate sat on a blocked suite for 24 minutes and would still be sitting
// there. A timeout is not a nicety — an orchestrator that can wait indefinitely cannot be trusted
// to run unattended. stdin is /dev/null so a command that prompts fails fast instead of waiting.
//
// The child writes into two files rather than through two pipes, so there is no ceiling and no
// shape of writing that can lose a byte. A pipe imposed both: Node's 1 MiB default killed a
// progressive writer mid-run and reported the kill as a timeout, and an explicit exit discarded a
// monolithic writer's own unflushed bytes, delivering 64 KiB of whatever it produced and — when it
// exited zero — a clean result that satisfied `expect: pass`. Writes to a file are synchronous, so
// neither can happen. Two files rather than one, because interleaving them would change what a
// green run reports. See Q-0070.
export function runCommand(cmd, cwd, { timeoutMs = 15 * 60_000 } = {}) {
  let dir;
  try {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), CAPTURE_PREFIX));
  } catch (e) {
    throw captureFailure('create the directory it captures output into', e);
  }
  const outFile = path.join(dir, 'stdout');
  const errFile = path.join(dir, 'stderr');
  try {
    let out, err;
    try {
      out = fs.openSync(outFile, 'w');
    } catch (e) {
      throw captureFailure("open its capture file for the command's output", e);
    }
    try {
      err = fs.openSync(errFile, 'w');
    } catch (e) {
      fs.closeSync(out);
      throw captureFailure("open its capture file for the command's errors", e);
    }
    try {
      execSync(cmd, { cwd, stdio: ['ignore', out, err], env: process.env, timeout: timeoutMs, killSignal: 'SIGKILL' });
    } catch (e) {
      // execSync reports a timeout as a kill, not a status; without this it looks like an ordinary
      // non-zero exit, which `expect: fail` would happily bank as proof of red. Since Q-0070 a kill
      // can only mean the timeout: no volume of output kills anything.
      const timedOut = e.killed === true || e.signal === 'SIGKILL' || e.code === 'ETIMEDOUT';
      // Read before either finally runs. The error carries no streams now that the child wrote
      // through descriptors, so the files are the only account of what it produced.
      const captured = readCapture(outFile) + readCapture(errFile);
      return { code: e.status ?? 1, out: captured, timedOut, timeoutMs };
    } finally {
      fs.closeSync(out);
      fs.closeSync(err);
    }
    return { code: 0, out: readCapture(outFile), timedOut: false };
  } finally {
    // Not wrapped: a capture directory that cannot be removed is surfaced rather than swallowed,
    // and it invents no verdict to say so.
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Integration worktree for the ticket branch (created from HEAD on first use).
export function ticketWorktree(repoDir, ticketBranch) {
  return ensureWorktree(repoDir, ticketBranch, null);
}
