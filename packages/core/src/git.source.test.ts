// Q-0042: the criteria that are properties of the code rather than of its behaviour.
//
// "core reads git ancestry in exactly one file" and "no literal is re-spelled" cannot be observed
// at run time, and they are exactly what a later module breaks silently — which is how this
// repository came to answer the same question two ways before Q-0035.
import { describe, expect, test } from 'vitest';

import type { AncestryReason, ContainmentReason, ContainmentResult } from '@quorum/shared';
import { ANCESTRY_REASONS, CONTAINMENT_REASONS, CONTAINMENT_STATES } from '@quorum/shared';

import * as gitModule from './git.js';
import { coreSourceFiles, repoFile } from '../test/corpus.js';

const gitSource = (): string => {
  const found = coreSourceFiles().find(([name]) => name === 'git.ts');
  if (!found) throw new Error('corpus missing: packages/core/src/git.ts does not exist');
  return found[1];
};

describe('AC-1 — the module exports eight functions, and core reads ancestry in one file', () => {
  test('exactly the eight functions the port names', () => {
    expect(Object.keys(gitModule).sort()).toEqual([
      'ancestry', 'containment', 'emptyRangeEvidence', 'ensureExcluded', 'ensureWorktree',
      'removeWorktree', 'shallowState', 'shortSha',
    ]);
    for (const value of Object.values(gitModule)) expect(typeof value).toBe('function');
  });

  test('merge-base and --is-ancestor appear in git.ts and in no other source file', () => {
    for (const [name, text] of coreSourceFiles()) {
      const isTheOnePlace = name === 'git.ts';
      for (const needle of ['merge-base', '--is-ancestor']) {
        expect(
          text.includes(needle),
          `${name} ${isTheOnePlace ? 'must' : 'must not'} contain ${needle}`,
        ).toBe(isTheOnePlace);
      }
    }
  });

  test('packages/core/src/index.ts is untouched, so Q-0041\'s byte pin stays green', () => {
    // Deliberate: this ticket adds no public re-export. Its only declared dependent (Q-0048) is in
    // the same package and imports ./git.js directly (OQ-1).
    expect(repoFile('packages/core/src/index.ts')).toBe("export const name = '@quorum/core';\n");
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
    expect(CONTAINMENT_REASONS).toEqual(['missing ref', 'shallow clone', 'git failed']);

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

    expect([outOfSet, contained.state, negative.state, unknown.state, boardOnly]).toHaveLength(5);
  });
});
