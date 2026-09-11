// Test support for `@quorum/server`: a throwaway repository with a harness, a flow and a ticket,
// built under `os.tmpdir()` by the test that uses it.
//
// It lives OUTSIDE `src/` because it is not a suite — a statement about its NAME rather than its
// directory, the include being Vitest's own default, which reaches every `*.test.ts` below a
// package.
//
// **Every fixture builds what it asserts over.** Nothing here reads this repository, the machine's
// git identity, an existing `.harness/worktrees` or `.quorum/runs`, or a registry: a test's verdict
// is a property of the commit, not of the checkout or the account (2026-08-30). The identity below
// is passed per invocation for that reason, and is the same shape `packages/core/test/repo.ts` uses.
//
// This package's suite drives REAL runs, so it spawns real `git` and writes real run history — which
// makes the discipline above load-bearing rather than decorative.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { openProject } from '../src/failures.js';
import type { Project } from '@quorum/core';

const created: string[] = [];

/** Remove every directory this module made. Called from one `afterAll` per suite. */
export function removeTempDirs(): void {
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}

/** A temporary directory {@link removeTempDirs} will clean up. */
export function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `q0013-${prefix}`));
  created.push(dir);
  return dir;
}

/** Write a file, creating whatever directories it needs. */
export function write(file: string, body: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** A repository with one commit on `main`, and an identity supplied by this call rather than found. */
export function repo(prefix = 'repo-'): string {
  const dir = tempDir(prefix);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'init');
  return dir;
}

/** The flow every fixture writes unless a test asks for another: one agent step and nothing else. */
export const ONE_STEP_FLOW = `name: probe
consumes: draft
produces: requirements
steps:
  - id: work
`;

/** A flow that reaches a human gate after its one step, so a run can be found parked on a question. */
export const GATED_FLOW = `name: probe
consumes: draft
produces: requirements
steps:
  - id: work
  - gate: human
    reason: approve to advance
`;

/** A flow whose one step takes a worktree, so a stopped run has something to keep. */
export const WORKTREE_FLOW = `name: probe
consumes: draft
produces: requirements
steps:
  - id: work
    worktree: true
    branch: "harness/{id}/work"
  - gate: human
    reason: approve to advance
`;

/** What a fixture may be told to build differently. */
export interface FixtureOptions {
  /** The flow file's body. Its `name:` and `consumes:` are what the run is started against. */
  readonly flow?: string;
  /** The flow file's basename, which is also the name a start request carries. */
  readonly flowName?: string;
  /** The ticket's stage. `draft` matches every flow above. */
  readonly stage?: string;
  /** The `harness/harness.yaml` body. */
  readonly config?: string;
}

/** One prepared project: where it is, what is in it, and the loaded `Project` a host takes. */
export interface Fixture {
  readonly repoDir: string;
  readonly harnessDir: string;
  readonly ticketDir: string;
  readonly ticketId: string;
  readonly flowName: string;
  readonly project: Project;
  /**
   * A second ticket in the same backlog, so two runs of ONE host can be told apart.
   *
   * `runsLog` seeds `nextRunId`, which reads the highest `run=N` it holds — the only way to give
   * two runs different gate ids, since `nextGateId` spells `<run number>:<n>` and two tickets on
   * their first run both ask `1:1`.
   */
  addTicket(options: { id: string; folder: string; stage?: string; runsLog?: string }): string;
  /** One line of the ticket's `runs.log`, or `''` where the run wrote none. */
  runsLog(): string;
  /** Every run-history manifest this repository holds, parsed, oldest run id first. */
  manifests(): { status: string; ended_at: string | null }[];
  /** Every worktree directory the repository holds, by name. */
  worktrees(): string[];
}

/** The ticket id every fixture creates. An empty backlog's first id, so nothing infers a prefix. */
export const TICKET_ID = 'T-0001';

/** That ticket's folder name. */
export const TICKET_FOLDER = 'T-0001-the-server-runs-a-flow';

/** A repository holding a harness, one flow and one `draft` ticket, ready for a run. */
export function fixture(options: FixtureOptions = {}): Fixture {
  const repoDir = repo();
  const flowName = options.flowName ?? 'probe';
  write(path.join(repoDir, 'harness/harness.yaml'), options.config ?? 'adapterOverride: mock\nrepo:\n  base_branch: main\n');
  write(path.join(repoDir, 'harness/flows', `${flowName}.yaml`), options.flow ?? ONE_STEP_FLOW);
  const ticketFile = (id: string, stage: string): string => [
    '---',
    `id: ${id}`,
    'title: the server runs a flow',
    `stage: ${stage}`,
    'owner: qa',
    'repos: []',
    `branch: harness/${id}/integration`,
    'priority: p1',
    'created: 2026-09-11',
    'iterations: {}',
    'history: []',
    '---',
    'ticket body',
    '',
  ].join('\n');

  const ticketDir = path.join(repoDir, 'backlog', TICKET_FOLDER);
  write(path.join(ticketDir, 'ticket.md'), ticketFile(TICKET_ID, options.stage ?? 'draft'));

  const opened = openProject(repoDir);
  if (!opened.opened) throw new Error(`fixture did not open: ${opened.refusal.condition}`);

  const runsRoot = path.join(repoDir, '.quorum', 'runs');
  const worktreeRoot = path.join(repoDir, '.harness', 'worktrees');

  return {
    repoDir,
    harnessDir: opened.project.harnessDir,
    ticketDir,
    ticketId: TICKET_ID,
    flowName,
    project: opened.project,
    addTicket: ({ id, folder, stage = 'draft', runsLog }) => {
      const dir = path.join(repoDir, 'backlog', folder);
      write(path.join(dir, 'ticket.md'), ticketFile(id, stage));
      if (runsLog !== undefined) write(path.join(dir, 'runs.log'), runsLog);
      return dir;
    },
    runsLog: () => {
      const file = path.join(ticketDir, 'runs.log');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    },
    manifests: () => (fs.existsSync(runsRoot) ? fs.readdirSync(runsRoot).sort() : [])
      .map((dir) => path.join(runsRoot, dir, 'manifest.json'))
      .filter((file) => fs.existsSync(file))
      .map((file) => JSON.parse(fs.readFileSync(file, 'utf8')) as { status: string; ended_at: string | null }),
    worktrees: () => (fs.existsSync(worktreeRoot) ? fs.readdirSync(worktreeRoot).sort() : []),
  };
}

/**
 * Drain one subscription into an array, stopping when the stream closes.
 *
 * A helper rather than an inline `for await` because two subscribers have to be drained
 * concurrently for AC-6's claim to mean anything.
 */
export async function drain<T>(events: AsyncIterable<T>): Promise<T[]> {
  const seen: T[] = [];
  for await (const event of events) seen.push(event);
  return seen;
}
