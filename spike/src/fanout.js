// fan_out: expand solution/tasks.yaml into one worktree step per task, in dependency waves.
// integrate: merge branches into the ticket branch in a worktree and run the test command.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
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

const git = (args, cwd) => execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const safe = (fn) => { try { return fn(); } catch { return null; } };

export function branchExists(repo, b) { return Boolean(safe(() => git(`rev-parse --verify --quiet refs/heads/${b}`, repo))); }

export function commitAll(dir, message) {
  git('add -A', dir);
  const staged = git('diff --cached --name-only', dir);
  if (!staged) return null;
  git(`-c user.email=harness@local -c user.name=harness commit -q -m "${message.replace(/"/g, "'")}"`, dir);
  return staged.split('\n');
}

// Merge `branch` into the checked-out branch of `dir`. Returns {ok, conflicts[]}.
export function mergeInto(dir, branch) {
  try {
    git(`-c user.email=harness@local -c user.name=harness merge --no-ff --no-edit ${branch}`, dir);
    return { ok: true, conflicts: [] };
  } catch (e) {
    const conflicts = (safe(() => git('diff --name-only --diff-filter=U', dir)) ?? '').split('\n').filter(Boolean);
    safe(() => git('merge --abort', dir));
    return { ok: false, conflicts, error: String(e.stderr ?? e.message).slice(-500) };
  }
}

export function runCommand(cmd, cwd) {
  try {
    const out = execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') };
  }
}

// Integration worktree for the ticket branch (created from HEAD on first use).
export function ticketWorktree(repoDir, ticketBranch) {
  return ensureWorktree(repoDir, ticketBranch, null);
}
