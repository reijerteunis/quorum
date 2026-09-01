import { describe, expect, test } from 'vitest';

import {
  DEFAULT_BASE_BRANCH, FINDING_PATTERN, FINDING_SEVERITIES, MANIFEST_FILE, OCCURRENCE_DIR,
  OUTPUT_FILE, PROMPT_FILE, REPO_WORKTREE_ROOT, RUNS_LOG_FILE, RUN_HISTORY_ROOT,
  TICKET_ARTIFACT_DIR, USAGE_MEASURES, integrationBranch, occurrenceDirName, runIdOf, ticketBranch,
  ticketBranchPrefix, worktreeDirName,
} from './constants.js';
import { spikeSource } from '../test/corpus.js';

// Every constant claims to replace a literal in the spike. These tests check the claim against the
// spike's own bytes rather than against a transcription of them, so a constant that drifts from
// the code it is meant to replace fails here rather than at the cutover.

describe('AC-10 — the constants are the one spelling, byte-identical to the spike', () => {
  test('the worktree root and its branch-directory encoding, as git.js and fanout.js write them', () => {
    const git = spikeSource('src/git.js');
    const fanout = spikeSource('src/fanout.js');
    expect(git).toContain("path.join(repoDir, '.harness', 'worktrees')");
    expect(git).toContain("path.join(repoDir, '.harness', 'worktrees', branch.replace(/\\//g, '__'))");
    expect(fanout).toContain("path.join(repo, '.harness', 'worktrees', branch.replace(/\\//g, '__'))");

    expect(REPO_WORKTREE_ROOT).toBe('.harness/worktrees');
    expect(worktreeDirName('harness/Q-0041/implement')).toBe('harness__Q-0041__implement');
  });

  test('the run-history root and its filenames, as engine.js writes them', () => {
    const engine = spikeSource('src/engine.js');
    expect(engine).toContain("path.join(ctx.repoDir, '.quorum', 'runs', runId)");
    expect(engine).toContain("path.join(ctx.history.dir, 'manifest.json')");
    expect(engine).toContain("'prompt.txt'");
    expect(engine).toContain("'output.txt'");
    expect(engine).toContain("fs.mkdirSync(path.join(runDir, 'steps'))");

    expect(RUN_HISTORY_ROOT).toBe('.quorum/runs');
    expect(MANIFEST_FILE).toBe('manifest.json');
    expect(PROMPT_FILE).toBe('prompt.txt');
    expect(OUTPUT_FILE).toBe('output.txt');
    expect(OCCURRENCE_DIR).toBe('steps');
  });

  test('the run id and the occurrence directory keep their shapes', () => {
    const engine = spikeSource('src/engine.js');
    expect(engine).toContain('const runId = `${ctx.ticket.meta.id}-${ctx.runId}`;');
    expect(engine).toContain("const safeId = String(step.id).replace(/[/:]/g, '-');");
    expect(engine).toContain("const occurrenceDir = `steps/${String(seq).padStart(3, '0')}-${safeId}`;");

    expect(runIdOf('Q-0041', 3)).toBe('Q-0041-3');
    expect(occurrenceDirName(7, 'implement')).toBe('steps/007-implement');
    // A fan-out step id carries a colon, and an occurrence directory is one path segment.
    expect(occurrenceDirName(12, 'dev:T-1/a')).toBe('steps/012-dev-T-1-a');
  });

  test('the ticket branch shapes take the ticket id as data and embed no repository name', () => {
    expect(spikeSource('src/backlog.js')).toContain('branch: `harness/${id}/integration`');
    expect(spikeSource('src/engine.js')).toContain('`harness/${ticket.meta.id}/${step.id}`');

    expect(integrationBranch('Q-0041')).toBe('harness/Q-0041/integration');
    expect(ticketBranch('Q-0041', 'implement')).toBe('harness/Q-0041/implement');
    expect(ticketBranchPrefix('Q-0041')).toBe('harness/Q-0041/');
    // The engine's diff range guard is exactly this prefix test — spike/src/engine.js:797-799.
    expect(spikeSource('src/engine.js')).toContain('const ticketPrefix = `harness/${ctx.ticket.meta.id}/`;');
  });

  test('the default base branch, the runs log, the finding vocabulary and the usage measures', () => {
    const engine = spikeSource('src/engine.js');
    // The requirement names four sites (engine.js:45, 916, 991, 1004). There are five: :788, in
    // materialiseDiff, is the same fallback and the requirement missed it — reported, not fixed.
    // A sixth sits in the CLI (spike/bin/harness.js:431), which Q-0043 lifts.
    expect(engine.match(/base_branch \?\? 'main'/g)?.length).toBe(5);
    expect(spikeSource('bin/harness.js').match(/base_branch \?\? 'main'/g)?.length).toBe(1);
    expect(DEFAULT_BASE_BRANCH).toBe('main');

    expect(spikeSource('src/backlog.js')).toContain("path.join(ticket.dir, 'runs.log')");
    expect(RUNS_LOG_FILE).toBe('runs.log');

    expect(engine).toContain("pattern: '^(blocker|major|nit): .+:[1-9][0-9]* .+'");
    expect(FINDING_PATTERN).toBe('^(blocker|major|nit): .+:[1-9][0-9]* .+');
    expect([...FINDING_SEVERITIES]).toEqual(['blocker', 'major', 'nit']);
    // The pattern and the vocabulary are one fact; keep them from drifting apart.
    expect(FINDING_PATTERN).toContain(FINDING_SEVERITIES.join('|'));

    const measures = "['input_tokens', 'output_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'cost_usd']";
    expect(engine).toContain(measures);
    expect(spikeSource('src/adapters/index.js')).toContain(measures);
    expect([...USAGE_MEASURES]).toEqual(['input_tokens', 'output_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'cost_usd']);
  });

  test('the two `.harness/` namespaces are unrelated and tellable apart from the names alone', () => {
    // One is worktrees under the repository root; the other is engine-written artifacts inside a
    // ticket folder. Same prefix, nothing else in common.
    expect(spikeSource('src/engine.js')).toContain('`.harness/${step.id}-${Date.now()}.raw.txt`');
    expect(spikeSource('src/engine.js')).toContain('`.harness/run-{run}/${step.id}-verdict-iter-{iter}.json`');

    expect(TICKET_ARTIFACT_DIR).toBe('.harness');
    expect(REPO_WORKTREE_ROOT.startsWith(`${TICKET_ARTIFACT_DIR}/`)).toBe(true);
    // The names, not the values, are what disambiguates them.
    expect('REPO_WORKTREE_ROOT'.startsWith('REPO_')).toBe(true);
    expect('TICKET_ARTIFACT_DIR'.startsWith('TICKET_')).toBe(true);
  });

  // The verdict file is the one engine-written artifact a flow author does not name, so the naming
  // rule of 02-sdlc-pipeline-spec.md §5.8 cannot be enforced on it by reading a flow file — there is
  // no path there to read. It is enforced on the DEFAULT instead, because a rule that holds only
  // where somebody remembered to write `verdict_file:` is not a rule. This is the SPIKE half; the
  // ported twin is asserted in `packages/core/src/engine/q0050.source.test.ts`, because
  // `packages/shared` must not read `packages/core` even in a test — that is the dependency
  // direction 04-architecture.md forbids, and Q-0072's input guard is what noticed. See Q-0089.
  test('the spike\'s default verdict path is scoped by run and by iteration', () => {
    const template = /verdict_file \?\? `([^`]+)`/.exec(spikeSource('src/engine.js'))?.[1];
    expect(template, 'the spike must still have a default verdict path').toBeDefined();
    // The two properties, not the string: a spelling change that keeps the scoping still passes,
    // and one that drops it cannot.
    expect(template, 'scoped to one run').toContain('run-{run}');
    expect(template, 'scoped to one traversal').toContain('{iter}');
    // The step id stays in it: two steps of one flow both declaring a verdict must not collide,
    // which run and iteration alone do not prevent.
    expect(template, 'still names the step').toMatch(/\$\{step\.id\}/);
  });
});
