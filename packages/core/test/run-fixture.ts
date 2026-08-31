// Composed-run support for Q-0052's two step kinds: a real repository, a real ticket folder, a
// real flow file, and a stub adapter the run resolves through `getAdapter`.
//
// It lives OUTSIDE `src/` for the reason `repo.ts` does — this is not a suite, and since Q-0054
// that rests on its name rather than on its directory. Everything it builds is under `os.tmpdir()`, so no test written against it
// can read or write a path in this repository.
//
// The flow file is loaded through `loadFlow` and its `steps` are then replaced, which is
// engine.test.ts's own arrangement: a step shape a test needs is not a shape `lintFlow` has to
// accept, and the alternative is every fixture fighting a linter that is not its subject.
import fs from 'node:fs';
import path from 'node:path';

import { vi } from 'vitest';

import { MANIFEST_FILE, RUN_HISTORY_ROOT, occurrenceDirName, runIdOf } from '@quorum/shared';
import type { Event } from '@quorum/shared';

import * as adapters from '../src/adapters/adapters.js';
import type { AdapterResult, AdapterRunOptions, RetriedAdapterResult, RetryingAdapter } from '../src/adapters/adapters.js';
import { loadProject } from '../src/backlog/project.js';
import { runFlow } from '../src/engine/engine.js';
import { loadFlow } from '../src/engine/loaders.js';
import type { RunFlowOptions } from '../src/engine/types.js';
import type { RunManifest } from '../src/run-history/manifest.js';
import * as writer from '../src/run-history/writer.js';
import { repo, write } from './repo.js';

/** The `harness/harness.yaml` a fixture writes when a test does not supply its own. */
export const DEFAULT_CONFIG = 'adapterOverride: mock\nrepo:\n  base_branch: main\n';

/** The ticket every fixture builds, so an assertion can name it without reaching for the record. */
export const TICKET_ID = 'Q-0052';

/** The ticket folder's basename, which a prompt's `## Input: backlog/<folder>/…` heading carries. */
export const TICKET_FOLDER = 'Q-0052-agent-gate-script';

/** What {@link runFixture} may be told to build differently. */
export interface RunFixtureOptions {
  /** The `harness/harness.yaml` body. */
  config?: string;
  /** Anything on the run's options — `dry`, `auto`, `answerGate`, `signal`, `base`. */
  run?: Partial<RunFlowOptions>;
}

/** One prepared run: where it is, what it will run, and how to drain it. */
export interface RunFixture {
  repoDir: string;
  harnessDir: string;
  ticketDir: string;
  opts: RunFlowOptions;
  /** Replaces the flow's steps with the shapes this test needs. */
  steps(steps: Record<string, unknown>[]): void;
  /** Writes `harness/roles/<name>.md` with the given frontmatter block and body. */
  role(name: string, text: string): void;
  /** Writes a file inside the ticket folder. */
  ticketFile(rel: string, text: string): void;
  /** Drains the run to its terminal event, keeping the events even when it throws. */
  settle(): Promise<{ events: Event[]; error: unknown }>;
}

/**
 * A run over a repository, a ticket and a flow that all genuinely exist.
 *
 * The flow is `chore`, consuming `requirements` and producing `reviewed`, because that is the flow
 * every step kind here actually runs under.
 */
export function runFixture(options: RunFixtureOptions = {}): RunFixture {
  const repoDir = repo();
  write(path.join(repoDir, 'harness/harness.yaml'), options.config ?? DEFAULT_CONFIG);
  const flowFile = path.join(repoDir, 'harness/flows/chore.yaml');
  write(flowFile, 'name: chore\nconsumes: requirements\nproduces: reviewed\nsteps: []\n');
  const project = loadProject(repoDir);
  const flow = loadFlow(flowFile);
  const ticketDir = path.join(repoDir, 'backlog', TICKET_FOLDER);
  write(path.join(ticketDir, 'ticket.md'), `---\nid: ${TICKET_ID}\n---\nticket body\n`);
  const ticket = {
    dir: ticketDir, folder: TICKET_FOLDER, body: 'ticket body\n',
    meta: {
      id: TICKET_ID, title: 'agent, gate and script steps', stage: 'requirements', owner: 'qa', repos: [],
      branch: `harness/${TICKET_ID}/integration`, priority: 'p1', created: '2026-08-30', iterations: {}, history: [],
    },
  };
  const opts = {
    ticket, flow, backlog: project.backlog, project, ...options.run,
  } as unknown as RunFlowOptions;

  return {
    repoDir,
    harnessDir: project.harnessDir,
    ticketDir,
    opts,
    steps(steps) { opts.flow.steps = steps as unknown as typeof opts.flow.steps; },
    role(name, text) { write(path.join(project.harnessDir, 'roles', `${name}.md`), text); },
    ticketFile(rel, text) { write(path.join(ticketDir, rel), text); },
    async settle() {
      const events: Event[] = [];
      try {
        for await (const event of runFlow(opts)) events.push(event);
        return { events, error: undefined };
      } catch (error: unknown) {
        return { events, error };
      }
    },
  };
}

/** What a stub adapter records, and how it is taken back out of the registry. */
export interface AdapterStub {
  /** Every invocation, in order, exactly as the step handed it over. */
  calls: AdapterRunOptions[];
  /** Every name `getAdapter` was asked to resolve. */
  names: string[];
}

/**
 * Puts a stub in front of `getAdapter` for the rest of the test, so a step's own behaviour can be
 * driven without a vendor and without the mock adapter's simulation.
 *
 * `vi.restoreAllMocks()` takes it back out, which every suite here does in `afterEach`.
 *
 * @param run what the stub answers, or throws. `call` is 1 on the first invocation.
 * @param vendor the label the stub bills under.
 */
export function stubAdapter(
  run: (options: AdapterRunOptions, call: number) => Promise<Partial<AdapterResult>> | Partial<AdapterResult>,
  vendor = 'stub',
): AdapterStub {
  const calls: AdapterRunOptions[] = [];
  const names: string[] = [];
  const adapter: RetryingAdapter = {
    vendor,
    check: () => Promise.resolve(`${vendor} 0.0.1`),
    async run(options) {
      calls.push(options);
      const answered = await run(options, calls.length);
      return {
        output: {}, raw: '', usage: null, session: null, ms: 1, attempts: 1, vendor,
        ...answered,
      } as RetriedAdapterResult;
    },
  };
  vi.spyOn(adapters, 'getAdapter').mockImplementation((name: string) => {
    names.push(name);
    return adapter;
  });
  return { calls, names };
}

/** Where a run's history lives, derived through `shared` rather than re-spelled. */
export const runDir = (repoDir: string, run = 1): string =>
  path.join(repoDir, RUN_HISTORY_ROOT, runIdOf(TICKET_ID, run));

/** One artifact beside the `seq`-th occurrence of a run, by the occurrence's step id. */
export const occurrenceFile = (repoDir: string, seq: number, stepId: string, file: string, run = 1): string =>
  path.join(runDir(repoDir, run), occurrenceDirName(seq, stepId), file);

/** The manifest a run left behind, parsed. */
export const manifestOf = (repoDir: string, run = 1): RunManifest =>
  JSON.parse(fs.readFileSync(path.join(runDir(repoDir, run), MANIFEST_FILE), 'utf8')) as RunManifest;

/** What {@link recordHistory} saw the run do, in the order it did it. */
export interface HistoryLog {
  /** Every artifact write, as `[occurrence directory, file name, text]`. */
  persisted: [string, string, string][];
  /** Every occurrence closed out, as `[step id, status]`. */
  terminated: [string, string][];
}

/**
 * Wraps the real run-history handle so that the ORDER of its writes is observable.
 *
 * The two orderings AC-5 pins are invisible on disk after the fact — `RunHistory.terminal`
 * guarantees an `output.txt` of its own, so a step that never wrote one leaves the same bytes as a
 * step that did. What differs is which call made the write, and that is what this records.
 */
export function recordHistory(): HistoryLog {
  const persisted: [string, string, string][] = [];
  const terminated: [string, string][] = [];
  const initialise = writer.initialiseRunHistory;
  vi.spyOn(writer, 'initialiseRunHistory').mockImplementation((start, host) => {
    const history = initialise(start, host);
    return {
      ...history,
      persist(occurrence, name, text) {
        persisted.push([occurrence.occurrence_dir, name, text]);
        history.persist(occurrence, name, text);
      },
      terminal(occurrence, status, fields) {
        terminated.push([occurrence.step_id, status]);
        history.terminal(occurrence, status, fields);
      },
    };
  });
  return { persisted, terminated };
}
