import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { decisionFiles, flowFiles, read, repoFile } from '../test/corpus.js';

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

// 02-sdlc-pipeline-spec.md §5 prints one YAML block per flow, and until Q-0088 they were
// hand-maintained: they showed flat write paths a year of tickets had moved, and named a `harness:`
// input the shipped files never had. Prose about code drifts; a transcription of code drifts
// silently, because it still looks like the thing it describes. So the five that correspond to a
// shipped file are now that file, byte for byte, and this is what keeps them so.
describe('Q-0088 — §5\'s flow snippets are the shipped files, not a copy of them', () => {
  /** Section number → the flow whose file it prints. */
  const SHIPPED: Record<string, string> = {
    '5.1': 'requirements', '5.2': 'solutioning', '5.3': 'qa-red', '5.4': 'development', '5.5': 'review',
  };

  /**
   * Sections whose block is a SKETCH of a flow that does not exist yet, with why each stays one.
   * A sketch cannot be checked against a file, and pretending otherwise would either delete the
   * design or invent a file to satisfy a test.
   */
  const SKETCHES: Record<string, string> = {
    '5.6': 'qa-final.yaml is Q-0012\'s and unwritten; this block is its design, and Q-0056 owns the fact that it fails the real lintFlow on both verdict steps',
    '5.7': 'deploy.yaml is Q-0012\'s and unwritten; this block is the human-locked gate\'s design',
  };

  /** The fenced YAML block a `### <n> ` heading introduces, or null when it has none. */
  function blockOf(section: string): string | null {
    const text = repoFile('docs/02-sdlc-pipeline-spec.md');
    const heading = text.indexOf(`\n### ${section} `);
    if (heading < 0) return null;
    const open = text.indexOf('\n```yaml\n', heading);
    if (open < 0) return null;
    const start = open + '\n```yaml\n'.length;
    const close = text.indexOf('\n```', start);
    return close < 0 ? null : text.slice(start, close);
  }

  test('every section printing a shipped flow prints exactly that file', () => {
    for (const [section, flow] of Object.entries(SHIPPED)) {
      const block = blockOf(section);
      expect(block, `§${section} must still print a yaml block`).not.toBeNull();
      expect(block, `§${section} must be harness/flows/${flow}.yaml verbatim`)
        .toBe(repoFile(`harness/flows/${flow}.yaml`).replace(/\n+$/, ''));
    }
  });

  // The register cannot silently stop covering anything: every §5 section carrying a yaml block is
  // either checked against a file or excused by name, and a NEW one fails until it is classified.
  test('every §5 yaml block is either a shipped flow or a registered sketch', () => {
    const text = repoFile('docs/02-sdlc-pipeline-spec.md');
    const sections = [...text.matchAll(/^### (5\.\d) /gm)].map(([, n]) => n!);
    const withBlock = sections.filter((section) => blockOf(section) !== null);
    expect(withBlock.sort()).toStrictEqual([...Object.keys(SHIPPED), ...Object.keys(SKETCHES)].sort());
  });

  // A sketch is still a sketch: if one ever becomes a shipped file, it moves to SHIPPED rather than
  // sitting here excused while a real file exists beside it.
  test('no registered sketch names a flow that now has a file', () => {
    const shipped = new Set(flowFiles().map((file) => path.basename(file, '.yaml')));
    const claimed = Object.keys(SKETCHES).map((section) => {
      const text = repoFile('docs/02-sdlc-pipeline-spec.md');
      const heading = text.slice(text.indexOf(`\n### ${section} `));
      return /`([a-z-]+)\.yaml`/.exec(heading)?.[1] ?? '';
    });
    expect(claimed.filter((flow) => shipped.has(flow))).toEqual([]);
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

  test('Q-0097 AC-24 — the emit is described once, and its declaration is read out of turbo.json', () => {
    // *"When code and docs disagree, the docs are wrong until a DECISIONS entry says otherwise"*,
    // and the way a document about configuration goes wrong is by transcription: it drifts silently,
    // because it goes on looking like the thing it describes (Q-0088). So the pattern the document
    // quotes is compared against the shipped `turbo.json` rather than against a literal here.
    const architecture = repoFile('docs/04-architecture.md');
    const build = (JSON.parse(repoFile('turbo.json')) as {
      tasks: Record<string, { outputs?: string[]; dependsOn?: string[] }>;
    }).tasks.build;
    expect(build, 'the root declares no build task — this assertion would be vacuous').toBeDefined();
    expect(build.outputs?.length, 'the build task declares no outputs').toBeGreaterThan(0);

    for (const pattern of build.outputs ?? []) {
      // Exactly once: a second occurrence is the transcription this guard exists to refuse, and the
      // `packages/core` entry says in as many words that it does not restate this.
      const occurrences = architecture.split(`\`${pattern}\``).length - 1;
      expect(occurrences, `04-architecture.md describes the outputs pattern ${pattern} ${occurrences} times, not once`).toBe(1);
    }
    // The floor is what stops this loop from passing over an absent `dependsOn`: measured by
    // removing the key, at which point `?? []` iterates nothing and the clause reports success over
    // a task that no longer orders itself — *"a check that skips its subject must not report
    // success"* (2026-08-25), inside a guard written to catch a document drifting from a file.
    expect(build.dependsOn?.length, 'the build task declares no ordering, so this clause has no subject').toBeGreaterThan(0);
    for (const edge of build.dependsOn ?? []) {
      expect(architecture, `the document does not say how build is ordered (${edge})`).toContain(edge);
    }
    // And the claim the whole arrangement rests on, so a later reader meets it here as well as in
    // the decision entry: no existing verdict moves behind the artifact.
    expect(architecture).toContain('No verdict that exists today moves behind it');
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

describe('Q-0050 AC-13b — run event-stream documentation', () => {
  test('the glossary and architecture state every accepted stream rule', () => {
    const title = "What a run's event stream carries, and how a gate answer travels back";
    // One assertion per RULE, against the sentence rather than the noun. A word list is satisfied
    // by a document stating the opposite — a glossary reading "every event carries a timestamp"
    // contains "timestamp" — and that is not hypothetical here: docs/decisions/065 exists because
    // two STATEMENTS in 062 were false while every word in them was the right word. This guard was
    // positioned to catch exactly that and could not.
    for (const file of ['docs/GLOSSARY.md', 'docs/04-architecture.md']) {
      const body = repoFile(file);
      expect(body, `${file}: cites the decision by title`).toContain(title);
      expect(body, `${file}: cites the decision's date`).toContain('2026-08-28');
      // The erratum is cited beside it, so a reader arriving at 062 is pointed away from its two
      // superseded clauses. 065's own "Alternatives considered" names these citations as its reason.
      expect(body, `${file}: cites 062's erratum`).toMatch(/2026-08-29 erratum|erratum to \*?What a run/);
      expect(body, `${file}: the terminal member is last`).toMatch(/terminal[^.]*\b(last|final)\b|\b(last|final)\b[^.]*terminal/i);
      expect(body, `${file}: the gate question precedes the callback`).toMatch(/(queued|emitted)\s+before[\s\S]{0,80}answerGate/i);
      expect(body, `${file}: cancellation belongs to the caller`).toMatch(/AbortSignal[\s\S]{0,160}(caller|not to a signal handler)|caller[\s\S]{0,160}AbortSignal/i);
      expect(body, `${file}: no event gains a timestamp`).toMatch(/(no event[\s\S]{0,60}timestamp|carry no timestamp|gains? no timestamp)/i);
      expect(body.toLowerCase(), `${file}: parallel ordering limit`).toMatch(/parallel[\s\S]*(order|interleav)/);
    }
  });
});

/**
 * Q-0040 AC-12 — the spec's status list and the shipped vocabulary name the same set.
 *
 * §3.3 has carried a hand-written list of statuses since 2026-08-21 and nothing compared it to the
 * code, which is how a sentence in a document drifts silently from what it describes. The set is
 * read out of `spike/src/contracts.js` rather than retyped here, so this file adds no third copy to
 * keep in step; `packages/core/src/contracts/run-manifest.ts` keeps the same seven words and its
 * own suite pins them.
 */
describe('Q-0040 AC-12 — the documented status vocabulary is the shipped one', () => {
  /**
   * A document with its line breaks collapsed, for the assertions that are about a sentence.
   *
   * These documents are hard-wrapped, so a cited title lands on two lines as often as on one and a
   * scan for the contiguous string walks past it — the soft-wrap blindness Q-0050's review found
   * four rounds deep. Reading the flowed text is the fix, not widening the string.
   */
  const flowed = (file: string): string => repoFile(file).replace(/\s+/g, ' ');

  /** The words §3.3 lists, taken from the sentence that lists them. */
  const documented = (): string[] => {
    const spec = repoFile('docs/02-sdlc-pipeline-spec.md');
    const sentence = /`status` is one of ([^—]+)—/.exec(spec);
    if (!sentence) throw new Error('docs/02-sdlc-pipeline-spec.md §3.3 no longer states what `status` is one of');
    return [...sentence[1].matchAll(/`([a-z]+)`/g)].map(([, word]) => word);
  };

  /** The words the spike ships, read out of its own source rather than imported across the port. */
  const shipped = (): string[] => {
    const source = repoFile('spike/src/contracts.js');
    const declaration = /export const TERMINAL_STATUSES = \[([^\]]+)\]/.exec(source);
    if (!declaration) throw new Error('spike/src/contracts.js no longer declares TERMINAL_STATUSES');
    return [...declaration[1].matchAll(/'([a-z]+)'/g)].map(([, word]) => word);
  };

  test('§3.3 and TERMINAL_STATUSES name the same seven words', () => {
    // Both lists are read rather than asserted against a literal, so this fails when either side
    // moves and passes only when they move together.
    expect([...documented()].sort()).toStrictEqual([...shipped()].sort());
    expect(shipped()).toContain('undecided');
    expect(documented()).toHaveLength(7);
  });

  test('the spec says what undecided does, not only that it exists', () => {
    // A word list is satisfied by a document stating the opposite, which is the failure 065 records.
    const spec = flowed('docs/02-sdlc-pipeline-spec.md');
    expect(spec, 'it moves no stage').toMatch(/`undecided`[\s\S]{0,900}moves no stage/);
    expect(spec, 'it does not restore the branch').toMatch(/`undecided`[\s\S]{0,900}not\*{0,2} do is restore the ticket branch/);
    expect(spec, 'it cites the decision').toContain('A run nobody answered is undecided, and keeps the branch it proved');
  });

  test('the glossary carries the term with its decision, and introduces no synonym for it', () => {
    const glossary = flowed('docs/GLOSSARY.md');
    expect(glossary).toContain('**Undecided**:');
    expect(glossary).toContain('A run nobody answered is undecided, and keeps the branch it proved');
    expect(glossary).toContain('2026-09-01');
    // The vocabulary rule's own clause: no synonym is introduced for a term that already exists.
    expect(glossary).toMatch(/Not a synonym for "aborted", "failed" or "paused"/);
  });
});
