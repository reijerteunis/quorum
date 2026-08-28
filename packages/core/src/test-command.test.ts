/**
 * Q-0065: what a test command's result may be trusted to have done.
 *
 * The cache half of this ticket is a one-line change to `harness/harness.yaml` and is asserted in
 * `packages/shared/src/project.test.ts`, beside the other claims about that file. What is left here
 * is the half that belongs to code: that the engine never learns the name of a test runner (AC-5),
 * and that the one variable this workspace's `test` task has to carry actually reaches a package's
 * test process (AC-6, AC-7) so the invocation `real-cli.probe.test.ts` documents is a command that
 * works (AC-8).
 *
 * Neither `spike/src` nor `packages/core/src` is written by this ticket. Reading either is what the
 * corpus tests already do, and the port freeze forbids only writing (harness/port-charter.md §3).
 *
 * Q-0071 adds the same class of claim one layer up. `integrate` runs `harness.yaml`'s command and
 * CI runs `package.json`'s, so Q-0065 closed one of two independent paths; the block at the end of
 * this file asserts that `.github/workflows/ci.yml` closes the other (Q-0071 AC-4).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { coreSourceFiles, repoFile, repoRoot } from '../test/corpus.js';
import { removeTempDirs, tempDir, write } from '../test/repo.js';

afterAll(removeTempDirs);

/** The switch `real-cli.probe.test.ts` reads, and the only variable this workspace's suite needs. */
const SWITCH = 'QUORUM_REAL_CLI';

/** The invocation the probe documents, which AC-6 exists to make work. */
const DOCUMENTED = `${SWITCH}=1 pnpm turbo run test --force --filter @quorum/core`;

const turboConfig = (): { tasks: Record<string, { env?: string[]; passThroughEnv?: string[] }> } =>
  JSON.parse(repoFile('turbo.json')) as { tasks: Record<string, { env?: string[]; passThroughEnv?: string[] }> };

/**
 * The lines of `text` that are not a whole-line comment.
 *
 * A doc-comment naming Turbo is documentation — `fanout/command.ts` quotes this repository's
 * configured command to explain why `runCommand` goes through a shell — while a line of code
 * naming one is the runner knowledge AC-5 keeps out of the engine.
 */
const codeLines = (text: string): string[] =>
  text.split('\n').filter((line) => {
    const trimmed = line.trim();
    return trimmed !== '' && !trimmed.startsWith('*') && !trimmed.startsWith('//') && !trimmed.startsWith('/*');
  });

/** Every `.js` under `spike/src`, at any depth, as `[path below the repository root, text]`. */
function spikeSources(dir = path.join(repoRoot, 'spike/src'), prefix = 'spike/src'): [string, string][] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = entries.flatMap((entry): [string, string][] => {
    const key = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) return spikeSources(path.join(dir, entry.name), key);
    return entry.name.endsWith('.js') ? [[key, fs.readFileSync(path.join(dir, entry.name), 'utf8')]] : [];
  });
  if (!files.length) throw new Error(`corpus empty: ${prefix} holds no .js file — this test proves nothing without one`);
  return files;
}

describe('AC-5 — no engine coupling: the runner is configuration, never code', () => {
  /**
   * The four runners AC-5 names, plus the environment variable shape 3 would have injected —
   * `\b` does not fire inside `TURBO_FORCE`, so that one has to be asked for separately. Word
   * anchors rather than substrings, so an ordinary identifier is never mistaken for a product.
   */
  const RUNNERS = [/\bturbo\b/i, /\bnx\b/i, /\bgradle\b/i, /\bbazel\b/i, /TURBO_FORCE/];

  const sweep = (files: [string, string][]): void => {
    for (const [name, text] of files) {
      for (const line of codeLines(text)) {
        for (const runner of RUNNERS) {
          expect(runner.test(line), `${name} must not name a test runner in code: ${line.trim()}`).toBe(false);
        }
      }
    }
  };

  test('nothing in packages/core/src names a test runner outside a comment', () => {
    sweep(coreSourceFiles());
  });

  test('nothing in spike/src does either — the engine that runs integrate today', () => {
    sweep(spikeSources());
  });

  test('and neither tree parses a runner\'s output or counts its cache hits', () => {
    // The two shapes this ticket refused: read a cache-hit signal out of the output, or inject the
    // one tool's environment variable. Both put a vendor's output format inside the engine.
    for (const [name, text] of [...coreSourceFiles(), ...spikeSources()]) {
      for (const needle of ['cache hit', 'Cached:', 'FULL TURBO']) {
        expect(text.includes(needle), `${name} must not read a runner's cache report: ${needle}`).toBe(false);
      }
    }
  });
});

describe('AC-6 — the workspace declares the switch, and declares it as env', () => {
  test('turbo.json\'s test task lists it under env', () => {
    expect(turboConfig().tasks.test.env).toStrictEqual([SWITCH]);
  });

  test('and not under passThroughEnv, because paid probes must move the task\'s hash', () => {
    // `passThroughEnv` hands the variable to the child without it entering the cache key, so a run
    // with the probes selected and one without would share a cache entry — a replay of the cheap
    // one would then stand for the expensive one.
    expect(turboConfig().tasks.test.passThroughEnv).toBeUndefined();
  });
});

describe('AC-7 — the declaration reaches a package\'s test process', () => {
  /**
   * The real `turbo` this workspace runs. Absent is a failure, never a skip: a propagation proof
   * that quietly does not run is the shape of defect this whole ticket is about.
   */
  const turboBin = (): string => {
    const bin = path.join(repoRoot, 'node_modules/.bin/turbo');
    if (!fs.existsSync(bin)) throw new Error(`corpus missing: ${bin} — install the workspace before asserting what turbo passes`);
    return bin;
  };

  /**
   * A throwaway workspace whose one package's `test` script prints what it can see, carrying THIS
   * repository's `test` task definition verbatim. Running this repository's own suite instead would
   * make the check spawn the run it is running inside.
   *
   * @returns the line the fixture's test process printed, naming every `QUORUM_` variable it could
   *   see. A run that printed no such line throws rather than returning: an absence proves nothing
   *   about what was stripped if the reader never ran, and the negative assertions below would pass
   *   over it in silence.
   */
  const seenBy = (task: unknown, environment: Record<string, string>): string => {
    const root = tempDir('q0065-turbo-');
    write(path.join(root, 'package.json'), JSON.stringify({
      name: 'q0065-fixture', private: true, packageManager: 'npm@11.0.0', workspaces: ['reader'],
    }));
    write(path.join(root, 'package-lock.json'), JSON.stringify({
      name: 'q0065-fixture', lockfileVersion: 3, requires: true,
      packages: { '': { name: 'q0065-fixture', workspaces: ['reader'] }, 'reader': {} },
    }));
    write(path.join(root, 'turbo.json'), JSON.stringify({ $schema: 'https://turbo.build/schema.json', tasks: { test: task } }));
    write(path.join(root, 'reader/package.json'), JSON.stringify({
      name: 'reader', version: '0.0.0', private: true, scripts: { test: 'node read-env.mjs' },
    }));
    // A file rather than `node -e`, because npm runs a script through a shell and every quoting
    // style this needs means something to that shell.
    write(path.join(root, 'reader/read-env.mjs'),
      'const seen = Object.keys(process.env).filter((k) => k.startsWith("QUORUM_")).sort();\n'
      + 'console.log("SEEN " + seen.map((k) => k + "=" + process.env[k]).join(" "));\n');
    const output = execFileSync(turboBin(), ['run', 'test', '--force', '--output-logs=full'], {
      cwd: root, encoding: 'utf8', env: { ...process.env, ...environment }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!output.includes('SEEN ')) throw new Error(`the fixture's test process never reported what it saw:\n${output}`);
    return output;
  };

  test('a variable this repository declares arrives; one it does not is stripped', () => {
    // Both halves in one run, so the negative is a control rather than a second opinion: turbo's
    // strict env mode removes what is not declared, and the declaration is what makes the
    // difference. Without the control, a green tick would also be what a turbo that passed
    // everything through looks like.
    const seen = seenBy(turboConfig().tasks.test, { [SWITCH]: '1', QUORUM_NOT_DECLARED: '1' });
    expect(seen).toContain(`${SWITCH}=1`);
    expect(seen).not.toContain('QUORUM_NOT_DECLARED');
  }, 180_000);

  test('and the declaration is load-bearing: the same task without it strips the switch too', () => {
    // The subject demonstrated before the guard is trusted (Q-0069): this is `turbo.json` as it
    // stood before AC-6, which is why the documented command reported `skipped`, always.
    const seen = seenBy({ outputs: [] }, { [SWITCH]: '1' });
    expect(seen).not.toContain(`${SWITCH}=1`);
  }, 180_000);
});

describe('AC-8 — the probe documents one invocation, and it is the one that works', () => {
  const probe = (): string => repoFile('packages/core/src/adapters/real-cli.probe.test.ts');

  test('the documented command is the turbo one, forced, and there is no second spelling', () => {
    expect(probe()).toContain(DOCUMENTED);
    for (const rival of ['npx vitest', 'pnpm vitest', 'vitest run src/adapters/real-cli.probe.test.ts']) {
      expect(probe().includes(rival), `a second invocation to disambiguate: ${rival}`).toBe(false);
    }
  });

  test('and it still reports skipped rather than passed when the switch is absent', () => {
    expect(probe()).toContain(`describe.skipIf(!process.env.${SWITCH})`);
  });
});

/** The workspace tasks CI's required check claims to have executed rather than replayed. */
const WORKSPACE_TASKS = ['lint', 'typecheck', 'test'];

/** As much of a GitHub Actions step as these assertions read. */
interface WorkflowStep {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
}

/** As much of a workflow file as these assertions read. */
interface Workflow {
  jobs?: Record<string, { steps?: WorkflowStep[] } | undefined>;
}

/**
 * Whether `steps` invoke `task` in a form no cache entry can satisfy.
 *
 * Word-wise rather than by substring, so `--force-something` is not read as the flag and a task
 * name inside a longer word is not read as the task. One step naming several tasks satisfies all
 * of them, which is right: AC-1 asks for the property, not for one spelling of it.
 */
const executes = (steps: WorkflowStep[], task: string): boolean =>
  steps.some((step) => {
    const words = (step.run ?? '').split(/\s+/);
    return ['turbo', 'run', task, '--force'].every((word) => words.includes(word));
  });

/**
 * Whether any step in `flow` restores or saves a turbo result cache.
 *
 * Read from each step's `with` block rather than from the file's text, so the comment above the
 * job — which has to name both the cache and the flag in order to say what the tick claims —
 * cannot fail the assertion it exists to explain. Action-agnostic on purpose: the criterion is
 * about a task-result cache, not about who provides one. `actions/setup-node`'s `cache: pnpm`
 * carries neither marker, which is the point of keeping it.
 *
 * Both markers match anywhere in the value, never only at its start: AC-4(b) refuses a `turbo-`
 * cache key, and `v1-turbo-${{ github.sha }}` is one. Matching the whole `with` block rather than
 * a list of cache-action key names errs toward refusing too much — an unrelated value containing
 * `turbo-` would fail this loudly, which is the right direction for a guard whose subject is a
 * check that reports green having examined nothing.
 */
const restoresTaskCache = (flow: Workflow): boolean =>
  Object.values(flow.jobs ?? {}).some((job) =>
    (job?.steps ?? []).some((step) =>
      Object.values(step.with ?? {})
        .map((value) => String(value))
        .some((value) => value.includes('.turbo') || value.includes('turbo-'))));

/**
 * `.github/workflows/ci.yml` as it stood before this ticket, verbatim through the `workspace` job.
 *
 * A guard whose only evidence is a green run has not been shown to have a subject (Q-0069). This
 * is the text the criterion calls defective, and both assertions below fail over it.
 */
const BEFORE_Q0071 = `name: CI

on:
  push:
  pull_request:

jobs:
  workspace:
    name: workspace (lint, typecheck, test)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      # Turbo's local cache, so a re-run of an unchanged task is a hit rather than a repeat.
      - uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-\${{ runner.os }}-\${{ github.sha }}
          restore-keys: turbo-\${{ runner.os }}-
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
`;

/**
 * A turbo result cache that this guard's first form read as clean.
 *
 * Two evasions at once, and each defeats one half of the marker pair: the key is *prefixed*, so
 * `turbo-` is not where the value starts, and the path is turbo's `--cache-dir` pointed away from
 * `.turbo`, so the path half cannot carry the assertion on the key half's behalf. Every task is
 * forced, so the only thing wrong with this workflow is the cache — which is what makes it a test
 * of AC-4(b) rather than of AC-4(a).
 */
const PREFIXED_TURBO_CACHE = `name: CI

on:
  push:

jobs:
  workspace:
    name: workspace (lint, typecheck, test)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v4
        with:
          path: node_modules/.cache/turbo
          key: v1-turbo-\${{ runner.os }}-\${{ github.sha }}
          restore-keys: |
            v1-turbo-\${{ runner.os }}-
      - run: pnpm turbo run lint --force
      - run: pnpm turbo run typecheck --force
      - run: pnpm turbo run test --force
`;

describe('Q-0071 AC-4 — CI executes its checks rather than replaying them', () => {
  const ciText = (): string => repoFile('.github/workflows/ci.yml');

  const workflow = (text: string): Workflow => parseYaml(text) as Workflow;

  /**
   * The `workspace` job's steps. An absent job throws rather than yielding an empty list: a
   * renamed job would otherwise turn every assertion below into a pass over nothing.
   */
  const workspaceSteps = (text: string): WorkflowStep[] => {
    const steps = workflow(text).jobs?.workspace?.steps;
    if (!steps?.length) throw new Error('the workflow declares no `workspace` job with steps');
    return steps;
  };

  test.each(WORKSPACE_TASKS)('%s is invoked in a form no cache entry can satisfy', (task) => {
    expect(executes(workspaceSteps(ciText()), task), `${task} must be executed, not replayed`).toBe(true);
  });

  test('no step restores or saves a turbo result cache', () => {
    expect(restoresTaskCache(workflow(ciText()))).toBe(false);
  });

  test('and the workflow selects the live-CLI probes nowhere', () => {
    // A runner has no subscription login, so `real-cli.probe.test.ts`'s `describe.skipIf` must keep
    // skipping there. Forcing `test` means CI now executes that file and reports it skipped, which
    // is the honest outcome rather than a change of behaviour.
    expect(ciText()).not.toContain(SWITCH);
  });

  test('the guard has a subject — the workflow as it stood before this ticket fails it', () => {
    for (const task of WORKSPACE_TASKS) {
      expect(executes(workspaceSteps(BEFORE_Q0071), task), `${task} was replayable before this ticket`).toBe(false);
    }
    expect(restoresTaskCache(workflow(BEFORE_Q0071)), 'the turbo result cache was restored before this ticket').toBe(true);
  });

  test('and a prefixed key is refused too — `turbo-` is read anywhere in the value', () => {
    // The second subject, for the half of (b) the first fixture cannot reach: `BEFORE_Q0071` fails
    // on `path: .turbo` as well as on its key, so it would still fail if the key check did nothing.
    for (const task of WORKSPACE_TASKS) {
      expect(executes(workspaceSteps(PREFIXED_TURBO_CACHE), task), `${task} is forced in this fixture`).toBe(true);
    }
    expect(restoresTaskCache(workflow(PREFIXED_TURBO_CACHE)), 'v1-turbo-… names a turbo result cache').toBe(true);
  });
});

/**
 * The tasks a `turbo run` command names — the word after `run`, once per invocation.
 *
 * Word-wise for the same reason {@link executes} is: a task name inside a longer word is not the
 * task, and a command that does not invoke turbo names none.
 */
const turboTasks = (command: string): string[] => {
  const words = command.split(/\s+/);
  return words.flatMap((word, index) =>
    word === 'run' && words[index - 1] === 'turbo' && words[index + 1] !== undefined ? [words[index + 1]] : []);
};

describe('Q-0072 AC-9 — package.json and CI name the same task set', () => {
  /**
   * Q-0071 moved CI off `package.json`'s scripts and onto `turbo run … --force` directly, for a
   * reason that stands: the force belongs in the file a reader of a CI result opens. The cost is
   * that the three root scripts are no longer what CI runs, and they were identical the day that
   * shipped with nothing saying they stay so. This is that guard, and nothing more — whether the
   * two should be one command is the successor's question, not this one's.
   */
  const scripts = (): Record<string, string> =>
    (JSON.parse(repoFile('package.json')) as { scripts: Record<string, string> }).scripts;

  /** The `workspace` job's steps. An absent job throws rather than yielding a passing empty list. */
  const jobSteps = (text: string): WorkflowStep[] => {
    const steps = (parseYaml(text) as Workflow).jobs?.workspace?.steps;
    if (!steps?.length) throw new Error('the workflow declares no `workspace` job with steps');
    return steps;
  };

  const namedBy = (commands: string[]): string[] => [...new Set(commands.flatMap(turboTasks))].sort();

  test('the workspace job runs exactly the tasks the root scripts do', () => {
    const fromScripts = namedBy(Object.values(scripts()));
    expect(fromScripts, 'the root scripts must name at least the three workspace tasks').toStrictEqual(WORKSPACE_TASKS.slice().sort());
    expect(namedBy(jobSteps(repoFile('.github/workflows/ci.yml')).map((step) => step.run ?? ''))).toStrictEqual(fromScripts);
  });

  test('and the scripts stay unforced, with no second spelling beside them', () => {
    // Q-0071 rejected both `--force` in `package.json` and a `test:ci` script. A developer's local
    // run is where a cache earns its keep, and one name per task is why a reader knows what ran.
    for (const [name, command] of Object.entries(scripts())) {
      expect(command.split(/\s+/).includes('--force'), `${name} must stay unforced`).toBe(false);
      expect(name.endsWith(':ci'), `${name} is a second spelling of a task CI already names`).toBe(false);
    }
  });

  test('the guard has a subject — a workflow that drops a task fails it', () => {
    // Isolated to this clause: every task the fixture *does* name is forced and it restores no
    // cache, so `typecheck` going missing is the only thing wrong with it.
    const dropped = BEFORE_Q0071
      .replace('      - run: pnpm lint\n      - run: pnpm typecheck\n      - run: pnpm test\n',
        '      - run: pnpm turbo run lint --force\n      - run: pnpm turbo run test --force\n');
    expect(namedBy(jobSteps(dropped).map((step) => step.run ?? ''))).toStrictEqual(['lint', 'test']);
    expect(namedBy(Object.values(scripts()))).toStrictEqual(['lint', 'test', 'typecheck']);
  });
});
