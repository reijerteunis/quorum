/**
 * Q-0134 AC-1, AC-3, AC-4 and AC-10 — the diff a step was given, captured where it is produced.
 *
 * **The one measurement this file exists for is AC-1's, and it is about a path a test can be green
 * over while the product is blank.** `preflightDiffs` caches a range into `ctx.diffInputs` only
 * where every endpoint of it already exists; a range whose right endpoint an earlier step of the
 * same flow creates goes to `deferredDiffs`, is materialised by `prompt.ts` at step time and is
 * **never written back**. `chore.yaml` diffs `integration...implement`, whose right endpoint its own
 * first step creates — so over this repository's run history **186 of 208 materialised patches are
 * on the uncached path**. An implementation that read the cache when a gate was reached would be
 * correct on `review.yaml`, green in any test written against it, and blank on every chore run this
 * product performs. Both shapes are driven below, and the deferred one is shown against the cache
 * that does not hold it.
 *
 * Driven through `preflightDiffs` and `materialiseDiff` directly rather than through a whole run,
 * which is `diff.test.ts`'s own arrangement for this module: the claim is about which of the two
 * paths reports, and a run would exercise one of them per fixture while hiding which.
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { eventSchema, type DiffEvidence, type Event } from '@quorum/shared';

import { coreSourceFiles, repoRoot } from '../../test/corpus.js';
import { commitAll, counting, git, removeTempDirs, tempDir, write } from '../../test/repo.js';
import type { TicketRecord } from '../backlog/backlog.js';
import { materialiseDiff, preflightDiffs } from './diff.js';
import type { DeferredDiff, DiffContext, DiffStep, PreflightContext } from './diff.js';

afterAll(removeTempDirs);

const TICKET = 'T-9';
const INTEGRATION = `harness/${TICKET}/integration`;
const IMPLEMENT = `harness/${TICKET}/implement`;

/**
 * A token that is in the change and nowhere else.
 *
 * What makes AC-4's claim assertable at all: *no event carries the patch* is only as strong as the
 * needle, and a word from a fixture's own prose would be found in a range, a path or a notice.
 */
const MARKER = 'zzqq-patch-marker-0134';

/** A repository with `main`, the ticket's integration branch, and a real change on `implement`. */
function repoWithChange({ implement = true } = {}): string {
  const root = tempDir('q0134-');
  git(root, 'init', '-q', '-b', 'main');
  write(path.join(root, 'a.txt'), 'one\n');
  commitAll(root, 'base');
  git(root, 'branch', INTEGRATION);
  if (!implement) return root;
  git(root, 'branch', IMPLEMENT);
  git(root, 'checkout', '-q', IMPLEMENT);
  write(path.join(root, 'b.txt'), `added\n${MARKER}\n`);
  commitAll(root, 'the change');
  git(root, 'checkout', '-q', 'main');
  return root;
}

/** The ticket record this module reads — `meta.id` — with the rest filled in so no cast is needed. */
const ticketRecord = (dir: string): TicketRecord => ({
  dir, folder: `${TICKET}-diff-evidence`, body: 'body\n',
  meta: {
    id: TICKET, title: 'the gate screen shows the diff', stage: 'draft', owner: 'qa', repos: [],
    branch: INTEGRATION, priority: 'p1', created: '2026-09-17', iterations: {}, history: [],
  },
});

/** What one fixture collected: the evidence reported, and every event emitted. */
interface Collected {
  readonly reported: DiffEvidence[];
  readonly events: Event[];
  readonly context: PreflightContext;
}

/** A context over a throwaway repository, collecting both channels rather than discarding them. */
function collecting(repoDir: string, over: Partial<DiffContext> = {}): Collected {
  const reported: DiffEvidence[] = [];
  const events: Event[] = [];
  const context = {
    repoDir,
    config: { repo: { base_branch: 'main' } },
    vars: { id: TICKET, base: 'main', iter: 1, run: 1 },
    ticket: ticketRecord(repoDir),
    runId: 1,
    baseOverride: null,
    emit: (event: Event) => { events.push(event); },
    diffInputs: new Map<string, string>(),
    deferredDiffs: new Map<string, DeferredDiff>(),
    persistence: { appendLog: () => { /* no sink in a direct call */ } },
    reportDiff: (evidence: DiffEvidence) => { reported.push(evidence); },
    flow: { steps: [] },
    ...over,
  } as unknown as PreflightContext;
  return { reported, events, context };
}

/** A flow with one worktree step creating `implement`, then a step reading the chore range. */
const CHORE_SHAPE = [
  { id: 'implement', worktree: true, branch: 'harness/{id}/implement', base: 'harness/{id}/integration' },
  { id: 'review', input: { diff: 'harness/{id}/integration...harness/{id}/implement' } },
];

/** A flow whose one diff site names two refs that already exist — `review.yaml`'s shape. */
const REVIEW_SHAPE = [{ id: 'review', input: { diff: '{base}...harness/{id}/integration' } }];

describe('Q-0134 AC-1 — the capture is at the production site, which is the only one covering a chore run', () => {
  test('a range whose endpoints all exist is reported by the preflight, naming its own site', () => {
    const fixture = collecting(repoWithChange());
    // The integration branch is level with main, so give it something to differ by.
    git(fixture.context.repoDir, 'branch', '-f', INTEGRATION, IMPLEMENT);
    fixture.context.flow = { steps: REVIEW_SHAPE } as unknown as PreflightContext['flow'];

    preflightDiffs(fixture.context);

    expect(fixture.reported).toHaveLength(1);
    expect(fixture.reported[0]?.stepId).toBe('review');
    expect(fixture.reported[0]?.range).toBe(`main...${INTEGRATION}`);
    expect(fixture.reported[0]?.patch).toContain(MARKER);
    // …and this is the path a cache reader would have been right about, which is what makes the
    // clause below a contrast rather than a repetition.
    expect([...fixture.context.diffInputs.keys()]).toStrictEqual([`main...${INTEGRATION}`]);
  });

  test('the chore range is reported at step time, and the cache a gate could read holds NOTHING', () => {
    // **The 89% case.** The range's right endpoint is created by this flow's own first step, so the
    // preflight defers it — and `prompt.ts` materialises it inline without writing it back.
    const fixture = collecting(repoWithChange());
    fixture.context.flow = { steps: CHORE_SHAPE } as unknown as PreflightContext['flow'];

    preflightDiffs(fixture.context);
    // Nothing yet: the preflight reports only what it materialises, and it materialised nothing.
    expect(fixture.reported, 'the preflight materialised a range it was supposed to defer').toStrictEqual([]);
    const range = `${INTEGRATION}...${IMPLEMENT}`;
    expect([...fixture.context.deferredDiffs.keys()]).toStrictEqual([range]);

    // Step time, exactly as `prompt.ts` reaches it: the cache first, and this function when it is a
    // miss. The `??` below is that line, and the left half is the implementation this criterion
    // forbids — shown answering `undefined` rather than being argued about.
    expect(fixture.context.diffInputs.get(range),
      'a reader of ctx.diffInputs would have found the chore range after all').toBeUndefined();
    const prompt = fixture.context.diffInputs.get(range)
      ?? materialiseDiff({ id: 'review', input: { diff: 'harness/{id}/integration...harness/{id}/implement' } }, fixture.context);

    expect(fixture.reported, 'the step-time path reported nothing').toHaveLength(1);
    expect(fixture.reported[0]?.stepId).toBe('review');
    expect(fixture.reported[0]?.range).toBe(range);
    expect(fixture.reported[0]?.patch).toContain(MARKER);
    expect(prompt, 'the prompt and the evidence came from two materialisations').toContain(MARKER);
    // And the cache is STILL empty afterwards, which is what makes a gate-time cache read blank
    // rather than merely late.
    expect([...fixture.context.diffInputs.keys()],
      'the step-time path wrote its bytes back, so the cache is no longer the wrong place to read')
      .toStrictEqual([]);
  });

  test('two members over one range are one materialisation, so a panel is one snapshot', () => {
    // Q-0038 AC-10's identical-bytes guarantee doing the work: the preflight materialises a range
    // once and both members read the cache, so *one snapshot* falls out rather than being a
    // deduplication somebody wrote. The first member's site is the one the evidence names.
    const fixture = collecting(repoWithChange());
    git(fixture.context.repoDir, 'branch', '-f', INTEGRATION, IMPLEMENT);
    fixture.context.flow = {
      steps: [{
        parallel: [
          { id: 'review-claude', input: { diff: '{base}...harness/{id}/integration' } },
          { id: 'review-codex', input: { diff: '{base}...harness/{id}/integration' } },
        ],
      }],
    } as unknown as PreflightContext['flow'];

    preflightDiffs(fixture.context);

    expect(fixture.reported.map((each) => each.stepId)).toStrictEqual(['review-claude']);
  });

  test('the capture costs no additional git invocation', () => {
    // Counted over the real function with the shim first on PATH, both ways, so the claim is about
    // spawns rather than about a line of code that looks cheap.
    const withChannel = counting(() => {
      const fixture = collecting(repoWithChange());
      git(fixture.context.repoDir, 'branch', '-f', INTEGRATION, IMPLEMENT);
      return materialiseDiff({ id: 'review', input: { diff: '{base}...harness/{id}/integration' } }, fixture.context);
    });
    const without = counting(() => {
      const fixture = collecting(repoWithChange());
      git(fixture.context.repoDir, 'branch', '-f', INTEGRATION, IMPLEMENT);
      const { reportDiff, ...bare } = fixture.context;
      void reportDiff;
      return materialiseDiff({ id: 'review', input: { diff: '{base}...harness/{id}/integration' } }, bare as DiffContext);
    });
    // The fixtures spawn git themselves, so what is compared is the difference rather than either
    // total — and the two fixtures are identical, so the difference is the capture's.
    expect(withChannel.calls, 'reporting the evidence spawned git').toBe(without.calls);
    // …and the prompt is byte-identical either way, which is the other half of *costs nothing*.
    expect(withChannel.result).toBe(without.result);
  });
});

describe('Q-0134 AC-3 — the channel is out of band, and the event union is untouched', () => {
  test('a materialisation with no channel supplied is unchanged in every respect', () => {
    const supplied = collecting(repoWithChange());
    git(supplied.context.repoDir, 'branch', '-f', INTEGRATION, IMPLEMENT);
    const site: DiffStep = { id: 'review', input: { diff: '{base}...harness/{id}/integration' } };
    const withChannel = materialiseDiff(site, supplied.context);

    const { reportDiff, ...bare } = supplied.context;
    void reportDiff;
    const withoutEvents: Event[] = [];
    const without = materialiseDiff(site, { ...bare, emit: (event) => withoutEvents.push(event) } as DiffContext);

    expect(without).toBe(withChannel);
    expect(withoutEvents).toStrictEqual([]);
  });

  test('a channel that throws costs one warn and nothing else', () => {
    // `reportRunNumber`'s isolation at a second site: a reporting channel is the caller's, so a
    // throwing one is the caller's defect and may not take the run down. Errors stay explicit —
    // the failure is said out loud rather than swallowed.
    const fixture = collecting(repoWithChange(), {
      reportDiff: () => { throw new Error('the caller blew up'); },
    });
    git(fixture.context.repoDir, 'branch', '-f', INTEGRATION, IMPLEMENT);

    const prompt = materialiseDiff({ id: 'review', input: { diff: '{base}...harness/{id}/integration' } }, fixture.context);

    expect(prompt, 'a throwing channel changed what the step is given').toContain(MARKER);
    const warnings = fixture.events.filter((event) => event.type === 'warn');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ type: 'warn', message: expect.stringContaining('the caller blew up') as unknown as string });
    expect(warnings[0]?.type === 'warn' ? warnings[0].message : '').toContain('review');
  });

  test('the gate question still refuses a field for the diff, at the top level as well', () => {
    // AC-3's structural half. `events.test.ts` refuses `reached.diff` by name; this is the other
    // place a field would go, and `.strict()` is what refuses it. A design that had put the patch on
    // the union would have had to change one of these two lines, which is the point of both.
    const question = {
      type: 'gate', gateId: '1:1', kind: 'human', reason: 'approve to advance', ticketDir: '/x/y',
    };
    expect(eventSchema.safeParse(question).success, 'the fixture is not a valid question').toBe(true);
    expect(eventSchema.safeParse({ ...question, diff: 'x' }).success,
      'the gate question accepted a field for the diff').toBe(false);
  });
});

describe('Q-0134 AC-4 and AC-10 — what is disclosed, and what never reaches an event', () => {
  /** One truncated materialisation over a change larger than the configured cap. */
  const truncated = (limit: number, files: [string, string][]): Collected & { prompt: string } => {
    const root = repoWithChange({ implement: false });
    git(root, 'branch', IMPLEMENT);
    git(root, 'checkout', '-q', IMPLEMENT);
    for (const [name, body] of files) write(path.join(root, name), body);
    commitAll(root, 'a large change');
    git(root, 'checkout', '-q', 'main');
    git(root, 'branch', '-f', INTEGRATION, IMPLEMENT);
    const fixture = collecting(root, { config: { repo: { base_branch: 'main', max_diff_bytes: limit } } });
    const prompt = materialiseDiff({ id: 'review', input: { diff: '{base}...harness/{id}/integration' } }, fixture.context);
    return { ...fixture, prompt };
  };

  test('the notice the step is given is composed from the values the evidence carries', () => {
    // **The agreement is by construction rather than by two renderers being written to match.** Both
    // the prompt's `## Truncation notice` and the evidence come out of one materialisation, so this
    // compares the two consumers of one measurement — the numbers the step was told, against the
    // numbers a browser will be handed. The browser half is `apps/web/src/diff-view.test.ts`; a
    // single test cannot span the two, `apps/web/src` being forbidden to import `@quorum/core`.
    const long = 'x'.repeat(4000);
    const fixture = truncated(600, [['aaa.txt', `${long}\n`], ['zzz.txt', `${long}\n`]]);
    const evidence = fixture.reported[0];
    expect(evidence, 'nothing was reported — this check has lost its subject').toBeDefined();
    if (!evidence) return;

    expect(evidence.truncated).toBe(true);
    expect(fixture.prompt, 'the notice does not state the bytes kept').toContain(String(evidence.kept));
    expect(fixture.prompt, 'the notice does not state the configured limit').toContain(String(evidence.limit));
    expect(evidence.omitted.length, 'the cut left every file some patch — this fixture is the wrong one')
      .toBeGreaterThan(0);
    for (const file of evidence.omitted) {
      expect(fixture.prompt, `the notice does not name ${file}, which the evidence says has no patch`).toContain(file);
    }
    // …and the `--stat` names every file in the range, the omitted ones included, which is what
    // makes naming them useful rather than a list a reader cannot place.
    for (const file of evidence.omitted) expect(evidence.stat).toContain(file);
  });

  test('a cut that leaves every file some patch is that answer and not an empty list', () => {
    // The distinction `diff.ts` already draws, carried on the evidence: `omitted` empty under
    // `truncated` means the cut fell inside a file the reader can see, which is a different and
    // lesser problem than a file having no patch at all.
    const fixture = truncated(400, [['only.txt', `${'y'.repeat(4000)}\n`]]);
    const evidence = fixture.reported[0];
    expect(evidence?.truncated).toBe(true);
    expect(evidence?.omitted).toStrictEqual([]);
    expect(fixture.prompt).toContain('Every file above has some patch and the last one is cut short');
  });

  test('nothing the run emits carries the patch, at the cap', () => {
    const fixture = truncated(600, [['aaa.txt', `${MARKER}\n${'x'.repeat(4000)}\n`], ['zzz.txt', `${MARKER}\n`]]);
    expect(fixture.reported[0]?.patch, 'the evidence does not carry the patch either').toContain(MARKER);
    // Every event the materialisation emitted, serialised — which is every event a subscriber of a
    // real run would be replayed for this step.
    expect(JSON.stringify(fixture.events), 'an event carries the patch').not.toContain(MARKER);
    // …and the `warn` that IS emitted is the truncation notice, so the emptiness above is an
    // absence rather than a fixture that emitted nothing.
    expect(fixture.events.filter((event) => event.type === 'warn').length,
      'the truncation emitted no warning — this check has lost its subject').toBe(1);
  });
});

describe('Q-0134 AC-1 — and no gate-building path reads the range cache', () => {
  /**
   * Every file of `packages/core/src` and `packages/server/src`, keyed from the repository root.
   *
   * Two trees because the claim spans them: the cache is `core`'s and the gate is the daemon's, and
   * the defect this forbids is a reader added at either end.
   */
  const corpus = (): [string, string][] => {
    const walk = (dir: string): [string, string][] => {
      const descend = (here: string, below: string): [string, string][] =>
        fs.readdirSync(here, { withFileTypes: true }).flatMap((entry) => {
          if (['node_modules', 'dist', '.turbo'].includes(entry.name)) return [];
          const key = below === '' ? entry.name : `${below}/${entry.name}`;
          if (entry.isDirectory()) return descend(path.join(here, entry.name), key);
          return /\.tsx?$/.test(entry.name)
            ? [[`${dir}/${key}`, fs.readFileSync(path.join(here, entry.name), 'utf8')] as [string, string]]
            : [];
        });
      return descend(path.join(repoRoot, dir), '');
    };
    return ['packages/core/src', 'packages/server/src'].flatMap(walk);
  };

  /** The needle, assembled so this file is not its own subject. */
  const READS_THE_CACHE = new RegExp(`\\b${'diffInputs'}\\b`);

  test('the corpus has a subject, and it is both trees', () => {
    const names = corpus().map(([name]) => name);
    expect(names.some((name) => name.startsWith('packages/core/src/')), 'core is not in the corpus').toBe(true);
    expect(names.some((name) => name.startsWith('packages/server/src/')), 'the daemon is not in the corpus').toBe(true);
    expect(names.length, 'the walk found implausibly little').toBeGreaterThan(50);
  });

  test('the cache is named by the engine alone, and by no file of the daemon', () => {
    // **`packages/server` is where it would go wrong**, and the reason is measured rather than
    // stylistic: the daemon is what turns a gate id into evidence, and the cache is the reader that
    // is right for `review.yaml` and blank for a chore run. A file there that named it would be one
    // step from a route that answered nothing for 89% of this product's materialisations.
    const readers = corpus().filter(([, text]) => READS_THE_CACHE.test(text)).map(([name]) => name).sort();
    expect(readers.filter((name) => name.startsWith('packages/server/src/')),
      'a file of the daemon reads the engine\'s range cache').toStrictEqual([]);
    // And the engine's own readers are a register rather than a count, so a new one is a visible
    // act. Tests are in it rather than excluded: a suite is as able as a module to grow a second
    // reader of the cache, and the register is what makes either a decision somebody took.
    expect(readers).toStrictEqual([
      'packages/core/src/engine/agent-step.test.ts',
      'packages/core/src/engine/composite.test.ts',
      'packages/core/src/engine/diff-evidence.test.ts',
      'packages/core/src/engine/diff.test.ts',
      'packages/core/src/engine/diff.ts',
      'packages/core/src/engine/engine.ts',
      'packages/core/src/engine/prompt.test.ts',
      'packages/core/src/engine/prompt.ts',
      'packages/core/src/engine/steps.test.ts',
      'packages/core/src/engine/steps.ts',
      'packages/core/src/engine/types.ts',
    ]);
    // The needle discriminates, over fixtures assembled so this file is not its own subject.
    expect(READS_THE_CACHE.test(`const bytes = context.${'diffInputs'}.get(range);`)).toBe(true);
    expect(READS_THE_CACHE.test('const bytes = context.deferred.get(range);')).toBe(false);
  });

  test('and the register is over files that exist, so a rename fails here rather than passing', () => {
    // A register naming a file that is gone excuses nothing and reads as coverage, which is the
    // shape Q-0073 found in `NOT_READ`.
    const present = new Set(coreSourceFiles().map(([name]) => `packages/core/src/${name}`));
    for (const name of ['packages/core/src/engine/diff.ts', 'packages/core/src/engine/prompt.ts']) {
      expect(present.has(name), `${name} is not in core's own source walk`).toBe(true);
    }
  });
});
