/**
 * Q-0093 AC-2 and AC-3 for `quorum ticket new`.
 *
 * **The translated binary half of `spike/test/q0080-allocation.js`** — A7 (three sequential
 * allocations), A8 (the three refusals, each one line and exit 1, and `--id` as the escape hatch
 * that still works afterwards) and the `project()` / `cli` / `folders` helpers those scenarios are
 * built on. `spike-parity.test.ts` records the transfer on that file's row as `binaryCarriedBy`.
 *
 * **The allocation table itself is not re-asserted here.** Its rows are `Backlog.nextId` and
 * `Backlog.create` behaviour, they landed with Q-0080, and
 * `packages/core/src/backlog/backlog.test.ts` reads them out of `spike/test/q0080-allocation.json`
 * — the one copy both trees assert over. A second description of them in this package would be free
 * to drift from the first, which is the defect this repository keeps finding. What is claimed here
 * is that the CLI *reaches* that behaviour, and that a refusal arrives as a sentence and a status
 * rather than as a stack trace.
 *
 * **Every fixture is made by running `init`**, which is the composition A7's own title claims —
 * *"init then three ticket new gives T-0001, T-0002, T-0003"*. Hand-building a project directory
 * would be the same filesystem work without the assertion that `init` produced it. A9's `board` and
 * `runs` invocations are Q-0099's and Q-0092's, per `spike-parity.test.ts`'s own ruling on that row.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { findProject } from '@quorum/core';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { ERROR, SUCCESS } from './exit.js';
import { invoke, plain, type Invocation } from '../test/invoke.js';

let project = '';
let cwd = '';

beforeEach(async () => {
  // Realpathed for the reason `init.test.ts` gives: `os.tmpdir()` is a symlink on macOS and the
  // success line below carries a path this fixture has to be able to predict.
  project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-ticket-')));
  cwd = process.cwd();
  process.chdir(project);
  expect((await invoke(['init'])).exitCode, 'the fixture project was not scaffolded').toBe(SUCCESS);
});

afterEach(() => {
  process.chdir(cwd);
  fs.rmSync(project, { recursive: true, force: true });
});

/** The ticket folders in `dir`'s backlog, sorted — `q0080-allocation.js`'s `folders` helper. */
const folders = (dir: string = project): string[] => fs.readdirSync(path.join(dir, 'backlog')).sort();

/** One field of a created ticket's frontmatter, read out of the file's own text. */
const field = (folder: string, key: string): string | null =>
  new RegExp(`^${key}: (.*)$`, 'm').exec(fs.readFileSync(path.join(project, 'backlog', folder, 'ticket.md'), 'utf8'))?.[1] ?? null;

/** What a refusal must look like whatever it is refusing: one line, exit 1, and no stack. */
function refusal(result: Invocation, sentence: string): void {
  expect(result.exitCode).toBe(ERROR);
  expect(result.hard, 'a refusal that did not stop the command').toBe(true);
  expect(plain(result.stderr)).toContain(sentence);
  expect(plain(result.stderr).trimEnd().split('\n'), `not one line: ${result.stderr}`).toHaveLength(1);
  expect(result.stderr.includes('\n    at '), 'a stack trace tells an adopter the product crashed').toBe(false);
}

describe('AC-2 — the allocation is reached through the CLI, and the table\'s binary half runs', () => {
  test('A7 — init then three `ticket new` gives T-0001, T-0002, T-0003, each its own folder', async () => {
    // The same title three times, which is what makes the folder assertion mean something: the slug
    // is identical and only the id keeps them apart.
    for (const expected of ['T-0001', 'T-0002', 'T-0003']) {
      const { exitCode, stdout, stderr } = await invoke(['ticket', 'new', 'The same title', '--intent', 'i']);
      expect(exitCode, stderr).toBe(SUCCESS);
      expect(plain(stdout)).toContain(expected);
    }
    expect(folders()).toStrictEqual(['T-0001-the-same-title', 'T-0002-the-same-title', 'T-0003-the-same-title']);
    for (const folder of folders()) {
      expect(fs.existsSync(path.join(project, 'backlog', folder, 'ticket.md')), `${folder} kept its ticket.md`).toBe(true);
    }
  });

  test('AC-2(e) — the success line names the id, the path relative to the working directory and the stage', async () => {
    const { stdout } = await invoke(['ticket', 'new', 'First ticket', '--intent', 'i']);
    expect(plain(stdout).trimEnd()).toBe(`✓ T-0001 created at ${path.join('backlog', 'T-0001-first-ticket')} (stage: draft)`);
  });

  test('A8 — a backlog it cannot read refuses, names what it found, and offers the way past', async () => {
    expect((await invoke(['ticket', 'new', 'First', '--intent', 'i', '--id', 'Q-0006'])).exitCode).toBe(SUCCESS);
    expect((await invoke(['ticket', 'new', 'Second', '--intent', 'i', '--id', 'T-0007'])).exitCode).toBe(SUCCESS);

    const mixed = await invoke(['ticket', 'new', 'Third', '--intent', 'i']);
    refusal(mixed, 'the backlog uses more than one prefix — Q- (1), T- (1)');
    expect(plain(mixed.stderr)).toContain('pass --id <ID> or reconcile the backlog');

    refusal(
      await invoke(['ticket', 'new', 'Anything', '--intent', 'i', '--id', 'Q-0006']),
      'ticket id already taken: Q-0006 already belongs to Q-0006-first',
    );
    refusal(await invoke(['ticket', 'new', 'Anything', '--intent', 'i', '--id', 'q-1']), "not a ticket id: 'q-1'");

    // The escape hatch is what makes a refusal survivable rather than a dead end.
    expect((await invoke(['ticket', 'new', 'Fourth', '--intent', 'i', '--id', 'Q-0081'])).exitCode).toBe(SUCCESS);
    expect(folders()).toStrictEqual(['Q-0006-first', 'Q-0081-fourth', 'T-0007-second']);
  });

  test('and a refusal writes nothing — the backlog is the same folders it was', async () => {
    // A9's library half as it reaches the CLI: an allocation refusal leaves what is on disk alone,
    // so the backlog a later `--id` allocates into is the one that was there.
    expect((await invoke(['ticket', 'new', 'First', '--intent', 'i', '--id', 'Q-0006'])).exitCode).toBe(SUCCESS);
    const before = folders();
    expect((await invoke(['ticket', 'new', 'Anything', '--intent', 'i', '--id', 'Q-0006'])).exitCode).toBe(ERROR);
    expect(folders()).toStrictEqual(before);
  });

  test('AC-2(a)/(b) — a subcommand that is not `new` prints the usage line, and an absent title refuses', async () => {
    refusal(await invoke(['ticket']), 'usage: harness ticket new "<title>" --intent "..." [--id Q-0081]');
    refusal(await invoke(['ticket', 'list']), 'usage: harness ticket new');
    refusal(await invoke(['ticket', 'new']), 'title required');
    expect(folders(), 'a refusal allocated a folder anyway').toStrictEqual([]);
  });

  test('and that usage line calls the binary `harness`, which is preserved and is Q-0100\'s to rule', async () => {
    // Why: preserved — the class is Q-0100's, which exists to rule the board's hint,
    // `ProjectNotFoundError`'s sentence, `validate`'s usage and `init`'s next steps at once. Pinned
    // so the successor has an executable subject and so a rename here would be a deliberate act.
    expect(plain((await invoke(['ticket'])).stderr)).toContain('harness ticket new');
  });

  test('AC-2(c) — an absent --intent falls back to the title, which is the ticket\'s body', async () => {
    // One of the four argument expressions the criterion preserves: `flags.intent ?? title`.
    await invoke(['ticket', 'new', 'A title that is also the intent']);
    const body = fs.readFileSync(path.join(project, 'backlog', 'T-0001-a-title-that-is-also-the-intent', 'ticket.md'), 'utf8');
    expect(body.split('---\n')[2]).toBe('A title that is also the intent\n');
  });

  test('AC-2(f) — the project comes from `loadProject`: ancestor discovery, --project, and a configured backlog path', async () => {
    // All three routes, because the command constructs no `backlog/` path of its own and
    // reimplements no discovery. Q-0091 erratum E-6 is why `--project` is passed through rather than
    // read here: the spike reads that flag inside its own `loadProject`.
    fs.mkdirSync(path.join(project, 'deep', 'deeper'), { recursive: true });
    process.chdir(path.join(project, 'deep', 'deeper'));
    expect((await invoke(['ticket', 'new', 'From below', '--intent', 'i'])).exitCode).toBe(SUCCESS);
    process.chdir(project);
    expect(folders()).toStrictEqual(['T-0001-from-below']);

    const elsewhere = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-ticket-elsewhere-')));
    try {
      // A project whose config names a backlog somewhere other than `backlog/`, so an implementation
      // joining `<repo>/backlog` by hand would allocate into the wrong directory and still pass
      // every other assertion in this file.
      fs.mkdirSync(path.join(elsewhere, 'harness'), { recursive: true });
      fs.writeFileSync(path.join(elsewhere, 'harness', 'harness.yaml'), 'backlog:\n  path: tickets\n');
      expect((await invoke(['ticket', 'new', 'Configured', '--intent', 'i', '--project', elsewhere])).exitCode).toBe(SUCCESS);
      expect(fs.readdirSync(path.join(elsewhere, 'tickets'))).toStrictEqual(['T-0001-configured']);
      expect(fs.existsSync(path.join(elsewhere, 'backlog')), 'it allocated into a backlog it invented').toBe(false);
    } finally {
      fs.rmSync(elsewhere, { recursive: true, force: true });
    }
  });

  test('and a directory with no project above it refuses with core\'s own sentence rather than a stack', async () => {
    // `loadProject` throws where the CLI's own version called `die`; uncaught, that reaches
    // `dieOnUnexpected` and prints a Node stack where the spike prints one sentence. Reached by
    // *ancestor discovery* — no `--project` — because that is the route that can answer "no project"
    // at all: with an explicit directory the spike resolves it and reads the file, which is the row
    // below.
    const orphan = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-ticket-orphan-')));
    try {
      expect(findProject(orphan), `${orphan} sits inside a project, so this fixture is not orphaned`).toBeNull();
      process.chdir(orphan);
      refusal(await invoke(['ticket', 'new', 'Nowhere']), 'no harness/harness.yaml found');
    } finally {
      process.chdir(project);
      fs.rmSync(orphan, { recursive: true, force: true });
    }
  });

  test('while `--project` at a directory that is no project raises, which is preserved', async () => {
    // Why: preserved — `loadProject(dir)` consults `findProject` only when `dir` is absent, so an
    // explicit `--project` is resolved and its `harness/harness.yaml` opened, and an absent one is
    // an `ENOENT` rather than the sentence above. `lint.test.ts` pins the identical behaviour for
    // Q-0091's command; both are the spike's `flags.project ? path.resolve(…) : findProject()`.
    const orphan = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-ticket-noconfig-')));
    try {
      await expect(invoke(['ticket', 'new', 'Nowhere', '--project', orphan])).rejects.toThrow(/ENOENT/);
    } finally {
      fs.rmSync(orphan, { recursive: true, force: true });
    }
  });
});

describe('AC-3 — four preserved defects, demonstrated and pinned rather than repaired', () => {
  test('(a) `--owner` with no value writes the boolean true into the frontmatter', async () => {
    // Why: preserved defect — `argv.ts:54` gives a flag the value `true` when the next token is
    // another flag or absent, and `create`'s destructuring default fires only on `undefined`, so
    // `owner` is written as `true`. Two lines apart in two packages, and neither is wrong on its own.
    // The requirement derived this from those two lines without executing it (merged.md R-9); this
    // is the execution, and the reading holds.
    expect((await invoke(['ticket', 'new', 'Owned', '--owner'])).exitCode).toBe(SUCCESS);
    expect(field('T-0001-owned', 'owner')).toBe('true');
  });

  test('(b) `--intent` with no value reports a JavaScript message on a user-facing path', async () => {
    // Why: preserved defect — the boolean reaches `intent.trim()` inside `create`, and the `catch`
    // turns the `TypeError` into a refusal whose sentence is the engine's rather than the product's.
    refusal(await invoke(['ticket', 'new', 'Intentless', '--intent']), 'intent.trim is not a function');
  });

  test('and that failure leaves an empty ticket folder behind, which is measured and not fixed here', async () => {
    // **Found by running (b) rather than by reading it, and reported rather than repaired.**
    // `Backlog.create` performs its three checks before creating anything and then does
    // `mkdirSync(dir)` *before* evaluating `intent.trim()` — `backlog.ts:206-209`, and
    // `spike/src/backlog.js:128-131` identically — so a bad `--intent` allocates the directory and
    // throws on the next expression, leaving a folder with no `ticket.md` in it. The consequence is
    // the one that matters: that folder is not a ticket to `list()`, and it *is* a taken id to
    // `create()`, so the next allocation refuses `T-0001` and a `ticket new` with a good intent
    // cannot use the id its own failed predecessor consumed.
    //
    // It is in both trees and it is `core`'s, so ground rule 3 makes it a report and not a fix; the
    // method's own doc comment says a refusal leaves the backlog byte for byte as it was, which is
    // true of its three *checks* and not of an argument that is the wrong type. Pinned so a later
    // repair is a deliberate act and so the claim is executable rather than prose.
    refusal(await invoke(['ticket', 'new', 'Intentless', '--intent']), 'intent.trim is not a function');
    expect(folders()).toStrictEqual(['T-0001-intentless']);
    expect(fs.readdirSync(path.join(project, 'backlog', 'T-0001-intentless')), 'the folder holds a ticket after all')
      .toStrictEqual([]);
    refusal(
      await invoke(['ticket', 'new', 'Intentless', '--intent', 'a real intent']),
      'ticket folder already exists: T-0001-intentless',
    );
  });

  test('(c) `--id` with no value is coerced to the string `true` and refused as a bad id', async () => {
    // Why: preserved — `String(flags.id)` is what makes every non-string reach one grammar rather
    // than several, and the resulting message is the grammar's own. Deliberate in the spike.
    refusal(await invoke(['ticket', 'new', 'Idless', '--intent', 'i', '--id']), "not a ticket id: 'true'");
  });

  test('(d) `owner` defaults to $USER, which is the value guaranteed not to identify anyone', async () => {
    // Why: preserved defect, see Q-0093 AC-13(a). `Backlog.create` defaults `owner` to
    // `process.env.USER ?? 'unknown'`, so every ticket allocated without `--owner` is stamped with
    // the operating-system account of whoever ran the command — on a shared machine, in CI, in a
    // container, or in any of the worktree-based steps this repository's own flows create. Corrected
    // by hand in this backlog three times and reproduced every time, because nothing about the
    // correction reaches the code. Whether the product should default an owner at all is product
    // behaviour and is its successor's to rule.
    //
    // **The test controls the environment and restores it**, rather than reading the ambient
    // account: a verdict taken from `$USER` would be a property of the machine — *"A test's verdict
    // is a property of the commit, not of the checkout or the account"* (2026-08-30) — which is the
    // defect this repository has now paid for four times, reproduced inside a criterion written to
    // pin one.
    const saved = process.env.USER;
    try {
      process.env.USER = 'somebody-else';
      expect((await invoke(['ticket', 'new', 'Stamped', '--intent', 'i'])).exitCode).toBe(SUCCESS);
      expect(field('T-0001-stamped', 'owner')).toBe('somebody-else');

      delete process.env.USER;
      expect((await invoke(['ticket', 'new', 'Anonymous', '--intent', 'i'])).exitCode).toBe(SUCCESS);
      expect(field('T-0002-anonymous', 'owner')).toBe('unknown');
    } finally {
      if (saved === undefined) delete process.env.USER;
      else process.env.USER = saved;
    }
  });

  test('and an explicit --owner is what the flag is for, so the default is a default and not a rule', async () => {
    // The discriminating half: without it the two rows above would hold for an implementation that
    // ignored `--owner` entirely and always wrote the environment's answer.
    const saved = process.env.USER;
    try {
      process.env.USER = 'somebody-else';
      expect((await invoke(['ticket', 'new', 'Assigned', '--intent', 'i', '--owner', 'ruud'])).exitCode).toBe(SUCCESS);
      expect(field('T-0001-assigned', 'owner')).toBe('ruud');
    } finally {
      if (saved === undefined) delete process.env.USER;
      else process.env.USER = saved;
    }
  });
});
