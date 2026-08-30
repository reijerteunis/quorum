// Q-0051: the diff preflight and materialisation, ported from spike/src/engine.js.
//
// Every fixture builds its own throwaway repository. Nothing here asserts the containment state of
// a branch in THIS repository — that would be red only until the next landing and green forever
// after, which the permanent-acceptance-test decision (2026-08-23) exists to prevent.
//
// Two habits carried across from q0035-empty-range.js, both from that ticket's risk list. No whole
// sentence is asserted: required evidence must be present and prohibited claims absent, because a
// punctuation-sensitive snapshot breaks on every rewording and proves nothing. And a short SHA is
// never assumed to be a fixed width — git chooses the abbreviation.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';
import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';

import type { Event, Flow } from '@quorum/shared';

import { loadProject } from '../backlog/project.js';
import type { TicketRecord } from '../backlog/backlog.js';
import { coreSourceFiles } from '../../test/corpus.js';
import { commitAll, counting, git, removeTempDirs, tempDir, write } from '../../test/repo.js';
import * as diffModule from './diff.js';
import { materialiseDiff, preflightDiffs, trimIncompleteUtf8Suffix } from './diff.js';
import type { DeferredDiff, DiffContext, DiffStep, EndpointProducer, PreflightContext } from './diff.js';
import { runFlow } from './engine.js';
import { loadFlow } from './loaders.js';
import * as routing from './routing.js';
import { FlowError } from './types.js';
import type { RunFlowOptions, RunContext } from './types.js';

afterAll(removeTempDirs);
afterEach(() => { vi.restoreAllMocks(); });

/** Q-0035 AC-2's list: what a message may never claim, since an ancestry check establishes none of it. */
const FORBIDDEN = /\b(merged|landed|shipped|rebased|cherry-picked|reset)\b|already in\b/i;

const TICKET = 'T-9';
const BRANCH = `harness/${TICKET}/integration`;
const WRITTEN = '{base}...harness/{id}/integration';
const STEP: DiffStep = { id: 'review-claude', input: { diff: WRITTEN } };

/** A repository with one commit on main and, unless told otherwise, the ticket branch beside it. */
function repoWith({ branch = true } = {}): string {
  const root = tempDir('q0051-');
  git(root, 'init', '-q', '-b', 'main');
  write(path.join(root, 'a.txt'), 'one\n');
  commitAll(root, 'base');
  if (branch) git(root, 'branch', BRANCH);
  return root;
}

/** A commit on `branch` carrying `tree`, made without checking anything out. */
function branchAt(root: string, branch: string, tree: string, parent: string, message: string): void {
  const sha = git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit-tree', tree, '-p', parent, '-m', message);
  git(root, 'branch', branch, sha);
}

/**
 * A ticket record with the fields this module reads — `meta.id` — and the rest filled in so no cast
 * is needed. `appendLog` only ever passes it back to the caller's own sink.
 */
const ticketRecord = (dir: string): TicketRecord => ({
  dir, folder: `${TICKET}-diff`, body: 'body\n',
  meta: {
    id: TICKET, title: 'diff', stage: 'draft', owner: 'qa', repos: [], branch: BRANCH,
    priority: 'p1', created: '2026-08-30', iterations: {}, history: [],
  },
});

/** The narrowed context {@link materialiseDiff} reads, over a throwaway repository. */
function contextFor(repoDir: string, vars: Record<string, unknown>, overrides: Partial<DiffContext> = {}): DiffContext {
  return {
    repoDir,
    config: { repo: { base_branch: 'main' } },
    vars,
    ticket: ticketRecord(repoDir),
    runId: 1,
    baseOverride: null,
    deferredDiffs: new Map<string, DeferredDiff>(),
    persistence: { appendLog: () => { /* no sink in a direct call */ } },
    ...overrides,
  };
}

/**
 * One producer as the preflight records it — the classified endpoint itself, `class` and all, which
 * is what `toStrictEqual` over a real run's map proves it stores.
 */
const producer = (side: 'left' | 'right', ref: string, step: string): EndpointProducer =>
  ({ side, ref, step, class: 'step-created' });

/** Whatever `materialiseDiff` threw, or `null` when it returned. */
function failure(step: DiffStep, context: DiffContext): Error | null {
  try { materialiseDiff(step, context); } catch (error) { return error as Error; }
  return null;
}

/**
 * Q-0035 AC-1's five elements, asserted together: a message missing any one of them cannot be
 * re-checked by hand, which is the whole point.
 */
function assertEvidence(
  message: string,
  { root, left = 'main', right = BRANCH, range, written, outcome }:
  { root: string; left?: string; right?: string; range: string; written: string; outcome: string },
): void {
  const leftSha = git(root, 'rev-parse', '--short', left);
  const rightSha = git(root, 'rev-parse', '--short', right);
  expect(message, 'names the interpolated range').toContain(`\`${range}\``);
  expect(message, 'names the range as the flow file writes it').toContain(`\`${written}\``);
  expect(message).toContain(left);
  expect(message).toContain(right);
  expect(message, `names the left short SHA ${leftSha}`).toContain(leftSha);
  expect(message, `names the right short SHA ${rightSha}`).toContain(rightSha);
  expect(message, 'quotes the check it ran').toContain(`git merge-base --is-ancestor ${right} ${left}`);
  expect(message, `states the outcome "${outcome}"`).toContain(outcome);
  expect(message, 'the message claims a historical event').not.toMatch(FORBIDDEN);
}

// ---------------------------------------------------------------------------------------------
// AC-1 / AC-2 — the module's shape
// ---------------------------------------------------------------------------------------------

describe('Q-0051 AC-1/AC-2 — the module boundary', () => {
  test('AC-2 — the exported contract is exactly three symbols', () => {
    expect(Object.keys(diffModule).sort()).toStrictEqual(['materialiseDiff', 'preflightDiffs', 'trimIncompleteUtf8Suffix']);
    for (const value of Object.values(diffModule)) expect(typeof value).toBe('function');
  });

  test('AC-2 — RunContext satisfies the narrowed context, and one missing deferredDiffs does not', () => {
    // The compile-time half. `engine.ts` hands `preflightDiffs` the whole run context and typechecks,
    // which is the positive proof; this is the negative one, and each directive fails the build if
    // the line it guards ever starts compiling.
    const full = contextFor(repoWith(), { base: 'main', id: TICKET });
    const asRunContextField: (context: RunContext) => DiffContext = (context) => context;
    // @ts-expect-error a context with no deferredDiffs cannot satisfy the narrowed type (AC-2)
    const missing: DiffContext = { ...full, deferredDiffs: undefined };
    expect(typeof asRunContextField).toBe('function');
    expect(missing.repoDir).toBe(full.repoDir);
  });

  test('AC-1 — the folder\'s own guard is derived from the folder, so a seventh file cannot go unscanned', () => {
    // Demonstrated rather than asserted, as AC-1's Test: line requires. `q0050.source.test.ts`'s
    // AC-9d scan used a hard-coded six-name array where every other check in that file derives from
    // `production`, so it would have stayed GREEN over `diff.ts` — a check blind to its own subject,
    // in a guard written after the decision that named the class.
    const SIX = ['channel.ts', 'engine.ts', 'lifecycle.ts', 'loaders.ts', 'routing.ts', 'types.ts'];
    const engine = new Map(coreSourceFiles()
      .filter(([name]) => name.startsWith('engine/'))
      .map(([name, text]) => [name.slice('engine/'.length), text] as const));
    const production = [...engine.keys()];
    expect(production).toContain('diff.ts');
    expect(production.length).toBe(SIX.length + 1);

    // The violation the guard exists to catch, injected into the one file the old array cannot see.
    const violating = (name: string): string =>
      `${engine.get(name) ?? ''}${name === 'diff.ts' ? '\nfunction resetTaskBranch(): void {}\n' : ''}`;
    const scan = (names: readonly string[]): boolean =>
      /(?:reset|delete|remove)TaskBranch/i.test(names.map(violating).join('\n'));
    expect(scan(SIX), 'the hard-coded array reports green over a violation in the seventh file').toBe(false);
    expect(scan(production), 'derived from the folder, the same scan sees it').toBe(true);
  });

  test('AC-1 — diff.ts spells neither of the two tokens git.ts owns', () => {
    // git.source.test.ts iterates EVERY core source file and asserts both appear in git/git.ts and
    // nowhere else, so a verbatim comment port turns another module's landed suite red. Asserted here
    // too, because a criterion of this ticket should fail in this ticket's own suite.
    const source = coreSourceFiles().find(([name]) => name === 'engine/diff.ts');
    expect(source, 'corpus missing: packages/core/src/engine/diff.ts').toBeDefined();
    for (const needle of ['merge-base', '--is-ancestor']) expect(source![1]).not.toContain(needle);
  });
});

// ---------------------------------------------------------------------------------------------
// AC-3 / AC-4 — the range guard, and what --base moves
// ---------------------------------------------------------------------------------------------

describe('Q-0051 AC-3 — the range guard is not relaxed', () => {
  test('an unrelated or malformed range fails at the guard, naming the base it was given', () => {
    // q0035-empty-range.js E6's second half.
    const root = repoWith();
    git(root, 'branch', 'some/other-branch', 'main');
    const context = contextFor(root, { base: 'main', id: TICKET });

    const unrelated = failure({ id: 'review', input: { diff: 'main...some/other-branch' } }, context);
    expect(unrelated?.message).toMatch(/must relate the configured base or this ticket's own branches/);
    expect(unrelated?.message, 'it names the supplied range').toContain('main...some/other-branch');
    expect(unrelated?.message, 'and the allowed endpoint classes').toContain(`harness/${TICKET}/`);
    expect(unrelated?.message, 'a guard failure must not read as an empty-range diagnosis')
      .not.toMatch(/is empty|containment|contained/);

    for (const malformed of ['main..harness/T-9/integration', 'main...harness/T-9/a...harness/T-9/b', 'harness/T-9/integration', '{base}...']) {
      const error = failure({ id: 'review', input: { diff: malformed } }, context);
      expect(error, `the guard must refuse ${malformed}`).toBeInstanceOf(FlowError);
      expect(error?.message).toMatch(/must relate the configured base or this ticket's own branches/);
    }
  });

  test('AC-3 — a rejected range spawns no git process at all', () => {
    // The refusal happens before any diff or ancestry operation, so a range aimed at an unrelated ref
    // costs nothing. Counted at the process boundary rather than inferred from the message.
    const root = repoWith();
    git(root, 'branch', 'some/other-branch', 'main');
    const context = contextFor(root, { base: 'main', id: TICKET });

    const rejected = counting(() => failure({ id: 'review', input: { diff: 'main...some/other-branch' } }, context));
    expect(rejected.result?.message).toMatch(/must relate the configured base/);
    expect(rejected.calls, 'a rejected range must not reach git').toBe(0);

    // The paired positive, which is what makes the counter discriminating: an ACCEPTED range does
    // spawn git, so zero above is a property of the refusal and not of the shim.
    const accepted = counting(() => failure(STEP, context));
    expect(accepted.calls, 'an accepted range reaches git').toBeGreaterThan(0);
  });

  test('AC-3/AC-7 — the guard derives its endpoints from vars.base, so --base composes with it', () => {
    // q0035-empty-range.js E7.
    const root = repoWith();
    git(root, 'branch', 'release');
    git(root, 'checkout', '-q', BRANCH);
    write(path.join(root, 'a.txt'), 'one\ntwo\n');
    commitAll(root, 'work');
    git(root, 'checkout', '-q', 'main');
    const context = contextFor(root, { base: 'release', id: TICKET });

    expect(materialiseDiff(STEP, context), 'a run given another base still materialises its diff').toMatch(/\+two/);
    const error = failure({ id: 'review', input: { diff: 'release...some/other' } }, context);
    expect(error?.message).toMatch(/must relate the configured base/);
    expect(error?.message, 'the guard reports the base it was actually given').toContain('"release"');
  });
});

/** One commit on main, a branch that adds a line, then main takes the branch — a CONTAINED ticket. */
function containedTicket(): { root: string; beforeWork: string } {
  const root = tempDir('q0051-base-');
  git(root, 'init', '-q', '-b', 'main');
  write(path.join(root, 'a.txt'), 'one\n');
  commitAll(root, 'base');
  const beforeWork = git(root, 'rev-parse', 'HEAD');
  git(root, 'branch', BRANCH);
  git(root, 'checkout', '-q', BRANCH);
  write(path.join(root, 'a.txt'), 'one\ntwo\n');
  commitAll(root, 'the ticket\'s work');
  git(root, 'checkout', '-q', 'main');
  git(root, 'merge', '-q', '--no-ff', '-m', 'take the branch', BRANCH);
  return { root, beforeWork };
}

describe('Q-0051 AC-4 — --base moves the diff anchor and nothing else', () => {
  test('B1 — a contained ticket is unreviewable against the configured base and reviewable against the override', () => {
    const { root, beforeWork } = containedTicket();
    expect(failure(STEP, contextFor(root, { base: 'main', id: TICKET })),
      'a contained ticket must produce an empty range against the configured base').toBeInstanceOf(FlowError);

    const out = materialiseDiff(STEP, contextFor(root, { base: beforeWork, id: TICKET }));
    expect(out, 'the override must yield the ticket\'s own diff').toContain('a.txt');
    expect(out, 'the diff must contain the line the ticket added').toContain('two');
  });

  test('B2 — the override moves the anchor and leaves repo.base_branch alone', () => {
    // The whole design. Implemented by overwriting the configured branch — the cheaper shape Q-0077
    // refused — this reads the SHA, and a later rework or integrate step would MERGE that revision
    // into the ticket's branch. This is the case that fails when materialiseDiff resolves `base` from
    // configuration in preference to vars.base, and every other test here stays green.
    const { root, beforeWork } = containedTicket();
    const context = contextFor(root, { base: beforeWork, id: TICKET });
    materialiseDiff(STEP, context);
    expect(context.config.repo?.base_branch, 'repo.base_branch is what a run merges from and must not move').toBe('main');
    expect(context.vars.base, 'the diff anchor is what moved').toBe(beforeWork);
  });

  test('B3 — the guard accepts an arbitrary revision as the base and still refuses an unrelated ref', () => {
    const { root, beforeWork } = containedTicket();
    materialiseDiff(STEP, contextFor(root, { base: beforeWork, id: TICKET }));
    git(root, 'branch', 'harness/T-OTHER/integration');
    const refused = failure(
      { id: 'x', input: { diff: '{base}...harness/T-OTHER/integration' } },
      contextFor(root, { base: beforeWork, id: TICKET }),
    );
    expect(refused, 'an endpoint belonging to another ticket must still be refused').toBeInstanceOf(FlowError);
    expect(refused?.message).toMatch(/input\.diff must relate/);
  });

  test('B4 — with no override the anchor is the configured base, unchanged', () => {
    const { root } = containedTicket();
    const context = contextFor(root, { base: 'main', id: TICKET });
    expect(failure(STEP, context), 'the default path is the behaviour that was there before').toBeInstanceOf(FlowError);
    expect(context.vars.base).toBe('main');
  });

  test('B6 — an unresolvable override is blamed on the flag, and an absent field is no override', () => {
    const { root } = containedTicket();
    const given = contextFor(root, { base: 'no-such-revision', id: TICKET }, { baseOverride: 'no-such-revision' });
    const refused = failure(STEP, given);
    expect(refused, 'a revision git cannot resolve must stop the run').toBeInstanceOf(FlowError);
    expect(refused?.message, 'it names the flag that supplied the value').toMatch(/--base/);
    expect(refused?.message, 'it names the revision supplied').toContain('"no-such-revision"');
    expect(refused?.message, 'it says which endpoint it is').toContain('left endpoint');
    expect(refused?.message).toMatch(/Neither the diff nor the containment check was run/);
    expect(refused?.message, 'the value did not come from configuration').not.toMatch(/repo\.base_branch/);
    expect(refused?.message).not.toMatch(/harness\.yaml/);

    // Attribution keys on whether the flag was TYPED, never on whether its value differs from the
    // configured branch: an override may legitimately name the same value. Here the two agree.
    const identical = failure(STEP, contextFor(root, { base: 'no-such-revision', id: TICKET }, {
      config: { repo: { base_branch: 'no-such-revision' } }, baseOverride: 'no-such-revision',
    }));
    expect(identical?.message, 'an override naming the configured value is still an override').toMatch(/--base/);
    expect(identical?.message).not.toMatch(/repo\.base_branch/);

    // And an absent field is no override, so a hand-built context keeps the configured wording.
    const configured = failure(STEP, contextFor(root, { base: 'no-such-revision', id: TICKET }));
    expect(configured?.message).toMatch(/repo\.base_branch in harness\/harness\.yaml names missing ref "no-such-revision"/);
    expect(configured?.message).not.toMatch(/--base/);
  });
});

// ---------------------------------------------------------------------------------------------
// AC-5 — an unresolvable endpoint
// ---------------------------------------------------------------------------------------------

describe('Q-0051 AC-5 — an unresolvable endpoint fails with the evidence that exists', () => {
  test('E5 — each identifying phrase is chosen by the failing endpoint\'s own identity', () => {
    const noBranch = repoWith({ branch: false });
    const missingRight = failure(STEP, contextFor(noBranch, { base: 'main', id: TICKET }));
    expect(missingRight?.message, 'the existing phrase is preserved').toMatch(/review requires an integrated branch/);
    expect(missingRight?.message, 'it says which endpoint failed').toContain('right endpoint');
    expect(missingRight?.message, 'the short SHA of the endpoint that does resolve')
      .toContain(git(noBranch, 'rev-parse', '--short', 'main'));
    expect(missingRight?.message, 'it names the complete range').toContain(`main...${BRANCH}`);
    expect(missingRight?.message).toMatch(/Neither the diff nor the containment check was run/);
    expect(missingRight?.message).not.toMatch(FORBIDDEN);
    expect(missingRight?.message, 'it invents no containment outcome').not.toMatch(/contained|not contained/);

    const noBase = repoWith();
    const missingLeft = failure(STEP, contextFor(noBase, { base: 'trunk', id: TICKET }));
    expect(missingLeft?.message).toMatch(/repo\.base_branch in harness\/harness\.yaml/);
    expect(missingLeft?.message).toMatch(/names missing ref/);
    expect(missingLeft?.message, 'it says which endpoint failed').toContain('left endpoint');
    expect(missingLeft?.message).toContain(git(noBase, 'rev-parse', '--short', BRANCH));
    expect(missingLeft?.message).not.toMatch(FORBIDDEN);

    const other = repoWith();
    const generic = failure({ id: 'review', input: { diff: '{base}...harness/{id}/implement' } },
      contextFor(other, { base: 'main', id: TICKET }));
    expect(generic?.message).toMatch(/input\.diff names missing ref "harness\/T-9\/implement"/);
    expect(generic?.message).toContain(git(other, 'rev-parse', '--short', 'main'));
  });

  test('P4 — a deferred range failing on its OTHER endpoint names the step that owed the one that did not fail', () => {
    // The pre-existing endpoint resolved at preflight and stopped resolving during the run. Driven
    // here at message level over a hand-built deferral, because the step-time half needs a worktree
    // step (Q-0053) and buildPrompt (Q-0052).
    const root = repoWith({ branch: false });
    const implement = `harness/${TICKET}/implement`;
    git(root, 'branch', implement, 'main');
    const deferred = new Map<string, DeferredDiff>([[`${BRANCH}...${implement}`, {
      ref: implement, step: 'implement', producers: [producer('right', implement, 'implement')],
    }]]);
    const error = failure(
      { id: 'review', input: { diff: 'harness/{id}/integration...harness/{id}/implement' } },
      contextFor(root, { base: 'main', id: TICKET }, { deferredDiffs: deferred }),
    );

    expect(error?.message).toMatch(/review requires an integrated branch/);
    expect(error?.message, 'it says which endpoint failed').toContain('left endpoint');
    expect(error?.message, 'the short SHA of the endpoint that does resolve')
      .toContain(git(root, 'rev-parse', '--short', implement));
    expect(error?.message).toMatch(new RegExp(`the range was deferred waiting for step "implement" to create ${implement}`));
    expect(error?.message, 'no step owed the endpoint that failed, so none may be blamed for it')
      .not.toMatch(/was expected to create harness\/\S*\/integration/);
    expect(error?.message).toMatch(/Neither the diff nor the containment check was run/);
    expect(error?.message).not.toMatch(FORBIDDEN);
  });

  test('P5 — when both endpoints were deferred, both step/ref pairs appear, in either endpoint order', () => {
    // A single `.find()` over the range would keep the first match only, which is the asymmetry one
    // level down from the wholesale deferral Q-0038 removed.
    for (const [left, right] of [['build', 'check'], ['check', 'build']]) {
      const root = repoWith({ branch: false });
      const range = `harness/${TICKET}/${left}...harness/${TICKET}/${right}`;
      const deferred = new Map<string, DeferredDiff>([[range, {
        ref: `harness/${TICKET}/${left}`, step: left!,
        producers: [
          producer('left', `harness/${TICKET}/${left}`, left!),
          producer('right', `harness/${TICKET}/${right}`, right!),
        ],
      }]]);
      const error = failure(
        { id: 'review', input: { diff: `harness/{id}/${left}...harness/{id}/${right}` } },
        contextFor(root, { base: 'main', id: TICKET }, { deferredDiffs: deferred }),
      );

      expect(error?.message).toMatch(new RegExp(`step "${left}" was expected to create harness/${TICKET}/${left}`));
      expect(error?.message).toMatch(new RegExp(`the range was deferred waiting for step "${right}" to create harness/${TICKET}/${right}`));
      expect(error?.message, `${left}...${right}: the step that owed the other endpoint must not be blamed for this one`)
        .not.toMatch(new RegExp(`was expected to create harness/${TICKET}/${right}\\b`));
      expect(error?.message, 'the endpoint beside it has genuinely failed to resolve').toMatch(/does not resolve either/);
      expect(error?.message).not.toMatch(FORBIDDEN);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// AC-6 / AC-7 — the empty-range diagnostic and its remedies
// ---------------------------------------------------------------------------------------------

describe('Q-0051 AC-6 — the empty-range diagnostic quotes evidence and claims no event', () => {
  test('E1 — right contained in left: the failure names its evidence and claims no event', () => {
    const root = repoWith();
    git(root, 'checkout', '-q', BRANCH);
    write(path.join(root, 'a.txt'), 'one\ntwo\n');
    commitAll(root, 'work');
    git(root, 'checkout', '-q', 'main');
    git(root, 'merge', '-q', '--no-ff', '-m', 'take the branch', BRANCH);

    const error = failure(STEP, contextFor(root, { base: 'main', id: TICKET }));
    expect(error).toBeInstanceOf(FlowError);
    assertEvidence(error!.message, { root, range: `main...${BRANCH}`, written: WRITTEN, outcome: 'contained' });
    expect(error!.message, 'it must not recommend a range the guard rejects').not.toMatch(/merge commit/);
  });

  test('E2 — different commits with identical trees: not contained, and never called the same commit', () => {
    const root = repoWith();
    git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'theirs');
    git(root, 'checkout', '-q', BRANCH);
    git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'ours');
    git(root, 'checkout', '-q', 'main');
    expect(git(root, 'diff', '--stat', `main...${BRANCH}`), 'fixture must produce an empty range').toBe('');

    const error = failure(STEP, contextFor(root, { base: 'main', id: TICKET }));
    assertEvidence(error!.message, { root, range: `main...${BRANCH}`, written: WRITTEN, outcome: 'not contained' });
    expect(git(root, 'rev-parse', '--short', 'main'), 'fixture must put the endpoints on different commits')
      .not.toBe(git(root, 'rev-parse', '--short', BRANCH));
    expect(error!.message, 'it must say what is actually equal').toContain('identical trees');
    expect(error!.message, 'identical trees are not the same commit').not.toMatch(/same commit|identical commits/i);
  });

  test('E3 — nothing added since the merge base, trees differ', () => {
    const root = repoWith();
    write(path.join(root, 'b.txt'), 'on main\n');
    commitAll(root, 'main moves for real');
    git(root, 'checkout', '-q', BRANCH);
    git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'ours');
    git(root, 'checkout', '-q', 'main');
    expect(git(root, 'diff', '--stat', `main...${BRANCH}`), 'fixture must produce an empty range').toBe('');

    const error = failure(STEP, contextFor(root, { base: 'main', id: TICKET }));
    assertEvidence(error!.message, { root, range: `main...${BRANCH}`, written: WRITTEN, outcome: 'not contained' });
    expect(error!.message, 'it must say nothing was added').toContain('adds nothing since its merge base');
    expect(error!.message, 'these trees are not identical and must not be called so').not.toContain('identical trees');
  });

  test('E4/E13 — a check that could not answer is indeterminate with a reason, never a confident negative', () => {
    // Deep enough that a shallow fetch truncates, with the merge base still inside the window: the
    // clone can see the two tips diverge and cannot see far enough to disprove ancestry.
    const parent = tempDir('q0051-shallow-');
    const origin = path.join(parent, 'origin');
    git(parent, 'init', '-q', '-b', 'main', origin);
    write(path.join(origin, 'a.txt'), 'one\n');
    commitAll(origin, 'base');
    const empty = (message: string): void => {
      git(origin, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', message);
    };
    empty('c2');
    empty('c3 (merge base)');
    git(origin, 'branch', BRANCH);
    write(path.join(origin, 'b.txt'), 'main only\n');
    commitAll(origin, 'main moves');
    git(origin, 'checkout', '-q', BRANCH);
    empty('branch moves, tree unchanged');
    git(origin, 'checkout', '-q', 'main');

    const clone = path.join(parent, 'clone');
    git(parent, 'clone', '-q', '--depth', '2', '--no-single-branch', `file://${origin}`, clone);
    expect(git(clone, 'rev-parse', '--is-shallow-repository'), 'fixture must be genuinely shallow').toBe('true');
    git(clone, 'branch', BRANCH, `origin/${BRANCH}`);
    expect(git(clone, 'diff', '--stat', `main...${BRANCH}`), 'fixture must produce an empty range').toBe('');

    const error = failure(STEP, contextFor(clone, { base: 'main', id: TICKET }));
    assertEvidence(error!.message, { root: clone, range: `main...${BRANCH}`, written: WRITTEN, outcome: 'indeterminate' });
    expect(error!.message, 'it must carry the reason').toContain('shallow clone');
    // The whole point: absent history may not be rendered as a confident negative, in either direction.
    expect(error!.message, 'absent history cannot disprove ancestry').not.toMatch(/is not contained|→ not contained/);
    expect(error!.message, 'and it cannot prove it either').not.toMatch(/→ contained/);
  });
});

describe('Q-0051 AC-7 — a deferred range\'s remedy is about the state that actually arose', () => {
  /** Every range a message names, fed back through the layer that owns it. */
  const guardAccepts = (range: string, context: DiffContext): boolean => {
    const error = failure({ id: 'probe', input: { diff: range } }, context);
    return !/must relate the configured base/.test(String(error?.message ?? ''));
  };

  /**
   * One empty range, with and without a deferral over it, and the four `(deferred?, state)`
   * combinations that produces across the three outcomes.
   */
  function emptyRange(state: 'contained' | 'not-contained', deferred: boolean): { message: string; context: DiffContext } {
    const root = repoWith();
    if (state === 'contained') {
      git(root, 'checkout', '-q', BRANCH);
      write(path.join(root, 'a.txt'), 'one\ntwo\n');
      commitAll(root, 'work');
      git(root, 'checkout', '-q', 'main');
      git(root, 'merge', '-q', '--no-ff', '-m', 'take the branch', BRANCH);
    } else {
      write(path.join(root, 'b.txt'), 'on main\n');
      commitAll(root, 'main moves');
      git(root, 'checkout', '-q', BRANCH);
      git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'ours');
      git(root, 'checkout', '-q', 'main');
    }
    const deferrals = new Map<string, DeferredDiff>(deferred
      ? [[`main...${BRANCH}`, { ref: BRANCH, step: 'implement', producers: [producer('right', BRANCH, 'implement')] }]]
      : []);
    const context = contextFor(root, { base: 'main', id: TICKET }, { deferredDiffs: deferrals });
    return { message: failure(STEP, context)!.message, context };
  }

  test('E11 — a deferred range that comes out contained is not sent back to review it earlier', () => {
    const { message } = emptyRange('contained', true);
    expect(message, 'the reader must learn the producing step committed nothing')
      .toMatch(/Remedy: check that step "implement" committed its work/);
    expect(message, 'a deferred endpoint did not become contained; it started that way')
      .not.toMatch(/before it becomes contained/);
    expect(message, 'and the producing step is named in the evidence too')
      .toMatch(/produced by\s+step "implement"/);
    expect(message).not.toMatch(FORBIDDEN);
  });

  test('all three outcomes keep their own diagnosis and remedy', () => {
    const contained = emptyRange('contained', false);
    expect(contained.message).toMatch(/Remedy: review .* before it becomes contained in main/);
    expect(contained.message).toContain('That is a relationship between the two commits above');

    const notContained = emptyRange('not-contained', false);
    expect(notContained.message).toMatch(/Remedy: check that the ticket's work was committed to/);
    expect(notContained.message).toContain('is not contained in');

    const deferredNegative = emptyRange('not-contained', true);
    expect(deferredNegative.message).toMatch(/Remedy: check that step "implement" committed its work/);
  });

  test('every remedy names refs the range guard would accept', () => {
    // The message Q-0035 replaced ended by advising something the guard forty lines above it refuses,
    // so this is mechanical rather than read: each ref a remedy names is put back through the guard.
    for (const [state, deferred] of [['contained', false], ['contained', true], ['not-contained', false], ['not-contained', true]] as const) {
      const { message, context } = emptyRange(state, deferred);
      const remedy = message.split('\n').find((line) => line.includes('Remedy:'));
      expect(remedy, `${state}/${String(deferred)}: the message must carry a remedy`).toBeDefined();
      expect(message.match(/Remedy:/g), 'at most one remedy per failure').toHaveLength(1);
      expect(remedy).not.toMatch(/merge commit/);
      const refs = [...remedy!.matchAll(/\b(main|harness\/[\w./-]+)\b/g)].map((match) => match[1]!);
      expect(refs.length, `${state}/${String(deferred)}: the remedy must name a ref`).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(guardAccepts(`main...${ref}`, context), `the guard refuses a ref its own remedy names: ${ref}`).toBe(true);
      }
      // And every range the message names is one the guard admits, which is E6's own mechanic.
      for (const [, range] of message.matchAll(/`([^`\s]*\.\.\.[^`\s]*)`/g)) {
        if (range!.includes('{')) continue;
        expect(guardAccepts(range!, context), `a range the message names is rejected by the guard: ${range}`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// AC-8 — truncation
// ---------------------------------------------------------------------------------------------

describe('Q-0051 AC-8 — truncation is byte-honest, and the trim is tested by name', () => {
  test('E8 — a valid range is untouched: same patch, same stat, same truncation', () => {
    const root = repoWith();
    git(root, 'checkout', '-q', BRANCH);
    write(path.join(root, 'a.txt'), `one\n${'padding line\n'.repeat(400)}`);
    commitAll(root, 'work');
    git(root, 'checkout', '-q', 'main');
    const lines: string[] = [];
    const context = contextFor(root, { base: 'main', id: TICKET },
      { persistence: { appendLog: (_ticket, line) => { lines.push(line); } } });

    const out = materialiseDiff(STEP, context);
    expect(out).toMatch(/## Diff to review/);
    expect(out).toContain(`### git diff --stat main...${BRANCH}`);
    expect(out).toContain(`## Patch (main...${BRANCH})`);
    expect(out).toMatch(/\+padding line/);
    expect(out, 'an untruncated diff carries no notice').not.toMatch(/Truncation notice/);
    expect(lines, 'and writes no log line').toStrictEqual([]);

    const capped = contextFor(root, { base: 'main', id: TICKET }, {
      config: { repo: { base_branch: 'main', max_diff_bytes: 500 } },
      persistence: { appendLog: (_ticket, line) => { lines.push(line); } },
    });
    const truncated = materialiseDiff(STEP, capped);
    expect(truncated).toMatch(/Patch truncated to \d+ UTF-8 bytes \(configured limit 500\)/);
    // The kept byte count is the truncated patch's own length, and the log line is the spike's format.
    const kept = Number(/Patch truncated to (\d+) UTF-8 bytes/.exec(truncated)![1]);
    expect(kept).toBeLessThanOrEqual(500);
    expect(lines).toStrictEqual([`run=1 diff truncated range=main...${BRANCH} limit=500 kept=${kept}`]);
  });

  test('trimIncompleteUtf8Suffix cuts back to a character boundary and no further', () => {
    const bytes = (...values: number[]): Buffer => Buffer.from(values);
    const table: Array<[string, Buffer, Buffer]> = [
      ['empty input is returned unchanged', bytes(), bytes()],
      ['ASCII is untouched', Buffer.from('abc', 'utf8'), Buffer.from('abc', 'utf8')],
      ['a complete two-byte character is kept', bytes(0x41, 0xc3, 0xa9), bytes(0x41, 0xc3, 0xa9)],
      ['a truncated two-byte sequence is dropped', bytes(0x41, 0xc3), bytes(0x41)],
      ['a complete three-byte character is kept', bytes(0x41, 0xe2, 0x82, 0xac), bytes(0x41, 0xe2, 0x82, 0xac)],
      ['a truncated three-byte sequence is dropped', bytes(0x41, 0xe2, 0x82), bytes(0x41)],
      ['a complete four-byte character is kept', bytes(0xf0, 0x9f, 0x98, 0x80), bytes(0xf0, 0x9f, 0x98, 0x80)],
      ['a truncated four-byte sequence is dropped', bytes(0x41, 0xf0, 0x9f, 0x98), bytes(0x41)],
      ['continuation bytes alone are returned unchanged', bytes(0x80, 0x80), bytes(0x80, 0x80)],
    ];
    for (const [why, input, expected] of table) {
      expect(trimIncompleteUtf8Suffix(input).equals(expected), `${why}: got ${trimIncompleteUtf8Suffix(input).toString('hex')}`).toBe(true);
    }
    // It does not scan beyond the final candidate code point: an incomplete sequence EARLIER in the
    // buffer is left alone, because only the tail can be cut by a byte-count truncation.
    const earlier = bytes(0xc3, 0x41, 0x42);
    expect(trimIncompleteUtf8Suffix(earlier).equals(earlier)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// AC-9 / AC-10 / AC-11 / AC-13 — the run-level preflight
// ---------------------------------------------------------------------------------------------

/** One run over a real repository, a real ticket folder and a flow file `loadFlow` produced. */
function options(repoDir: string, overrides: Partial<RunFlowOptions> = {}): RunFlowOptions {
  write(path.join(repoDir, 'harness', 'harness.yaml'), 'adapterOverride: mock\nrepo:\n  base_branch: main\n');
  const project = loadProject(repoDir);
  const flowFile = path.join(repoDir, 'harness', 'flows', 'probe.yaml');
  write(flowFile, 'name: probe\nconsumes: draft\nproduces: requirements\nsteps: []\n');
  const flow: Flow = loadFlow(flowFile);
  const ticketDir = path.join(repoDir, 'backlog', `${TICKET}-diff`);
  write(path.join(ticketDir, 'ticket.md'), `---\nid: ${TICKET}\n---\nbody\n`);
  return {
    ticket: ticketRecord(ticketDir), flow, backlog: project.backlog, project, ...overrides,
  } as unknown as RunFlowOptions;
}

/** The steps of one run, assigned past `lintFlow` exactly as `engine.test.ts` assigns them. */
const withSteps = (opts: RunFlowOptions, steps: unknown): void => {
  opts.flow.steps = steps as typeof opts.flow.steps;
};

/** Drains a run and returns whatever it threw, or `null`. */
async function runToEnd(opts: RunFlowOptions): Promise<{ error: Error | null; events: Event[] }> {
  const events: Event[] = [];
  try {
    for await (const event of runFlow(opts)) events.push(event);
    return { error: null, events };
  } catch (cause: unknown) {
    return { error: cause as Error, events };
  }
}

/** What the preflight left on the context, observed from inside the first step that runs. */
interface Observed {
  diffInputs: string[];
  deferred: Array<[string, DeferredDiff]>;
  baseOverride: string | null;
}

/**
 * Runs `opts` with `runStep` stubbed to record the context and advance, so the preflight's own output
 * is the subject rather than a step's.
 *
 * **The zero-execution half is a structural proxy here and is reported as one.** `routing.ts` stubs
 * `runAgentStep` to reject with `execution belongs to Q-0052`, so no adapter can be invoked in this
 * ticket and no call count is observable; a preflight that wrongly passed reaches a step, and one
 * that correctly failed does not. The occurrence-counting assertion arrives with Q-0052.
 */
async function observe(opts: RunFlowOptions): Promise<{ error: Error | null; seen: Observed[] }> {
  const seen: Observed[] = [];
  vi.spyOn(routing, 'runStep').mockImplementation(async (_step, context) => {
    seen.push({
      diffInputs: [...context.diffInputs.keys()],
      deferred: [...context.deferredDiffs.entries()],
      baseOverride: context.baseOverride,
    });
    return null;
  });
  const { error } = await runToEnd(opts);
  return { error, seen };
}

const reviewStep = (diff: string, id = 'review'): Record<string, unknown> => ({
  id, role: 'code-reviewer', adapter: 'mock', input: { backlog: ['ticket.md'], diff },
});
const implementStep = (): Record<string, unknown> => ({
  id: 'implement', role: 'principal-architect', adapter: 'mock', worktree: true,
  branch: 'harness/{id}/implement', base: 'harness/{id}/integration',
});

describe('Q-0051 AC-9 — the preflight walks every diff site once, in flow order, before the step loop', () => {
  test('P1a/C2 — a range of two pre-existing endpoints is judged before any step runs', () => {
    const root = repoWith();
    const opts = options(root);
    withSteps(opts, [implementStep(), reviewStep('harness/{id}/integration...harness/{id}/absent')]);
    const spy = vi.spyOn(routing, 'runStep');

    return runToEnd(opts).then(({ error, events }) => {
      expect(error).toBeInstanceOf(FlowError);
      expect(error?.message).toMatch(/names missing ref "harness\/T-9\/absent"/);
      expect(spy, 'the preflight must fire before any step, not merely before the consuming one').not.toHaveBeenCalled();
      expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'failed', stageAfter: 'draft' });
    });
  });

  test('P1b — a range with a step-created endpoint is deferred, so the run reaches step time', async () => {
    const root = repoWith();
    const opts = options(root);
    withSteps(opts, [implementStep(), reviewStep('harness/{id}/integration...harness/{id}/implement')]);

    const { error, seen } = await observe(opts);
    expect(error, 'a deferred range must reach step time').toBeNull();
    expect(seen[0]?.deferred).toStrictEqual([[`${BRANCH}...harness/${TICKET}/implement`, {
      ref: `harness/${TICKET}/implement`, step: 'implement',
      producers: [{ side: 'right', ref: `harness/${TICKET}/implement`, step: 'implement', class: 'step-created' }],
    }]]);
    expect(seen[0]?.diffInputs, 'and it is not materialised at run start').toStrictEqual([]);
  });

  test('P1c/P1d — an outer step\'s unresolved placeholder is not a template, and a deferred sibling is still judged', async () => {
    const outer = options(repoWith());
    withSteps(outer, [implementStep(), reviewStep('{base}...harness/{id}/{nope}')]);
    const unresolved = await runToEnd(outer);
    expect(unresolved.error).toBeInstanceOf(FlowError);
    expect(unresolved.error?.message).toMatch(/names missing ref "harness\/T-9\/\{nope\}"/);

    // With a step-created sibling: no deferral is recorded — a half-interpolated key could never be
    // looked up at step time — and the endpoint that IS due is still resolved now.
    const mixed = options(repoWith());
    withSteps(mixed, [implementStep(), reviewStep('harness/{id}/implement...harness/{id}/{nope}')]);
    const half = await observe(mixed);
    expect(half.error).toBeInstanceOf(FlowError);
    expect(half.error?.message).toMatch(/names missing ref "harness\/T-9\/\{nope\}"/);
    expect(half.error?.message).toMatch(/is not created until step "implement" runs/);
    expect(half.seen, 'the failure is before any step').toStrictEqual([]);
  });

  test('P2 — a deferred range still proves its pre-existing endpoint, before anything is billed', async () => {
    // The night Q-0038 is about: the chore flow reviews integration...implement on a ticket whose
    // integration branch does not exist. The right endpoint is owed by the implement step; the left is
    // an ordinary ref that could have been checked for free, and now is.
    const opts = options(repoWith({ branch: false }));
    withSteps(opts, [implementStep(), reviewStep('harness/{id}/integration...harness/{id}/implement')]);
    const { error, seen } = await observe(opts);

    expect(error).toBeInstanceOf(FlowError);
    expect(seen, 'no step may run against a knowably absent ref').toStrictEqual([]);
    expect(error?.message, 'the identifying phrase for its endpoint class').toMatch(/review requires an integrated branch/);
    expect(error?.message, 'it says which endpoint failed').toContain('left endpoint');
    expect(error?.message).toContain(`${BRANCH}...harness/${TICKET}/implement`);
    expect(error?.message, 'and the range as the flow file writes it').toContain('harness/{id}/integration...harness/{id}/implement');
    expect(error?.message).toMatch(/Neither the diff nor the containment check was run/);
    expect(error?.message).not.toMatch(FORBIDDEN);
    expect(error?.message, 'it invents no containment outcome for a ref it could not read').not.toMatch(/contained/);
    // The clause this criterion exists for: the right endpoint is not supposed to resolve yet, so
    // reporting it as one that does not resolve either is the same category error in the same message.
    expect(error?.message).toMatch(new RegExp(`the right endpoint harness/${TICKET}/implement is not created until step "implement" runs`));
    expect(error?.message, 'a branch no step has produced yet has not failed to resolve').not.toMatch(/does not resolve either/);
    expect(error?.message, 'no step owed the endpoint that failed').not.toMatch(/was expected to create harness\/\S*\/integration/);

    // The paired negative, which is what makes the refusal discriminating.
    const ok = options(repoWith());
    withSteps(ok, [implementStep(), reviewStep('harness/{id}/integration...harness/{id}/implement')]);
    const passed = await observe(ok);
    expect(passed.error, 'a fix that refuses everything fails here').toBeNull();
    expect(passed.seen.length).toBe(2);
  });

  test('P3 — a step-created endpoint stays deferred even when the ref already exists at run start', async () => {
    // A second chore round: harness/<id>/implement survives from round 1. Materialising the range at
    // preflight would capture bytes from that round and present them as this one's — and here it would
    // fail outright, since the two branches are identical and the range is empty at run start.
    const root = repoWith();
    git(root, 'branch', `harness/${TICKET}/implement`, 'main');
    expect(git(root, 'diff', '--stat', `${BRANCH}...harness/${TICKET}/implement`),
      'the fixture must be empty at run start, or it cannot discriminate').toBe('');
    const opts = options(root);
    withSteps(opts, [implementStep(), reviewStep('harness/{id}/integration...harness/{id}/implement')]);

    const { error, seen } = await observe(opts);
    expect(error, 'the run must reach evidence produced during it').toBeNull();
    expect(seen[0]?.deferred.map(([range]) => range)).toStrictEqual([`${BRANCH}...harness/${TICKET}/implement`]);
    expect(seen[0]?.diffInputs, 'the previous round\'s bytes must not be captured as this round\'s').toStrictEqual([]);
  });

  test('E10 — a range that is empty over pre-existing refs stops the run with its full diagnosis', async () => {
    // The run-level half of the empty-range diagnostic: the preflight materialises, `materialiseDiff`
    // refuses, and the message a maintainer reads at run start is the same one E1 asserts at message
    // level — including the containment outcome, which is what the old catch could not produce.
    const root = repoWith();                                  // the branch is identical to main
    const opts = options(root);
    withSteps(opts, [implementStep(), reviewStep(WRITTEN)]);
    const { error, seen } = await observe(opts);

    expect(error).toBeInstanceOf(FlowError);
    expect(error?.message).toMatch(/→ contained/);
    expect(error?.message).toContain('is empty — git diff --stat printed nothing');
    expect(error?.message).not.toMatch(FORBIDDEN);
    expect(seen, 'no step may run against a range the preflight could judge').toStrictEqual([]);
  });

  test('E12 — a dry run of a deferred range previews without demanding branches only a paid run creates', async () => {
    const opts = options(repoWith(), { dry: true });
    withSteps(opts, [implementStep(), reviewStep('harness/{id}/integration...harness/{id}/implement')]);
    const ticketFile = path.join(opts.ticket.dir, 'ticket.md');
    const before = fs.readFileSync(ticketFile, 'utf8');

    const { error, seen } = await observe(opts);
    expect(error, 'a preview must not demand branches only a paid run produces').toBeNull();
    expect(seen[0]?.deferred.map(([range]) => range)).toStrictEqual([`${BRANCH}...harness/${TICKET}/implement`]);
    expect(fs.readFileSync(ticketFile, 'utf8'), 'dry run mutated the ticket').toBe(before);
  });

  test('P6 — --dry refuses what a real run refuses, and still writes nothing', async () => {
    const opts = options(repoWith({ branch: false }), { dry: true });
    withSteps(opts, [implementStep(), reviewStep('harness/{id}/integration...harness/{id}/implement')]);
    const ticketFile = path.join(opts.ticket.dir, 'ticket.md');
    const before = fs.readFileSync(ticketFile, 'utf8');

    const { error } = await runToEnd(opts);
    expect(error, 'a clean preview of a run that cannot start is silence, not evidence').toBeInstanceOf(FlowError);
    expect(error?.message).toMatch(/review requires an integrated branch/);
    expect(error?.message).toMatch(/is not created until step "implement" runs/);
    expect(fs.readFileSync(ticketFile, 'utf8'), 'dry run mutated the ticket').toBe(before);
    expect(fs.existsSync(path.join(opts.project.repoDir, '.quorum')), 'and wrote no run history').toBe(false);
  });

  test('P7/E17 — a fan_out template is a diff site, and is judged per endpoint too', async () => {
    const opts = options(repoWith({ branch: false }));
    withSteps(opts, [{
      id: 'build', fan_out: { from: 'solution/tasks.yaml', by: 'role' },
      step: { branch: 'harness/{id}/{task.id}', input: { diff: 'harness/{id}/integration...harness/{id}/{task.id}' } },
    }]);
    const { error, seen } = await observe(opts);

    expect(error).toBeInstanceOf(FlowError);
    expect(seen, 'the fan-out was reached against an endpoint that could have been checked').toStrictEqual([]);
    // The identifying phrase is chosen by the failing endpoint's own identity, not by the site.
    expect(error?.message).toMatch(/review requires an integrated branch/);
    expect(error?.message, 'it says which endpoint failed').toContain('left endpoint');
    expect(error?.message, 'it names the range as the flow file writes it')
      .toContain('harness/{id}/integration...harness/{id}/{task.id}');
    expect(error?.message).toMatch(/is a per-task template with no value until "build\.step" expands its tasks/);
    expect(error?.message, 'an endpoint with no value yet has not failed to resolve').not.toMatch(/does not resolve either/);
    expect(error?.message).not.toMatch(FORBIDDEN);

    // A bad template range fails before the step loop, naming the template site as lint names it.
    const bad = options(repoWith());
    withSteps(bad, [{
      id: 'build', fan_out: { from: 'solution/tasks.yaml', by: 'role' },
      step: { branch: 'harness/{id}/{task.id}', input: { diff: '{base}...harness/{id}/integration' } },
    }]);
    const badRun = await observe(bad);
    expect(badRun.error?.message.startsWith('build.step:'), `it names the template site as lint does: ${badRun.error?.message}`).toBe(true);
    expect(badRun.seen).toStrictEqual([]);
  });

  test('C3 — the guard still rejects a range aimed at refs unrelated to the ticket, at run level', async () => {
    const root = repoWith();
    git(root, 'branch', 'some/other-branch', 'main');
    const opts = options(root);
    withSteps(opts, [implementStep(), reviewStep('main...some/other-branch')]);
    const { error, seen } = await observe(opts);

    expect(error).toBeInstanceOf(FlowError);
    expect(error?.message).toMatch(/must relate the configured base or this ticket's own branches/);
    expect(seen, 'the guard must fire before any step').toStrictEqual([]);
  });

  test('AC-9.3 — a parallel sibling\'s branch is concurrent, not earlier', async () => {
    // The group boundary, which a simplification that remembered creations per MEMBER would erase:
    // the branch `a` creates is not evidence for `b`, which runs beside it.
    const opts = options(repoWith());
    withSteps(opts, [{
      parallel: [
        { id: 'a', role: 'x', adapter: 'mock', worktree: true, branch: 'harness/{id}/a' },
        reviewStep('{base}...harness/{id}/a', 'b'),
      ],
    }]);
    const { error, seen } = await observe(opts);
    expect(error, 'a sibling\'s branch must be judged now, not deferred').toBeInstanceOf(FlowError);
    expect(error?.message).toMatch(/names missing ref "harness\/T-9\/a"/);
    expect(seen).toStrictEqual([]);
  });

  test('AC-9.8 — the earliest creator is kept, and an integrate step\'s `into` creates too', async () => {
    const first = options(repoWith());
    withSteps(first, [
      { id: 'first', role: 'x', adapter: 'mock', worktree: true, branch: 'harness/{id}/shared' },
      { id: 'second', role: 'x', adapter: 'mock', worktree: true, branch: 'harness/{id}/shared' },
      reviewStep('{base}...harness/{id}/shared'),
    ]);
    const earliest = await observe(first);
    expect(earliest.error).toBeNull();
    expect(earliest.seen[0]?.deferred[0]?.[1].step, 'the earliest creator, not the latest').toBe('first');

    const integrate = options(repoWith());
    withSteps(integrate, [
      { id: 'merge', type: 'integrate', branches: ['harness/{id}/x'], into: 'harness/{id}/landing' },
      reviewStep('{base}...harness/{id}/landing'),
    ]);
    const viaInto = await observe(integrate);
    expect(viaInto.error).toBeNull();
    expect(viaInto.seen[0]?.deferred[0]?.[1]).toMatchObject({ ref: `harness/${TICKET}/landing`, step: 'merge' });
  });

  test('AC-9.5 — one distinct range is materialised once, however many sites name it', async () => {
    // Counted rather than assumed. `materialiseDiff` appends a runs.log line whenever it truncates, so
    // a small max_diff_bytes turns each materialisation into one durable, countable record.
    const root = repoWith();
    git(root, 'checkout', '-q', BRANCH);
    write(path.join(root, 'big.txt'), 'padding line\n'.repeat(400));
    commitAll(root, 'work');
    git(root, 'checkout', '-q', 'main');
    const opts = options(root);
    write(path.join(root, 'harness', 'harness.yaml'), 'adapterOverride: mock\nrepo:\n  base_branch: main\n  max_diff_bytes: 500\n');
    opts.project = loadProject(root);
    withSteps(opts, [{ parallel: [reviewStep(WRITTEN, 'claude'), reviewStep(WRITTEN, 'codex')] }, reviewStep(WRITTEN, 'third')]);

    const { error, seen } = await observe(opts);
    expect(error).toBeNull();
    expect(seen[0]?.diffInputs, 'one key for one distinct range').toStrictEqual([`main...${BRANCH}`]);
    const runsLog = path.join(opts.ticket.dir, 'runs.log');
    const materialisations = [...fs.readFileSync(runsLog, 'utf8').matchAll(/diff truncated range=(\S+)/g)]
      .filter((match) => match[1] === `main...${BRANCH}`).length;
    expect(materialisations, 'one distinct range must be materialised once, not once per site').toBe(1);
  });

  test('AC-9.9 — one bad range stops the run even when another distinct range was valid', async () => {
    const root = repoWith();
    git(root, 'checkout', '-q', BRANCH);
    write(path.join(root, 'a.txt'), 'one\ntwo\n');
    commitAll(root, 'work');
    git(root, 'checkout', '-q', 'main');
    expect(git(root, 'diff', '--stat', `main...${BRANCH}`), 'the first range must be valid').not.toBe('');
    const opts = options(root);
    withSteps(opts, [reviewStep(WRITTEN, 'good'), reviewStep('{base}...harness/{id}/nowhere', 'bad')]);

    const { error, seen } = await observe(opts);
    expect(error).toBeInstanceOf(FlowError);
    expect(error?.message).toMatch(/names missing ref "harness\/T-9\/nowhere"/);
    expect(seen, 'a valid sibling range does not license the run to start').toStrictEqual([]);
  });
});

describe('Q-0051 AC-10/AC-11/AC-13 — the context, the coercions, and the first dereference', () => {
  test('AC-10 — a --base run reaches the preflight with baseOverride set, and one without it with null', async () => {
    const withFlag = options(repoWith(), { base: 'main' });
    withSteps(withFlag, [{ id: 'a', role: 'x', adapter: 'mock' }]);
    const flagged = await observe(withFlag);
    expect(flagged.seen[0]?.baseOverride, 'an override naming the configured value is still an override').toBe('main');

    const plain = options(repoWith());
    withSteps(plain, [{ id: 'a', role: 'x', adapter: 'mock' }]);
    const unflagged = await observe(plain);
    expect(unflagged.seen[0]?.baseOverride).toBeNull();
  });

  test('AC-10 — the maps a step reads are the run\'s own, and both start empty', async () => {
    const opts = options(repoWith());
    withSteps(opts, [{ id: 'a', role: 'x', adapter: 'mock' }]);
    const { seen } = await observe(opts);
    expect(seen[0]).toStrictEqual({ diffInputs: [], deferred: [], baseOverride: null });
  });

  test('AC-11 — a YAML number reaches the same created-so-far key as its string', async () => {
    // Not a type-only claim: the number is what YAML actually hands back for `branch: 2`, and
    // `interpolate` no longer coerces, so the preflight's own `String(...)` is what makes the two
    // agree. Without it the branch is never remembered and the range fails as a missing ref.
    const parsed = YAML.parse('branch: 2\n') as { branch: unknown };
    expect(typeof parsed.branch, 'YAML must hand back a number for this to be the real case').toBe('number');

    for (const branch of [parsed.branch, '2']) {
      const opts = options(repoWith());
      withSteps(opts, [
        { id: 'make', role: 'x', adapter: 'mock', worktree: true, branch },
        reviewStep('harness/{id}/integration...2'),
      ]);
      const { error, seen } = await observe(opts);
      expect(error, `branch: ${JSON.stringify(branch)} must be remembered`).toBeNull();
      expect(seen[0]?.deferred[0]?.[1]).toMatchObject({ ref: '2', step: 'make' });
    }
  });

  test('AC-13 — a flow with no steps fails naming the expression the preflight iterates', async () => {
    const opts = options(repoWith());
    withSteps(opts, undefined);
    const { error, events } = await runToEnd(opts);

    expect(error).toBeInstanceOf(TypeError);
    expect((error as Error).name).toBe('TypeError');
    // Node names the expression, so a local binding would read `steps is not iterable` — which is a
    // different first line, and the first line is what the terminal note, the runs.log line and the
    // terminal event all carry.
    expect(error?.message).toBe('flow.steps is not iterable');
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'failed', error: 'flow.steps is not iterable' });
  });
});

// ---------------------------------------------------------------------------------------------
// AC-9's `--dry` clause, asserted over the source rather than over one run
// ---------------------------------------------------------------------------------------------

describe('Q-0051 AC-9 — the preflight is one path, not two', () => {
  test('nothing in diff.ts can branch on dry, because the narrowed context has no such field', () => {
    // `--dry` is the same run machinery, not a second code path, which is why its preflight must be
    // as honest as a real run's. Asserted at the type rather than by scanning for the word: the
    // narrowed context cannot see `dry`, so the branch is unrepresentable rather than merely absent.
    const full = contextFor(repoWith(), { base: 'main', id: TICKET });
    // @ts-expect-error the narrowed context carries no `dry`, so the preflight cannot read one (AC-9)
    const unreachable: unknown = full.dry;
    expect(unreachable).toBeUndefined();
    const source = coreSourceFiles().find(([name]) => name === 'engine/diff.ts')![1];
    expect(source, 'and no conditional in the module mentions it either').not.toMatch(/if\s*\([^)\n]*\bdry\b/);
  });

  test('preflightDiffs is reachable without a run, over a directly built context', () => {
    // The narrowed context's payoff, and what makes every scenario above buildable: no run, no
    // backlog, no history — a repository and an object.
    const root = repoWith();
    const context: PreflightContext = {
      ...contextFor(root, { base: 'main', id: TICKET }),
      flow: { name: 'probe', consumes: 'a', produces: 'b', steps: [] } as unknown as Flow,
      diffInputs: new Map<string, string>(),
      deferredDiffs: new Map<string, DeferredDiff>(),
    };
    context.flow.steps = [reviewStep(WRITTEN)] as unknown as Flow['steps'];
    expect(() => { preflightDiffs(context); }).toThrow(/is empty/);
    expect(execFileSync('git', ['rev-parse', '--short', 'main'], { cwd: root, encoding: 'utf8' }).trim().length)
      .toBeGreaterThan(0);
  });
});
