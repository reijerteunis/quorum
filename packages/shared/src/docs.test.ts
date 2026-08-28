import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { decisionFiles, read, repoFile } from '../test/corpus.js';

// AC-4, AC-8 and AC-11 all require the documents to end up agreeing with what shipped. These check
// that they do, so a later edit that reintroduces one of the contradictions fails here rather than
// costing a reviewer a round.

/** One row of `docs/DECISIONS.md`: an entry, the file it links to, and the date it is listed under. */
interface Listed {
  readonly title: string;
  readonly file: string;
  readonly date: string;
}

/**
 * The index's entry rows, in the order it lists them.
 *
 * Only lines that ARE an entry — a list item whose link points into `decisions/` — count. The
 * page's own prose links to two entries as examples, and reading those as rows would report an
 * index that disagrees with its folder.
 */
function listed(): Listed[] {
  const rows: Listed[] = [];
  let date = '';
  for (const line of repoFile('docs/DECISIONS.md').split('\n')) {
    const heading = /^## (\d{4}-\d{2}-\d{2})$/.exec(line);
    if (heading) { date = heading[1]; continue; }
    const row = /^- \[(.+)\]\(decisions\/([^)]+)\)$/.exec(line);
    if (!row) continue;
    if (!date) throw new Error(`docs/DECISIONS.md lists "${row[1]}" under no date`);
    rows.push({ title: row[1], file: row[2], date });
  }
  if (!rows.length) throw new Error('docs/DECISIONS.md lists no entries — this test proves nothing without them');
  return rows;
}

/**
 * The entries by file name, read through the audited walk of `docs/decisions` rather than by
 * composing a path out of what the index says — so a link to a file that is not in the folder is
 * an absence this can report, and never a read of somewhere else.
 */
const onDisk = (): Map<string, string> =>
  new Map(decisionFiles().map((file) => [path.basename(file), read(file)]));

/** One decision entry's text, found the way the rest of the repository cites it: by title. */
function entry(title: string): string {
  const row = listed().find((r) => r.title === title);
  if (!row) throw new Error(`docs/DECISIONS.md does not list an entry titled: ${title}`);
  const text = onDisk().get(row.file);
  if (text === undefined) throw new Error(`docs/DECISIONS.md links "${title}" to decisions/${row.file}, which is not there`);
  return text;
}

describe('AC-4 / AC-8 — the two DECISIONS entries exist in the required shape', () => {
  const entries = [
    'Zod describes structure and types; the flow lint keeps the semantics',
    'The event union is derived from what the product emits, and `tool` and `text` are not invented',
  ];

  test('both entries are present, dated, and carry Decision / Alternatives considered / Why', () => {
    for (const title of entries) {
      const body = entry(title);
      expect(body.split('\n')[0], `${title} must open with its own title and date`)
        .toBe(`# ${title} — 2026-08-25`);
      for (const heading of ['**Decision:**', '**Alternatives considered:**', '**Why']) {
        expect(body, `${title} needs ${heading}`).toContain(heading);
      }
    }
  });

  test('the entries are appended, not inserted', () => {
    const order = listed().map((row) => row.title);
    expect(order.indexOf(entries[0])).toBeLessThan(order.indexOf(entries[1]));
    expect(order.indexOf(entries[1]))
      .toBeGreaterThan(order.findIndex((title) => title.startsWith('Q-0035 accepted')));
  });

  test('the event disposition table is in the entry, with a member or a stated reason per row', () => {
    const body = entry(entries[1]);
    for (const row of ["type: 'spawn'", "type: 'stdout'", "type: 'retry'", 'ui.step(id, m)', 'ui.done(id, m)',
      'ui.info(m)', 'ui.warn(m)', 'ui.gate(', '**not added**']) {
      expect(body, `the disposition table needs a row for ${row}`).toContain(row);
    }
  });

  test('register row 22\'s operative reading is recorded for a child\'s reviewer', () => {
    expect(entry(entries[1]).replace(/\s+/g, ' ')).toContain('no vendor-specific field and no vendor branching outside an adapter');
  });
});

// The index and the folder are one list held in two places, so each is checked against the other
// rather than against itself. A file nobody links to is unfindable; a link to nothing is a broken
// index; and an entry whose own title has drifted from the line that cites it breaks the only
// identity this document has, since decisions are cited by title and date and never by file name.
// See "A decision is a file; this page is the index" (2026-08-28).
describe('docs/DECISIONS.md indexes docs/decisions/ exactly', () => {
  test('every entry file is listed once, in the order the folder holds them', () => {
    expect(listed().map((row) => row.file)).toEqual([...onDisk().keys()]);
  });

  test('each entry opens with the title and date the line linking to it carries', () => {
    const files = onDisk();
    for (const { title, file, date } of listed()) {
      expect(files.get(file), `docs/DECISIONS.md links to decisions/${file}`).toBeDefined();
      expect(files.get(file)?.split('\n')[0], `docs/decisions/${file}`).toBe(`# ${title} — ${date}`);
    }
  });

  test('the dates never go backwards — the index is append-only, newest last', () => {
    const dates = listed().map((row) => row.date);
    expect([...dates].sort((a, b) => a.localeCompare(b))).toEqual(dates);
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
