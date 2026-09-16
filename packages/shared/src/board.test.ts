/**
 * Q-0017 AC-7, AC-11, AC-12 — the board rules two surfaces now read from one register.
 *
 * Both the sets are sliced out of `STAGES` rather than written out, because only `stages.ts` may
 * hold a stage name as a string literal in this package (`stages.test.ts`). **So the members are
 * pinned by name HERE**, in a test file that guard does not scan: the slice is the implementation
 * and this is the claim, and a `STAGES` somebody reorders fails here rather than silently changing
 * which columns a fresh project shows and which tickets get a `no branch` token.
 */
import { describe, expect, test } from 'vitest';

import {
  ALWAYS_RENDERED, BRANCH_EXPECTED, containmentToken, indeterminateLegend, pushLagSentence,
} from './board.js';
import { CONTAINMENT_REASONS } from './containment.js';
import { PUSH_LAG_REASONS, PUSH_LAG_STATES } from './push-lag.js';
import { STAGES } from './stages.js';

describe('AC-7 — which empty columns render is one register, and its members are the three', () => {
  test('the three, as an identity rather than a count', () => {
    // A count is satisfied by a member swapped out for another; these are the stages a project has
    // before any work has moved, and naming them is the only thing that says which.
    expect([...ALWAYS_RENDERED]).toStrictEqual(['draft', 'requirements', 'solutioned']);
  });

  test('and every member is a stage, so the slice cannot drift off the tuple', () => {
    for (const stage of ALWAYS_RENDERED) {
      expect(STAGES, `${stage} is not a stage`).toContain(stage);
    }
    expect(ALWAYS_RENDERED.length, 'the register is empty — this check proves nothing').toBe(3);
  });
});

describe('AC-11 — the suppression rule, and the containment vocabulary', () => {
  test('the six, as an identity, and the four it deliberately excludes', () => {
    expect([...BRANCH_EXPECTED].sort()).toStrictEqual(
      ['deployed', 'green', 'qa-passed', 'red', 'reviewed', 'solutioned'],
    );
    // The glossary's own wording: `solutioned` onward, never `draft`, `requirements`, `blocked` or
    // `abandoned`. Asserted as exclusions because that is the half a widened slice would break.
    for (const stage of ['draft', 'requirements', 'blocked', 'abandoned']) {
      expect(BRANCH_EXPECTED.has(stage), `${stage} expects a branch, which would put a token on every row`).toBe(false);
    }
    // The two slices meet at exactly one stage and, between them, leave exactly the two terminal
    // ones out — which is the shape, where a sum of sizes would be arithmetic that happened to
    // agree. `solutioned` is in both because it is where work is first claimed to exist and also the
    // last stage a project has before anything has moved.
    expect(ALWAYS_RENDERED.filter((stage) => BRANCH_EXPECTED.has(stage))).toStrictEqual(['solutioned']);
    expect(STAGES.filter((stage) => !ALWAYS_RENDERED.includes(stage) && !BRANCH_EXPECTED.has(stage)))
      .toStrictEqual(['blocked', 'abandoned']);
  });

  test('the three states render the three tokens', () => {
    expect(containmentToken({ state: 'contained' }, 'main')).toBe('main:contained');
    expect(containmentToken({ state: 'not-contained', ahead: 12 }, 'main')).toBe('main:not-contained(+12)');
    expect(containmentToken({ state: 'indeterminate', reason: 'no branch' }, 'main'))
      .toBe('main:indeterminate(no branch)');
  });

  test('every reason the vocabulary permits renders, and the base is never assumed', () => {
    for (const reason of CONTAINMENT_REASONS) {
      const token = containmentToken({ state: 'indeterminate', reason }, 'trunk');
      expect(token, `${reason} did not reach the token`).toBe(`trunk:indeterminate(${reason})`);
    }
  });

  test('and no token or legend says "merged", "landed" or "shipped"', () => {
    // `docs/GLOSSARY.md`: an ancestry fact about two refs at the moment of reading is not a claim
    // about how the code arrived, and the three words are the ones that would make it one.
    const rendered = [
      containmentToken({ state: 'contained' }, 'main'),
      containmentToken({ state: 'not-contained', ahead: 1 }, 'main'),
      ...CONTAINMENT_REASONS.map((reason) => containmentToken({ state: 'indeterminate', reason }, 'main')),
      indeterminateLegend('main'),
    ].join('\n');
    for (const forbidden of ['merged', 'landed', 'shipped']) {
      expect(rendered, `a containment rendering says ${forbidden}`).not.toContain(forbidden);
    }
    // The needles discriminate rather than matching nothing.
    expect(['merged', 'landed', 'shipped'].filter((word) => 'the branch was merged'.includes(word)))
      .toStrictEqual(['merged']);
  });

  test('the indeterminate legend says git could not answer, and says what it does not mean', () => {
    const legend = indeterminateLegend('main');
    expect(legend, 'the legend does not name the base it is about').toContain('main');
    expect(legend, 'the legend does not say git could not answer').toContain('git could not answer');
    expect(legend, 'the legend does not refuse the reading it exists to refuse')
      .toContain('it does not mean the code is missing');
  });
});

describe('AC-12 — push lag warns, never reassures, and borrows no containment grammar', () => {
  /** Every state the union permits, which is what "every state" has to mean to be a check. */
  const everyState = (): { rendered: string | null; label: string }[] => [
    { rendered: pushLagSentence({ state: 'pushed' }, 'main'), label: 'pushed' },
    { rendered: pushLagSentence({ state: 'unpushed', ahead: 1, upstream: 'origin/main' }, 'main'), label: 'unpushed(1)' },
    { rendered: pushLagSentence({ state: 'unpushed', ahead: 7, upstream: 'origin/main' }, 'main'), label: 'unpushed(7)' },
    ...PUSH_LAG_REASONS.map((reason) => ({
      rendered: pushLagSentence({ state: 'indeterminate', reason }, 'main'),
      label: `indeterminate(${reason})`,
    })),
  ];

  test('the two silent cases say nothing, and every other state says one thing', () => {
    // `pushed` and `no remote` are silent for different reasons and neither is a reassurance: the
    // first is "git had nothing to say" and the second is a repository with nowhere to push.
    expect(pushLagSentence({ state: 'pushed' }, 'main')).toBeNull();
    expect(pushLagSentence({ state: 'indeterminate', reason: 'no remote' }, 'main')).toBeNull();
    for (const { rendered, label } of everyState()) {
      if (label === 'pushed' || label === 'indeterminate(no remote)') continue;
      expect(rendered, `${label} rendered nothing`).not.toBeNull();
      expect((rendered ?? '').includes('\n'), `${label} rendered more than one line`).toBe(false);
    }
    expect(PUSH_LAG_STATES.length, 'the state union moved and this check did not').toBe(3);
  });

  test('a lag sentence names the base, the upstream and the count, as of the last fetch', () => {
    const one = pushLagSentence({ state: 'unpushed', ahead: 1, upstream: 'origin/main' }, 'main') ?? '';
    expect(one).toContain('main holds 1 commit that origin/main does not');
    expect(one, 'the sentence claims more than a count of commits').toContain('as of the last fetch');
    const many = pushLagSentence({ state: 'unpushed', ahead: 7, upstream: 'up/trunk' }, 'trunk') ?? '';
    expect(many, 'the plural is not agreed').toContain('trunk holds 7 commits that up/trunk does not');
  });

  test('and no push-lag text borrows containment\'s token grammar or reassures', () => {
    // Two separate claims over the same corpus. The first is the grammar: a `<base>:` token is
    // containment's and a repository-level fact wearing it would read as an annotation about a
    // ticket. The second is the asymmetry that entry is about — nothing here may say a thing was
    // built, tested or validated anywhere.
    const reassuring = ['CI passed', 'validated', 'verified', 'up to date', 'nothing to do', 'all good'];
    for (const { rendered, label } of everyState()) {
      if (rendered === null) continue;
      expect(/\bmain:|trunk:/.test(rendered), `${label} rendered a containment-style token`).toBe(false);
      for (const phrase of reassuring) {
        expect(rendered.toLowerCase(), `${label} reassures with "${phrase}"`).not.toContain(phrase.toLowerCase());
      }
    }
    // Both needles discriminate, over fixtures rather than over an empty corpus.
    expect(/\bmain:|trunk:/.test('main:contained')).toBe(true);
    expect(reassuring.filter((phrase) => 'CI passed on this branch'.includes(phrase))).toStrictEqual(['CI passed']);
  });
});
