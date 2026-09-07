// Q-0042: the criteria that are properties of the code rather than of its behaviour.
//
// "core reads git ancestry in exactly one file" and "no literal is re-spelled" cannot be observed
// at run time, and they are exactly what a later module breaks silently — which is how this
// repository came to answer the same question two ways before Q-0035.
import { describe, expect, test } from 'vitest';

import type {
  AncestryReason, ContainmentReason, ContainmentResult, PushLagReason, PushLagResult,
} from '@quorum/shared';
import {
  ANCESTRY_REASONS, CONTAINMENT_REASONS, CONTAINMENT_STATES, PUSH_LAG_REASONS, PUSH_LAG_STATES,
} from '@quorum/shared';

import * as gitModule from './git.js';
import * as barrel from '../index.js';
import { coreSourceFiles, repoFile } from '../../test/corpus.js';

/**
 * The corpus keys every entry by its whole path below `src`, so a same-named file in another
 * folder can never answer for this one (Q-0064).
 */
const GIT_SOURCE = 'git/git.ts';

const gitSource = (): string => {
  const found = coreSourceFiles().find(([name]) => name === GIT_SOURCE);
  if (!found) throw new Error(`corpus missing: packages/core/src/${GIT_SOURCE} does not exist`);
  return found[1];
};

describe('AC-1 — the module exports twelve functions, and core reads ancestry in one file', () => {
  test('exactly the twelve functions this module owns', () => {
    // Eight at Q-0042. `mergeBase` is the ninth, and it is here rather than in the engine because
    // the guard below permits `merge-base` in this file alone — Q-0053 AC-3a and OQ-1.
    // `currentBranch` is the tenth, and it is here for the reason this file exists: every git call
    // in `core` goes through one runner, and a probe spelled inside `backlog/scaffold.ts` would be
    // a second one (Q-0093 AC-9(b)). `pushLag` is the eleventh, for that same reason: it is a
    // second git-derived fact and a probe spelled inside `packages/cli/src/board.ts` would be a
    // second runner (Q-0105 AC-1).
    expect(Object.keys(gitModule).sort()).toEqual([
      'ancestry', 'configuredUser', 'containment', 'currentBranch', 'emptyRangeEvidence', 'ensureExcluded',
      'ensureWorktree', 'mergeBase', 'pushLag', 'removeWorktree', 'shallowState', 'shortSha',
    ]);
    for (const value of Object.values(gitModule)) expect(typeof value).toBe('function');
  });

  test('and that pin moved rather than being widened — the ten it held before Q-0105 are refused', () => {
    // Shown red against the value it replaces rather than edited to fit, which is the demonstration
    // Q-0091 and Q-0092 each wrote for their own registers, and which Q-0093 wrote here against the
    // nine before it. A `toContain` here would have accepted either list and recorded nothing.
    expect(Object.keys(gitModule).sort(), 'the module still exports the ten it had before Q-0105')
      .not.toEqual([
        // A snapshot of the past, so it gains nothing: `configuredUser` did not exist before Q-0105
        // and adding it here would make the historical claim false while the comparison went on
        // passing. Only the current fixture above moves.
        'ancestry', 'containment', 'currentBranch', 'emptyRangeEvidence', 'ensureExcluded',
        'ensureWorktree', 'mergeBase', 'removeWorktree', 'shallowState', 'shortSha',
      ]);
  });

  test('merge-base and --is-ancestor appear in git.ts and in no other source file', () => {
    for (const [name, text] of coreSourceFiles()) {
      const isTheOnePlace = name === GIT_SOURCE;
      for (const needle of ['merge-base', '--is-ancestor']) {
        expect(
          text.includes(needle),
          `${name} ${isTheOnePlace ? 'must' : 'must not'} contain ${needle}`,
        ).toBe(isTheOnePlace);
      }
    }
  });

  test('the barrel re-exports exactly this folder\'s public contribution (Q-0096 AC-2)', () => {
    // Until Q-0096 this pinned `packages/core/src/index.ts` byte for byte, asserting that this
    // port child added no public re-export. Q-0096 opens the surface, so what survives is the half
    // still under decision: which of this folder's names a consumer outside the package may reach.
    // Two since Q-0105 — `containment` and `pushLag`, the two git-derived facts the board renders —
    // and the comment moves with the pin, because it said "the only name" and that is now false.
    expect(Object.keys(gitModule).filter((symbol) => symbol in barrel).sort())
      .toStrictEqual(['configuredUser', 'containment', 'pushLag']);
  });

  test('and that pin moved rather than widened — the one name it held before Q-0105 is refused', () => {
    // The same demonstration the export pin above carries: a register is moved by being shown to
    // refuse the value it replaces, never by being edited to fit. Without this, adding a third
    // export to the barrel would silently pass a `toStrictEqual` somebody had rewritten by hand.
    expect(Object.keys(gitModule).filter((symbol) => symbol in barrel).sort(),
      'the folder still contributes only `containment` to the barrel')
      .not.toStrictEqual(['containment']);
  });

  test('`currentBranch` is still withheld, so the rule did not move with the arithmetic', () => {
    // Q-0105 added a name to the barrel, which is exactly when the rule that governs the list is
    // worth re-asserting rather than assuming: a symbol reaches the surface because a COMMAND needs
    // it. No command asks git for a branch name, so `currentBranch` stays off it — and this is the
    // clause that would fail if a later ticket read "the barrel grew" as permission.
    expect(Object.keys(gitModule)).toContain('currentBranch');
    expect(Object.keys(barrel), 'currentBranch reached the barrel and no command needs it')
      .not.toContain('currentBranch');
  });
});

describe('AC-5 — every git call goes through execFileSync with an argv array, never a shell', () => {
  test('no shell and no string command line', () => {
    const text = gitSource();
    expect(text).toContain('execFileSync');
    for (const forbidden of ['execSync', 'spawnSync', 'shell:', 'exec(']) {
      expect(text.includes(forbidden), `git.ts must not reach for ${forbidden}`).toBe(false);
    }
  });
});

describe('AC-11 — the closed sets live in shared, and no literal is re-spelled', () => {
  test('git.ts takes the worktree root and the naming rule from shared', () => {
    const text = gitSource();
    expect(text).toContain('REPO_WORKTREE_ROOT');
    expect(text).toContain('worktreeDirName');
    expect(text.includes('replace(/\\//g'), 'the / → __ rule belongs to shared').toBe(false);
    expect(text.includes('.harness/worktrees'), 'the worktree root belongs to shared').toBe(false);
  });

  test('the exclude pattern stays a literal, and says why it is not TICKET_ARTIFACT_DIR', () => {
    const text = gitSource();
    expect(text, 'the pattern is written into the user\'s info/exclude and must survive byte for byte')
      .toContain("'.harness/'");
    expect(text, 'the other .harness namespace is named, so nobody swaps the constant in later')
      .toContain('TICKET_ARTIFACT_DIR');
  });

  test('shared declares the three closed sets, adds no dependency, and is re-exported', () => {
    expect(CONTAINMENT_STATES).toEqual(['contained', 'not-contained', 'indeterminate']);
    expect(ANCESTRY_REASONS).toEqual(['git failed', 'shallow clone', 'shallow state unknown']);
    expect(CONTAINMENT_REASONS).toEqual(['missing ref', 'shallow clone', 'git failed', 'no branch']);

    const pkg = JSON.parse(repoFile('packages/shared/package.json')) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies)).toEqual(['zod']);
    expect(repoFile('packages/shared/src/index.ts')).toContain("export * from './containment.js';");
    // shared depends on no other workspace package, and the containment module imports nothing.
    expect(repoFile('packages/shared/src/containment.ts')).not.toContain('import ');
  });

  test('the module says contained, and never merged, landed or shipped', () => {
    for (const [name, text] of [['containment.ts', repoFile('packages/shared/src/containment.ts')], ['git.ts', gitSource()]]) {
      for (const synonym of [/\bis landed\b/i, /\bis shipped\b/i, /\bis merged into\b/i]) {
        expect(synonym.test(text), `${name} must not describe a branch with ${synonym.source}`).toBe(false);
      }
    }
  });

  test('Q-0105 AC-2 — push lag declares its own closed sets in shared, beside containment\'s', () => {
    // A sibling module rather than an addition to `containment.ts`, because it is a second SUBJECT
    // under the same rules. `missing ref`, `shallow clone` and `git failed` are deliberately spelled
    // in both sets and the sets stay separate: `ANCESTRY_REASONS` and `CONTAINMENT_REASONS` already
    // overlap on two, for the same reason — a shared string is not a shared question.
    expect(PUSH_LAG_STATES).toEqual(['pushed', 'unpushed', 'indeterminate']);
    expect(PUSH_LAG_REASONS).toEqual([
      'no remote', 'no upstream', 'missing ref', 'shallow clone', 'git failed',
    ]);
    // The two reasons only this fact can reach, asserted so a later edit that folded the two sets
    // together would fail here rather than pass by containing everything.
    for (const only of ['no remote', 'no upstream']) {
      expect(CONTAINMENT_REASONS as readonly string[],
        `${only} is containment's reason too, so the two sets have merged`).not.toContain(only);
    }
    expect(PUSH_LAG_REASONS as readonly string[],
      'no branch is a ticket\'s question and has no meaning for a base branch').not.toContain('no branch');
    expect(repoFile('packages/shared/src/index.ts')).toContain("export * from './push-lag.js';");
  });

  test('an out-of-set reason, and an impossible combination, do not compile', () => {
    // Each directive fails the build if the line it guards ever starts compiling, so these are
    // assertions about the type declarations rather than about this run.
    // @ts-expect-error 'merged' is not an ancestry reason: the set is closed (AC-11)
    const outOfSet: AncestryReason = 'merged';
    // @ts-expect-error a contained result carries no ahead count (AC-11)
    const contained: ContainmentResult = { state: 'contained', ahead: 3 };
    // @ts-expect-error a proven negative carries no reason (AC-11)
    const negative: ContainmentResult = { state: 'not-contained', ahead: 1, reason: 'git failed' };
    // @ts-expect-error an indeterminate result without a reason is not a result (AC-11)
    const unknown: ContainmentResult = { state: 'indeterminate' };
    // @ts-expect-error the board has no surface that can produce this ancestry reason (fact 2)
    const boardOnly: ContainmentReason = 'shallow state unknown';
    // @ts-expect-error 'no branch' is containment's reason: a base branch is not a ticket (Q-0105)
    const wrongSet: PushLagReason = 'no branch';
    // @ts-expect-error a pushed base carries no count and no upstream name (Q-0105 AC-2)
    const level: PushLagResult = { state: 'pushed', ahead: 0 };
    // @ts-expect-error an unpushed base has to name the upstream the sentence renders (Q-0105 AC-2)
    const behind: PushLagResult = { state: 'unpushed', ahead: 2 };
    // @ts-expect-error an indeterminate push lag carries a reason and never a count (Q-0105 AC-2)
    const cannotSay: PushLagResult = { state: 'indeterminate', reason: 'no upstream', ahead: 1 };

    expect([outOfSet, contained.state, negative.state, unknown.state, boardOnly,
      wrongSet, level.state, behind.state, cannotSay.state]).toHaveLength(9);
  });
});
