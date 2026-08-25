import { describe, expect, test } from 'vitest';

import { repoFile } from '../test/corpus.js';

// AC-4, AC-8 and AC-11 all require the documents to end up agreeing with what shipped. These check
// that they do, so a later edit that reintroduces one of the contradictions fails here rather than
// costing a reviewer a round.

const decisions = () => repoFile('docs/DECISIONS.md');

describe('AC-4 / AC-8 — the two DECISIONS entries exist in the required shape', () => {
  const entries = [
    'Zod describes structure and types; the flow lint keeps the semantics — 2026-08-25',
    'The event union is derived from what the product emits, and `tool` and `text` are not invented — 2026-08-25',
  ];

  test('both entries are present, dated, and carry Decision / Alternatives considered / Why', () => {
    const text = decisions();
    for (const title of entries) {
      const start = text.indexOf(`## ${title}`);
      expect(start, `missing entry: ${title}`).toBeGreaterThan(-1);
      const next = text.indexOf('\n## ', start + 1);
      const body = next === -1 ? text.slice(start) : text.slice(start, next);
      for (const heading of ['**Decision:**', '**Alternatives considered:**', '**Why']) {
        expect(body, `${title} needs ${heading}`).toContain(heading);
      }
    }
  });

  test('the entries are appended, not inserted', () => {
    const text = decisions();
    expect(text.indexOf(`## ${entries[0]}`)).toBeLessThan(text.indexOf(`## ${entries[1]}`));
    expect(text.indexOf(`## ${entries[1]}`)).toBeGreaterThan(text.lastIndexOf('## Q-0035 accepted'));
  });

  test('the event disposition table is in the entry, with a member or a stated reason per row', () => {
    const text = decisions();
    for (const row of ["type: 'spawn'", "type: 'stdout'", "type: 'retry'", 'ui.step(id, m)', 'ui.done(id, m)',
      'ui.info(m)', 'ui.warn(m)', 'ui.gate(', '**not added**']) {
      expect(text, `the disposition table needs a row for ${row}`).toContain(row);
    }
  });

  test('register row 22\'s operative reading is recorded for a child\'s reviewer', () => {
    expect(decisions().replace(/\s+/g, ' ')).toContain('no vendor-specific field and no vendor branching outside an adapter');
  });
});

describe('AC-8 / AC-11 — the documents agree with what shipped', () => {
  test('grepping either document for the event kinds yields one answer', () => {
    const architecture = repoFile('docs/04-architecture.md');
    const adapterContract = repoFile('docs/03-adapter-contract.md');
    // The two claims that disagreed with each other and with the code.
    expect(architecture).not.toContain('(`spawn`, `tool`, `text`, `verdict`, `usage`, `done`)');
    expect(adapterContract).not.toContain("({type:'spawn'|'stdout', ...})");
    // Both now name the same three adapter kinds.
    for (const document of [architecture, adapterContract]) {
      for (const kind of ['spawn', 'stdout', 'retry']) expect(document).toContain(kind);
    }
  });

  test('the status line of every document this change edits was bumped', () => {
    for (const file of ['docs/02-sdlc-pipeline-spec.md', 'docs/03-adapter-contract.md', 'docs/04-architecture.md']) {
      // The status "line" is a wrapped paragraph in every one of these documents.
      const text = repoFile(file);
      const start = text.indexOf('*Status:');
      expect(start, `${file} has no status line`).toBeGreaterThan(-1);
      const status = text.slice(start, text.indexOf('\n\n', start));
      expect(status, `${file}'s status line must record this change`).toContain('Q-0041');
    }
  });

  test('the ticket.md example shows the iterations keys and the history entry the engine writes', () => {
    const spec = repoFile('docs/02-sdlc-pipeline-spec.md');
    expect(spec).toContain('solutioning.architecture-review: 2');
    expect(spec).toContain('stage_before: draft, stage_after: requirements');
    // The two claims it made until this change.
    expect(spec).not.toContain('qa: 0                    # final-qa');
    expect(spec).not.toContain('{stage: requirements, run: 41, at: 2026-08-21T09:12Z, cost: 0.84}');
  });

  test('the glossary carries Event, and says it without introducing a synonym', () => {
    const glossary = repoFile('docs/GLOSSARY.md');
    expect(glossary).toContain('**Event**:');
    expect(glossary).toContain('adapter event');
    expect(glossary).toContain('run event');
  });
});
