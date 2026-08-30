import path from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { FINDING_PATTERN } from '@quorum/shared';

import { strictSchemaProblems } from '../../test/strict-schema.js';
import { removeTempDirs, tempDir, write } from '../../test/repo.js';
import { Backlog } from '../backlog/backlog.js';
import type { Frontmatter, TicketRecord } from '../backlog/backlog.js';
import { buildPrompt, schemaFor } from './prompt.js';
import type { PromptContext } from './prompt.js';

afterAll(removeTempDirs);

const FOLDER = 'Q-0052-agent-gate-script';

/** The role a prompt fixture is built for; `buildPrompt` takes the frontmatter, never the file. */
const ROLE: Frontmatter = { meta: { adapter: 'claude' }, body: '\n  You are a generalist.\n' };

/** The bytes a materialised diff would have contributed, seeded rather than produced by git. */
const DIFF = '\n## Diff to review\n\n```\ndiff --git a/src/a.ts b/src/a.ts\n+const a = 1;\n```';

/**
 * A context over a real harness directory and a real ticket folder under `os.tmpdir()`.
 *
 * The diff is seeded into `diffInputs` rather than materialised, because what this file is about is
 * composition: `diff.test.ts` owns whether the bytes are the right bytes.
 */
function context(overrides: Partial<PromptContext> = {}): PromptContext {
  const root = tempDir('prompt-');
  const harnessDir = path.join(root, 'harness');
  const ticketDir = path.join(root, 'backlog', FOLDER);
  write(path.join(harnessDir, 'rules.md'), '\nrules body\n');
  write(path.join(ticketDir, 'requirements', '2-merged.md'), '\nmerged body\n');
  const ticket = {
    dir: ticketDir, folder: FOLDER, body: '\nticket body\n',
    meta: { id: 'Q-0052', title: 'agent, gate and script steps', stage: 'requirements' },
  } as unknown as TicketRecord;
  return {
    repoDir: root, config: {}, ticket, runId: 3, baseOverride: null,
    vars: { id: 'Q-0052', iter: 2, run: 3, base: 'main' },
    deferredDiffs: new Map(), diffInputs: new Map([['main...harness/Q-0052/implement', DIFF]]),
    persistence: { appendLog: () => { /* no log in a prompt */ } },
    backlog: new Backlog(path.join(root, 'backlog')), harnessDir, dry: false,
    ...overrides,
  };
}

/** A step declaring every section `buildPrompt` can emit, including one harness file that is absent. */
const everySection: Record<string, unknown> = {
  id: 'implement',
  role: 'developer-generalist',
  worktree: true,
  instructions: '\n  Do the thing.\n',
  input: {
    harness: ['rules.md', 'not-written.md'],
    backlog: ['requirements/{iter}-*.md'],
    repo: true,
    diff: 'main...harness/{id}/implement',
  },
  output: { write: 'dev/report-{iter}.md', verdict: 'approve|changes-requested' },
};

describe('Q-0052 AC-2 — buildPrompt composes what an adapter is handed', () => {
  test('AC-2a/2b — every section, in the spike\'s order, with an absent harness input skipped silently', () => {
    const prompt = buildPrompt(everySection, ROLE, context());

    // A golden, not a set of `toContain`s: the sections' order and the blank lines between them are
    // what a vendor's own parser reads, and `toContain` is satisfied by any arrangement of them.
    expect(prompt).toBe(
      '# Role: developer-generalist\n'
      + 'You are a generalist.\n'
      + '\n'
      + '# Ticket Q-0052: agent, gate and script steps\n'
      + 'Stage: requirements. Iteration: 2.\n'
      + '\n'
      + 'ticket body\n'
      + '\n'
      + '## Input: harness/rules.md\n'
      + '\n'
      + 'rules body\n'
      + '\n'
      + `## Input: backlog/${FOLDER}/requirements/2-merged.md\n`
      + '\n'
      + 'merged body\n'
      + '\n'
      + '## Repository\n'
      + '\n'
      + 'You are running inside the repository at your working directory. Inspect it as needed.'
      + ' You MAY write files; this is an isolated worktree on its own branch.\n'
      + DIFF + '\n'
      + '\n'
      + '# Task\n'
      + '\n'
      + 'Do the thing.\n'
      + '\n'
      + '# Output contract\n'
      + '\n'
      + 'Respond ONLY with a JSON object matching the provided schema.'
      + ' Put the complete markdown document in "document" (it will be saved as dev/report-2.md).'
      + ' Set "verdict" to one of: approve|changes-requested. The first option means pass.',
    );
  });

  test('AC-2a — the order is asserted as an order, not inferred from the golden passing', () => {
    // The golden above fails on any byte, which makes it a strong test and a poor diagnosis: a
    // reordered section and a changed word read identically in its failure. The headings alone say
    // which of the two happened.
    const headings = buildPrompt(everySection, ROLE, context()).split('\n').filter((line) => /^#{1,2} /.test(line));
    expect(headings).toStrictEqual([
      '# Role: developer-generalist',
      '# Ticket Q-0052: agent, gate and script steps',
      '## Input: harness/rules.md',
      `## Input: backlog/${FOLDER}/requirements/2-merged.md`,
      '## Repository',
      '## Diff to review',
      '# Task',
      '# Output contract',
    ]);
  });

  test('AC-2b — a harness input that is not there is skipped, and one that is arrives', () => {
    // The negative half on its own, so "skipped silently" is distinguishable from "the whole loop
    // did nothing": one of the two declared files exists and the other does not.
    const prompt = buildPrompt(everySection, ROLE, context());
    expect(prompt).toContain('## Input: harness/rules.md');
    expect(prompt).not.toContain('not-written.md');
  });

  test('a step declaring nothing gets the role, the ticket and the output contract, and no more', () => {
    const prompt = buildPrompt({ id: 'grill' }, { meta: {}, body: '   ' }, context());
    expect(prompt).toBe(
      '# Role: agent\n'
      + '(no role description)\n'
      + '\n'
      + '# Ticket Q-0052: agent, gate and script steps\n'
      + 'Stage: requirements. Iteration: 2.\n'
      + '\n'
      + 'ticket body\n'
      + '\n'
      + '# Output contract\n'
      + '\n'
      + 'Respond ONLY with a JSON object matching the provided schema.',
    );
  });

  test('a step that may not write gets the other Repository sentence', () => {
    const prompt = buildPrompt({ id: 'review', input: { repo: true } }, ROLE, context());
    expect(prompt).toContain('Inspect it as needed. Do NOT modify files.');
    expect(prompt).not.toContain('isolated worktree');
  });

  test('R-6 — the dry-run deferral placeholder is ported byte for byte, and reaches only this string', () => {
    // Q-0051's OQ-1, ruled here: this text is what a deferred range produces, and `runAgentStep`
    // discards the prompt holding it at the dry short-circuit. Its bytes are pinned so the successor
    // that decides whether a deferral is REPORTED can see exactly what it is replacing or keeping.
    const step = { id: 'review', input: { diff: '{base}...harness/{id}/implement' } };
    const prompt = buildPrompt(step, ROLE, context({ dry: true, diffInputs: new Map() }));
    expect(prompt).toContain(
      '\n## Diff to review\n\n(dry run: `main...harness/Q-0052/implement` is produced by an earlier'
      + ' step of this flow and is materialised when that step has run)',
    );
  });

  test('a materialised range wins over the placeholder even under dry', () => {
    // The preflight materialises every range whose endpoints all exist, dry or not, so a preview
    // that had the bytes must show them rather than the deferral text.
    const step = { id: 'review', input: { diff: 'main...harness/{id}/implement' } };
    expect(buildPrompt(step, ROLE, context({ dry: true }))).toContain(DIFF.trim());
  });
});

describe('Q-0052 AC-3 — schemaFor emits four shapes, every one of them strict', () => {
  const SHAPES: [string, Record<string, unknown>, string[]][] = [
    ['{summary}', { id: 'a' }, ['summary']],
    ['{summary, document}', { id: 'a', output: { write: 'dev/x.md' } }, ['summary', 'document']],
    ['{summary, verdict, findings}', { id: 'a', output: { verdict: 'approve|reject' } }, ['summary', 'verdict', 'findings']],
    ['{summary, document, verdict, findings}', { id: 'a', output: { writes: ['dev/x.md'], verdict: 'approve|changes-requested' } }, ['summary', 'document', 'verdict', 'findings']],
  ];

  test.each(SHAPES)('%s declares exactly its own properties, and every one of them is required', (label, step, keys) => {
    const schema = schemaFor(step);
    expect(Object.keys(schema.properties)).toStrictEqual(keys);
    expect(schema.required).toStrictEqual(keys);
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
  });

  test.each(SHAPES)('AC-3d — %s obeys the rule Q-0046 left here as an executable helper', (label, step) => {
    // Imported from packages/core/test/strict-schema.ts rather than retyped, which is why Q-0046
    // exported it: until now the rule was covered on the spike alone and this ticket was its named
    // owner.
    expect(strictSchemaProblems(schemaFor(step), label)).toStrictEqual([]);
  });

  test('AC-3d — the helper has teeth, in both of the ways a generated schema can lose them', () => {
    // A strictness check that cannot fail is the defect Q-0034 paid for, so the helper is shown
    // rejecting each of the two mutations before it is trusted over the four shapes above.
    const schema = schemaFor({ id: 'a', output: { verdict: 'approve|reject' } });
    const open = { ...schema, additionalProperties: true };
    const understated = { ...schema, required: ['summary'] };
    expect(strictSchemaProblems(open, 'open')).toStrictEqual(['open: additionalProperties must be false']);
    expect(strictSchemaProblems(understated, 'understated')[0]).toContain('every property must appear in required');
  });

  test('AC-3b — the vocabulary is split on the pipe and its first option means pass', () => {
    const schema = schemaFor({ id: 'a', output: { verdict: 'approve|revise|reject' } });
    expect(schema.properties.verdict?.enum).toStrictEqual(['approve', 'revise', 'reject']);
  });

  test('AC-3c — a changes-requested vocabulary carries the shared finding pattern, and no other does', () => {
    const reviewing = schemaFor({ id: 'a', output: { verdict: 'approve|changes-requested' } });
    const plain = schemaFor({ id: 'a', output: { verdict: 'approve|reject' } });
    // Identity with the shared constant, not a copy of its text: a second spelling is what the
    // constant exists to prevent, and comparing against a literal here would permit one.
    expect(reviewing.properties.findings?.items).toStrictEqual({ type: 'string', pattern: FINDING_PATTERN });
    expect(plain.properties.findings?.items).toStrictEqual({ type: 'string' });
  });
});
