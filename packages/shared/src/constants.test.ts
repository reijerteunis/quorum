import { describe, expect, test } from 'vitest';

import {
  DEFAULT_BASE_BRANCH, FINDING_PATTERN, FINDING_SEVERITIES, LOCK_ROOT, MANIFEST_FILE, OBSERVATION_TAG,
  OCCURRENCE_DIR, OUTPUT_FILE, PROMPT_FILE, REPO_WORKTREE_ROOT, RUNS_LOG_FILE, RUN_HISTORY_ROOT,
  TICKET_ARTIFACT_DIR, USAGE_MEASURES, integrationBranch, occurrenceDirName, runIdOf, runLockPath,
  ticketBranch, ticketBranchPrefix, worktreeDirName,
} from './constants.js';

// Every constant claims to replace a literal the spike spelled by hand, and until Q-0107 every test
// below opened `spike/src/**` and asserted the spike's own bytes beside the constant's value. That
// half is `retired`: its subject is a tree Q-0103 deletes, and *"A check outlives its subject only
// if it can still fail"* (2026-09-05) refuses to transcribe it — a frozen copy of the spike's text
// is a measurement with nothing left to re-derive it from, which is worse than not having it.
//
// What each test keeps is the constant's own contract, which was already asserted in the same
// `test()` block and is what every consumer reads. The siblings that carry what the spike halves
// carried, named rather than implied:
//
//   - the worktree root, the run-history filenames, the branch shapes and the two `.harness/`
//     namespaces: the value assertions below, plus `packages/core/src/**/*.source.test.ts`, where
//     each folder is required to reach these names through this package and to spell none of them
//     itself — `backlog.source.test.ts`'s *"the branch shape belongs to shared"* is the sharpest of
//     them. (Named that way rather than by scope on purpose: `index.test.ts` forbids the scope
//     anywhere under `src/`, tests included, so that its no-workspace-import clause has a subject.)
//   - the base-branch fallback, which the spike spelled six times: `lint.source.test.ts`'s
//     *"no base-branch default is spelled here"* and `q0050.source.test.ts`'s Q-0107 clause, which
//     requires the engine to reach it through `DEFAULT_BASE_BRANCH` and never as a bare `'main'`;
//   - the five usage measures: `USAGE_MEASURES` below, and `adapters.source.test.ts` and
//     `run-history.source.test.ts`, which forbid either folder declaring the list a second time;
//   - the default verdict path, whose whole test is retired here: its ported twin is
//     `q0050.source.test.ts`'s *"Q-0089: the default verdict path is scoped by run and by
//     iteration"*, which asserts the same three properties over `steps.ts` and was written for
//     exactly this reason.

describe('AC-10 — the constants are the one spelling every consumer reads', () => {
  test('the worktree root and its branch-directory encoding', () => {
    expect(REPO_WORKTREE_ROOT).toBe('.harness/worktrees');
    expect(worktreeDirName('harness/Q-0041/implement')).toBe('harness__Q-0041__implement');
  });

  test('the run-history root and its filenames', () => {
    expect(RUN_HISTORY_ROOT).toBe('.quorum/runs');
    expect(MANIFEST_FILE).toBe('manifest.json');
    expect(PROMPT_FILE).toBe('prompt.txt');
    expect(OUTPUT_FILE).toBe('output.txt');
    expect(OCCURRENCE_DIR).toBe('steps');
  });

  test('Q-0039 — the lock root is a sibling of the runs root, and a lock is named by its ticket', () => {
    // A sibling and not a child: `readRunsDir` lists what is under the runs root, so a lock inside
    // it would be an entry `quorum runs` had to learn to skip. Both are under `.quorum/`, which is
    // the namespace one exclusion covers and one `rm` reaches.
    expect(LOCK_ROOT).toBe('.quorum/locks');
    expect(LOCK_ROOT.startsWith('.quorum/')).toBe(true);
    expect(RUN_HISTORY_ROOT.startsWith(`${LOCK_ROOT}/`), 'the runs root is not inside the lock root').toBe(false);
    expect(LOCK_ROOT.startsWith(`${RUN_HISTORY_ROOT}/`), 'nor the lock root inside the runs root').toBe(false);

    // The subject is the TICKET: two runs of one ticket name one file whatever flow each runs, and
    // two tickets never name the same one. The run number is deliberately absent from the name —
    // a lock keyed by run would let run 2 start while run 1 held the ticket, which is the whole
    // defect. `runIdOf` beside it is what that would have looked like.
    expect(runLockPath('Q-0039')).toBe('.quorum/locks/Q-0039.json');
    expect(runLockPath('Q-0039')).toBe(runLockPath('Q-0039'));
    expect(runLockPath('PROJ-0042')).not.toBe(runLockPath('Q-0039'));
    expect(runLockPath('Q-0039')).not.toContain(runIdOf('Q-0039', 2));
    expect(runLockPath('Q-0039').startsWith(`${LOCK_ROOT}/`)).toBe(true);
  });

  test('the run id and the occurrence directory keep their shapes', () => {
    expect(runIdOf('Q-0041', 3)).toBe('Q-0041-3');
    expect(occurrenceDirName(7, 'implement')).toBe('steps/007-implement');
    // A fan-out step id carries a colon, and an occurrence directory is one path segment.
    expect(occurrenceDirName(12, 'dev:T-1/a')).toBe('steps/012-dev-T-1-a');
  });

  test('the ticket branch shapes take the ticket id as data and embed no repository name', () => {
    expect(integrationBranch('Q-0041')).toBe('harness/Q-0041/integration');
    expect(ticketBranch('Q-0041', 'implement')).toBe('harness/Q-0041/implement');
    expect(ticketBranchPrefix('Q-0041')).toBe('harness/Q-0041/');
    // The prefix is what the engine's diff-range guard tests against, so the three must agree:
    // a branch this prefix does not cover is one that guard would let past.
    expect(ticketBranch('Q-0041', 'implement').startsWith(ticketBranchPrefix('Q-0041'))).toBe(true);
    expect(integrationBranch('Q-0041').startsWith(ticketBranchPrefix('Q-0041'))).toBe(true);
  });

  test('the default base branch, the runs log, the finding vocabulary and the usage measures', () => {
    expect(DEFAULT_BASE_BRANCH).toBe('main');
    expect(RUNS_LOG_FILE).toBe('runs.log');

    expect(FINDING_PATTERN).toBe('^((blocker|major|nit): .+:[1-9][0-9]* .+|observation: .+)');
    expect([...FINDING_SEVERITIES]).toEqual(['blocker', 'major', 'nit']);
    // `observation` is deliberately NOT a severity: a severity answers *how bad is this claim about
    // the change*, and an observation is not a claim about the change at all. The pattern's second
    // alternative carries no `file:line` for the same reason — there is no line of the change for it
    // to point at. Why: *"A finding is a claim about the change; anything else is an observation"*
    // (2026-09-11).
    expect([...FINDING_SEVERITIES]).not.toContain(OBSERVATION_TAG);
    expect(new RegExp(FINDING_PATTERN).test(`${OBSERVATION_TAG}: the suite is intermittently red`),
      'an observation without a file:line must satisfy the pattern').toBe(true);
    expect(new RegExp(FINDING_PATTERN).test('nit: the suite is intermittently red'),
      'a severity without a file:line must still be refused').toBe(false);
    // The pattern and the vocabulary are one fact; keep them from drifting apart.
    expect(FINDING_PATTERN).toContain(FINDING_SEVERITIES.join('|'));

    expect([...USAGE_MEASURES]).toEqual(['input_tokens', 'output_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'cost_usd']);
  });

  test('the two `.harness/` namespaces are unrelated and tellable apart from the names alone', () => {
    // One is worktrees under the repository root; the other is engine-written artifacts inside a
    // ticket folder. Same prefix, nothing else in common.
    expect(TICKET_ARTIFACT_DIR).toBe('.harness');
    expect(REPO_WORKTREE_ROOT.startsWith(`${TICKET_ARTIFACT_DIR}/`)).toBe(true);
    // The names, not the values, are what disambiguates them.
    expect('REPO_WORKTREE_ROOT'.startsWith('REPO_')).toBe(true);
    expect('TICKET_ARTIFACT_DIR'.startsWith('TICKET_')).toBe(true);
  });
});
