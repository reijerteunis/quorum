import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { decisionFiles, flowFiles, read, repoFile, repoRoot } from '../test/corpus.js';
import { gateAnswerSchema } from './events.js';

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

describe('Q-0120 AC-23 — live connection documentation', () => {
  test('architecture replaces the obsolete no-connection account with shared ownership and re-export', () => {
    const architecture = repoFile('docs/04-architecture.md');
    expect(architecture).not.toContain('There is no connection to the daemon');
    // Scoped to the section AC-23 names, because over the whole file both clauses were satisfied by
    // the STATUS LINE alone: every ticket writes a dated entry there, this one's contains the phrase,
    // and `packages/server` occurs earlier in the same line from an older entry — so the ordering
    // clause passed too, and the section could have been deleted outright with this test green.
    // The anti-over-slice clause is the shape the glossary guard above already uses, for the reason
    // its own comment records. Q-0120 review round 3, M-1.
    const start = architecture.indexOf('### `packages/server`');
    expect(start, 'the section AC-23 names is gone').toBeGreaterThanOrEqual(0);
    const next = architecture.indexOf('\n### ', start + 1);
    const section = architecture.slice(start, next < 0 ? undefined : next);
    // **The anti-over-slice clause, retired by replacement rather than by having its number
    // raised** (Q-0122). It was `length < 12000`, a proxy for *the slice stopped at the section
    // boundary* that a section growing legitimately falsifies — this one reached 13,245 characters
    // when the static route was documented, and a bumped ceiling would have to be bumped again by
    // whoever writes the next paragraph. What replaces it asks the property directly, in the shape
    // `packages/server/src/package.test.ts`'s own slice guard already uses: a slice that ran past
    // the end would carry the heading after it, and one that ran backwards would carry the status
    // line. Neither depends on how much prose the section holds.
    expect(section, 'the slice ran past the end of the section').not.toContain('### `packages/cli`');
    expect(section, 'the slice ran back into the status line').not.toContain('*Status:');
    expect(section.length, 'the section is implausibly short — the slice lost most of its subject').toBeGreaterThan(1000);
    expect(section, 'the slice lost its subject').toContain('### `packages/server`');
    expect(section, 'the server section does not say where the frame union lives').toMatch(/frame union[\s\S]*@quorum\/shared/i);
    expect(section, 'the server section does not say it re-exports').toMatch(/re-export/i);
  });

  test('the glossary defines the closed, derived, memory-only connection state separately from run state', () => {
    const glossary = repoFile('docs/GLOSSARY.md');
    const start = glossary.indexOf('**Connection state**');
    expect(start).toBeGreaterThanOrEqual(0);
    // The delimiter is `\n**` and not `\n- **`: this file's entries are `**Term**:` at line start
    // rather than bullets, so the bullet form occurs ZERO times and the slice ran to the end of the
    // document — 17,593 of 22,260 characters, with three clauses below satisfied by neighbouring
    // entries. The nine-state list still discriminated, which is why the guard had a subject while
    // not having the scoped one it reads as having. Q-0120 review round 1, N-3.
    const next = glossary.indexOf('\n**', start + 1);
    const entry = glossary.slice(start, next < 0 ? undefined : next);
    // And the scope is asserted rather than assumed: a slice that swallowed its neighbours would
    // pass every clause below for the wrong reason.
    expect(entry.length, 'the entry slice reaches past its own term').toBeLessThan(2000);
    expect(entry, 'the slice lost its subject').toContain('**Connection state**');
    for (const state of ['idle', 'connecting', 'live', 'no daemon', 'no such run', 'ended', 'interrupted', 'dropped', 'protocol error']) expect(entry.toLowerCase()).toContain(state);
    expect(entry).toMatch(/derived|per moment/i);
    expect(entry).toMatch(/never (?:stored|persisted)|memory/i);
    expect(entry).toMatch(/run state/i);
    // AC-23's remaining clause: no member of the set is silence. Asserted here because the entry is
    // where the vocabulary is fixed, and because B-2 is the same rule going unmet one layer up.
    expect(entry, 'AC-23 requires the entry to state that no member of it is silence').toMatch(/no member of it is silence|none of them is silence/i);
  });

  test('the repository architecture no longer calls frontend inert', () => {
    // Both directions, and the needle tolerates the backticks the file actually carries. Until
    // Q-0120 review round 2 it read /frontend(?:`)? and data remain inert/i, which allows one
    // optional backtick after `frontend` and then requires the bare words — while the sentence on
    // main is "`frontend` and `data` remain inert", with backticks around `data` the pattern cannot
    // consume. Measured: that needle matches main's text ZERO times, so the assertion was green over
    // the unchanged file and would have stayed green if the correction were reverted. "A check is
    // not established by reading it" (2026-08-29), in the guard added to enforce the correction.
    const architecture = repoFile('harness/architecture.md');
    const inert = /`?frontend`?\s+and\s+`?data`?\s+remain\s+inert/i;
    expect(architecture, 'the architecture context still calls frontend inert').not.toMatch(inert);
    // The needle has a subject: it matches the sentence it forbids, in the spelling that shipped.
    expect('`frontend` and `data` remain inert. `apps/web` exists since Q-0008,').toMatch(inert);
    // And the positive half, so the clause fails in both directions rather than only when the old
    // sentence returns. This file is fed to the architect on every solutioning run, so a stale
    // sentence here is one every future solution inherits — AC-23's one clause whose subject is a
    // harness context file.
    expect(architecture, 'the architecture context does not name frontend as active').toMatch(/`?frontend`?\s+is\s+active/i);
  });
});

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
 * read out of the product rather than retyped here, so this file adds no second copy to keep in
 * step.
 *
 * Q-0107 AC-9/AC-10 — `re-aimed`. It read `spike/src/contracts.js` until then and this comment
 * pointed at `packages/core/src/contracts/run-manifest.ts` as the tree that *also* held the words;
 * that file is now the subject. It is a module-private const in a package this one may not import
 * (04-architecture.md), so it is read as TEXT — which is what `project.test.ts` already does with
 * two other `packages/core` files, and it is a declared input of this package's `test` task.
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

  /** The words the product ships, read out of its own source rather than imported across packages. */
  const shipped = (): string[] => {
    const file = 'packages/core/src/contracts/run-manifest.ts';
    const declaration = /const TERMINAL_STATUSES: readonly string\[\] = \[([^\]]+)\]/.exec(repoFile(file));
    if (!declaration) throw new Error(`${file} no longer declares TERMINAL_STATUSES as an array literal`);
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

describe('Q-0098 AC-21 — the documentation separates three installation claims', () => {
  /** A document with its line breaks collapsed, because these files are hard-wrapped. */
  const flowed = (file: string): string => repoFile(file).replace(/\s+/g, ' ');

  /**
   * The documents this ticket edits, and which therefore carry the claim.
   *
   * `docs/decisions/**` is deliberately absent and its exemption is asserted below: a landed entry
   * is never edited, so a scan that demanded a correction there would name a surface the rules
   * forbid — *"A requirement may not name a surface its flow cannot write"* (2026-08-25), arriving
   * on a surface the rules forbid rather than one the role cannot reach. 078(d) governs and 008 is
   * superseded in substance by a later entry naming it, which is the mechanism the append-only rule
   * exists to provide.
   */
  const EDITED = [
    'docs/04-architecture.md',
    'docs/01-product-definition.md',
    'docs/06-development-plan.md',
    'harness/product-context.md',
  ];

  test('each edited document names the two claimed paths and the one that is refused', () => {
    for (const file of EDITED) {
      const text = flowed(file);
      expect(text, `${file} does not name the workspace-local path`).toMatch(/workspace-local/i);
      expect(text, `${file} does not name the locally packed path`).toMatch(/locally packed|packed tarball|five tarballs/i);
      expect(text, `${file} does not say the registry path is refused`).toMatch(/refused rather than deferred|does not\b[\s\S]{0,200}private/i);
      expect(text, `${file} does not route the registry path to its owner`).toContain('Q-0029');
    }
  });

  /**
   * What each document is scanned for an unqualified claim.
   *
   * The whole file everywhere except the development plan, whose subject is its **`Done when`
   * bullets** — which is what AC-21 means by a *"development-plan bullet"*, and where the corrected
   * sentence lived. The rest of that file is a **record**: ticket titles (*"Q-0010 CLI package;
   * `npx quorum` entry"*), and entries saying what a ticket was scoped to do or had withdrawn from
   * it. Measured — five of its twelve mentions are of that kind and none of them tells a reader to
   * type anything. Rewriting them would be rewriting the history of how the claim was refused, which
   * is the opposite of what this criterion asks for; the exclusion is asserted load-bearing below.
   */
  const claimSurface = (file: string): string => {
    const text = flowed(file);
    if (!file.endsWith('06-development-plan.md')) return text;
    return [...text.matchAll(/\*\*Done when\*\*([\s\S]*?)\*\*Tickets\*\*/g)].map(([, block]) => block).join(' ');
  };

  test('no edited document claims a cold machine can obtain Quorum from the public registry', () => {
    // The claim this ticket exists to remove. Every surviving `npx quorum` must sit inside a
    // sentence that says it is the M6 registry path, so the scan is for an unqualified one: the
    // mention is allowed, the *claim* is not.
    //
    // The window reaches BOTH ways, because prose qualifies a phrase as often before it as after —
    // measured: the plan's done-when names the refusal and then refers back to it in the next
    // sentence, which a forward-only scan reported as an unqualified claim.
    const window = (text: string, at: number): string => text.slice(Math.max(0, at - 300), at + 400);
    for (const file of EDITED) {
      const text = claimSurface(file);
      for (const match of [...text.matchAll(/npx quorum/g)]) {
        const context = window(text, match.index);
        expect(
          /Q-0029|M6|registry|private/i.test(context),
          `${file} mentions npx quorum without saying it is the deferred registry path: …${context.slice(0, 200)}…`,
        ).toBe(true);
      }
    }
  });

  test('the plan\'s narrowed surface still holds the sentence this ticket corrected', () => {
    // Without this the narrowing would be a filter that quietly excused the whole file: the block
    // extraction could match nothing and the clause above would pass over an empty string. What it
    // must contain is M2's done-when — the bullet that said `npx quorum` works from a clean clone —
    // and the surface must be a strict subset of the file, or it is not narrowed at all.
    const surface = claimSurface('docs/06-development-plan.md');
    const whole = flowed('docs/06-development-plan.md');
    expect(surface.length, 'the Done when extraction matched nothing').toBeGreaterThan(400);
    expect(surface.length, 'the extraction is the whole file, so nothing was excluded').toBeLessThan(whole.length);
    // Q-0103 AC-26 moved this literal. It read '`packages/cli` wraps core with the spike\'s
    // commands' until the cutover rewrote that bullet, and the pin has to move in the same change
    // or the file it pins goes red for a sentence nobody may keep. What it is for is unchanged: a
    // sentence that lives inside M2's Done when block and outside every other, so a narrowing that
    // matched nothing would fail here rather than pass over an empty string.
    expect(surface, 'M2\'s done-when is outside the scanned surface').toContain('`packages/cli` dispatches all eight commands the spike had');
    expect(surface, 'the corrected bullet names neither claimed path').toMatch(/workspace-local/);
    // And the excluded region really is what it is said to be: mentions that are records.
    expect(whole.length - surface.length, 'nothing was excluded').toBeGreaterThan(1000);
    expect(whole, 'the excluded region holds no ticket-entry mention, so the exclusion excuses nothing')
      .toContain('Q-0010 CLI package; `npx quorum` entry');
  });

  test('and that scan has a subject — it recognises an unqualified claim where one is written', () => {
    // Without this the clause above would pass over a corpus containing no `npx quorum` at all, or
    // over a regex that matched nothing. Both directions, over fixtures rather than over the tree.
    const window = (text: string, at: number): string => text.slice(Math.max(0, at - 300), at + 400);
    const bare = 'Install it with npx quorum and you are done.';
    const at = /npx quorum/.exec(bare)?.index ?? -1;
    expect(at, 'the scan cannot find the phrase it is written to find').toBeGreaterThan(-1);
    expect(/Q-0029|M6|registry|private/i.test(window(bare, at)), 'an unqualified claim is not recognised as one').toBe(false);
    // Qualified after, and qualified BEFORE — the second is what the window reaches both ways for.
    const after = 'Use npx quorum once it is published, which is Q-0029\'s in M6.';
    const before = 'Registry resolution stays Q-0029\'s in M6, so nothing here promises npx quorum works.';
    for (const qualified of [after, before]) {
      const found = /npx quorum/.exec(qualified)?.index ?? -1;
      expect(/Q-0029|M6|registry|private/i.test(window(qualified, found)), `not recognised as qualified: ${qualified}`).toBe(true);
    }
  });

  test('the decisions are exempt, and the exemption is load-bearing rather than a widened filter', () => {
    // Load-bearing means the exempted files really do carry what the scan would otherwise refuse:
    // 008's cold-clone sentence is an unqualified `npx quorum` in an append-only entry. If it did
    // not, the exemption would be excusing nothing and could be deleted without anyone noticing —
    // the register-rot shape Q-0073 found.
    const frozen = flowed('docs/decisions/008-v1-cut-and-launch-test.md');
    const match = /npx quorum/.exec(frozen);
    expect(match, 'decision 008 no longer carries the phrase the exemption exists for').not.toBe(null);
    const context = frozen.slice(match?.index ?? 0, (match?.index ?? 0) + 400);
    expect(
      /Q-0029|M6/i.test(context),
      'decision 008 now qualifies its own claim, so the exemption excuses nothing and should go',
    ).toBe(false);
    // And the exemption is exactly `docs/decisions/**` rather than the whole of `docs/`: three of
    // the four edited documents are under it, so a scan excusing `docs/` would report success over
    // its own subject.
    expect(EDITED.filter((file) => file.startsWith('docs/')).length).toBeGreaterThan(2);
    expect(EDITED.filter((file) => file.startsWith('docs/decisions/'))).toStrictEqual([]);
  });

  test('the glossary defines both new terms with their decision, and says what each is not', () => {
    // Per `harness/rules.md`, a term goes in the glossary before its second use. Both were already
    // in their second file — decision 078 and `04-architecture.md` — so this was owed rather than
    // conditionally owed. The shape is the one Event and Undecided already use.
    const glossary = flowed('docs/GLOSSARY.md');
    for (const term of ['**Build task**:', '**Emitted artifact**:']) {
      expect(glossary, `the glossary does not define ${term}`).toContain(term);
    }
    expect(glossary).toContain('The emit serves the binary, and no test verdict moves behind it');
    expect(glossary).toContain('2026-09-02');
    // The no-synonym clause, which is what stops a definition from being a paraphrase.
    expect(glossary, 'build task does not say what it is not').toMatch(/Not a "pipeline", a "job" or a "step"/);
    expect(glossary, 'emitted artifact does not distinguish itself from the binary').toMatch(/the two words are not interchangeable/);
    // `docs/README.md`'s term list moves with them, which nothing else checks.
    expect(repoFile('docs/README.md')).toContain('build task, emitted artifact');
  });

  test('the status line of every numbered document this change edits records Q-0098', () => {
    // A NEW assertion beside the Q-0041 one above rather than a change to it: trading a landed
    // guard for this one would be a check swapped rather than added (merged.md §M-14).
    for (const file of EDITED.filter((name) => /docs\/0\d/.test(name))) {
      const text = repoFile(file);
      const start = text.indexOf('*Status:');
      expect(start, `${file} has no status line`).toBeGreaterThan(-1);
      const status = text.slice(start, text.indexOf('\n\n', start));
      expect(status, `${file}'s status line does not record this change`).toContain('Q-0098');
      expect(status, `${file}'s status line does not carry the landing date`).toContain('2026-09-02');
    }
  });
});

describe('Q-0105 AC-13 — the documents that describe what the board shows carry push lag', () => {
  /** A document with its line breaks collapsed, because these files are hard-wrapped. */
  const flowed = (file: string): string => repoFile(file).replace(/\s+/g, ' ');

  /** The numbered documents this ticket edits, which therefore carry the claim and the date. */
  const EDITED = ['docs/02-sdlc-pipeline-spec.md', 'docs/04-architecture.md'];

  test('the glossary defines the term, its derivation, and what it is not', () => {
    // The shape Containment, Event and Undecided already use. The "what it is not" half is what
    // stops a definition being a paraphrase, and here it is the load-bearing half: this term exists
    // because four documents claimed a path worked, so a glossary entry that left room to read it
    // as a claim about testing would reproduce the failure in the vocabulary.
    const glossary = flowed('docs/GLOSSARY.md');
    expect(glossary, 'the glossary does not define **Push lag**:').toContain('**Push lag**:');
    expect(glossary, 'it does not say which refs it is derived from').toContain('<upstream>..<base>');
    expect(glossary, 'it does not say it is derived on every invocation and never stored')
      .toMatch(/every `quorum board` invocation and never stored/);
    expect(glossary, 'it does not cite the decision by title')
      .toContain('The board reports push lag, and never a CI conclusion');
    expect(glossary, 'it does not cite the decision\'s date').toContain('2026-09-06');
    // The four things it is not, each asserted separately: a list satisfied by naming one of them
    // would let the other three quietly go.
    expect(glossary, 'it does not distinguish itself from containment').toMatch(/Not containment/);
    expect(glossary, 'it does not refuse "behind"').toMatch(/not "behind"/);
    expect(glossary, 'it does not refuse "out of date"').toMatch(/not "out of date"/);
    expect(glossary, 'it does not refuse being read as a claim about testing')
      .toMatch(/not a claim that anything was built, tested or validated/);
    // And the asymmetry, which is the rule the rendering rests on.
    expect(glossary, 'it does not say the line may warn and may never reassure')
      .toMatch(/may warn and may never reassure/);
  });

  test('README\'s term list gains it, under an assertion that fails when it is missing', () => {
    // The Q-0098 pin one describe above is `toContain('build task, emitted artifact')` over a list
    // that ENDS with those two words, so it stays green whether a later term is appended or
    // omitted — it cannot catch this. A new assertion is therefore owed rather than an edited one,
    // and the clause below shows the old pin passing over a list this one refuses.
    expect(repoFile('docs/README.md'), 'the term list does not name push lag').toContain('push lag');
    const withoutIt = 'BYOS, build task, emitted artifact). A new term goes here';
    expect(withoutIt.includes('build task, emitted artifact'),
      'the landed pin does not pass over a list omitting the term, so it was sufficient after all')
      .toBe(true);
    expect(withoutIt.includes('push lag'), 'this assertion does not refuse what the old one accepts')
      .toBe(false);
  });

  test('both numbered documents state it, and their status lines record Q-0105', () => {
    for (const file of EDITED) {
      const text = repoFile(file);
      expect(flowed(file), `${file} does not name push lag`).toContain('push lag');
      const start = text.indexOf('*Status:');
      expect(start, `${file} has no status line`).toBeGreaterThan(-1);
      const status = text.slice(start, text.indexOf('\n\n', start));
      expect(status, `${file}'s status line does not record this change`).toContain('Q-0105');
      expect(status, `${file}'s status line does not carry the landing date`).toContain('2026-09-06');
    }
  });

  test('each document refuses the reading its own subject makes available', () => {
    // AC-9's forbidden-substring treatment belongs to the RENDERED line and is asserted over the
    // board's real output in `packages/cli/src/board.test.ts`. It is deliberately not repeated over
    // prose: a scan for those words cannot tell a claim from a rule quoting one, and the first
    // thing it fired on was the glossary's own prohibition.
    //
    // What prose can be held to is that each document refuses the misreading a reader of THAT
    // document could make. The spec describes what the board shows, so it refuses the claim about
    // testing; the architecture document describes what the code does, so it refuses the network
    // call — which is the same refusal one layer down, and the reason this is not one assertion
    // repeated twice. Emphasis markers are tolerated: the emphasis is not the claim.
    expect(flowed('docs/02-sdlc-pipeline-spec.md'), 'the spec states the fact without refusing the misreading')
      .toMatch(/\**not\** a claim that anything was built, tested or validated/);
    expect(flowed('docs/04-architecture.md'), 'the architecture document does not say this reaches no network')
      .toMatch(/Nothing on this path reaches the network/);
    expect(flowed('docs/04-architecture.md'), 'nor that that is what makes it a git fact rather than a CI one')
      .toMatch(/a git fact rather than a CI one/);
  });
});

describe('Q-0108 — `CLAUDE.md` and `docs/README.md` carry the same term list', () => {
  /**
   * The vocabulary rule is stated twice — `CLAUDE.md`'s "Read first" list and `docs/README.md`'s
   * GLOSSARY row — and until now nothing compared them.
   *
   * **What it costs when nothing does.** Q-0105's GO-2 found `CLAUDE.md` **three terms behind, not
   * one**: `build task` and `emitted artifact` had been missing since Q-0098 on 2026-09-02 — four
   * days and eleven merges — while `docs/README.md` carried both. GO-2's own premise is the
   * finding: no assertion in `packages/` read that list, so an omission was silent, and the silence
   * had already been running when the obligation was written. This is the clause that would have
   * caught it the day it happened.
   *
   * **Reading `CLAUDE.md` is ruled here rather than assumed, which is what Q-0108 asked for before
   * any code.** Q-0103's erratum E-2 made that file the human's to **write**, being the vendor
   * dialect of the canonical harness. Writing and reading are different acts, and the entry is not
   * stretched to cover both by assumption: this suite already reads three human-owned documents by
   * exactly this mechanism — `docs/README.md`, `docs/GLOSSARY.md` and the numbered plan — and a
   * test that reads a file to check it against another takes nothing away from whoever owns it.
   * *"A check is not established by reading it"* (2026-08-29) argues the same way from the other
   * side: a rule stated in two places and enforced in neither is not enforced. Q-0090's erratum E-1
   * is the precedent for ruling that a landed entry does not govern a case it was not scoped to,
   * and it ruled the entry did not govern. **No new decision entry is owed** — a reading rule that
   * changes no behaviour and contradicts no landed entry belongs where the next reader meets it,
   * which is here.
   *
   * **What changes at M5, stated now rather than discovered.** `CLAUDE.md` is a vendor dialect the
   * compiler will one day generate from `harness/` (`docs/GLOSSARY.md`, **Canonical harness**).
   * When it does, this check stops comparing two hand-maintained lists and starts comparing a
   * generated one against a hand-maintained one — which is a stronger check, not a broken one, but
   * it is the moment to decide which of the two is the source.
   */
  /** The parenthesised vocabulary a file states the "use exactly these terms" rule with. */
  function termList(file: string): readonly string[] {
    const text = repoFile(file);
    const marker = /[Uu]se exactly these terms \(/.exec(text);
    if (!marker) throw new Error(`${file} no longer states the vocabulary rule — this check has lost its subject`);
    const open = marker.index + marker[0].length;
    const close = text.indexOf(')', open);
    if (close < 0) throw new Error(`${file}'s term list is never closed`);
    return text.slice(open, close).replace(/\s+/g, ' ').split(',').map((term) => term.trim());
  }

  test('both files state the vocabulary rule, and the extractor finds the real list', () => {
    // Anti-vacuity, and it is the point rather than ceremony: an extractor that matched an empty
    // group would return [''] from both files and compare EQUAL, which is precisely the shape this
    // repository has shipped as a check that cannot fail more than once. The anchors are the first
    // and last terms, so a list that is found but truncated fails here rather than passing below.
    for (const file of ['CLAUDE.md', 'docs/README.md']) {
      const terms = termList(file);
      expect(terms, `${file}: the extracted list is not the vocabulary list`).toContain('harness');
      expect(terms, `${file}: the extracted list is truncated`).toContain('push lag');
      // A floor rather than a count: this pins that a list was found, and pinning the exact number
      // would make every new term a two-file edit for no gain.
      expect(terms.length, `${file}: the extracted list is implausibly short`).toBeGreaterThan(15);
    }
  });

  test('the two lists are the same terms in the same order', () => {
    // Ordered, because they are meant to be one list written twice: a term that moved in one file
    // and not the other is the same divergence as a term that is missing, found one edit earlier.
    expect(
      termList('CLAUDE.md'),
      'CLAUDE.md and docs/README.md state different vocabularies — see Q-0105 GO-2, where CLAUDE.md ran three terms behind for four days',
    ).toStrictEqual(termList('docs/README.md'));
  });
});

describe('Q-0055 AC-13 — the spec states the step-id rule, and states its exceptions', () => {
  /**
   * §4's table, which is where a flow-engine addition is recorded rather than left in the linter.
   *
   * Sliced out of the document rather than searched for across the whole of it, so a sentence
   * elsewhere on the page cannot satisfy a claim about what the table says.
   */
  const additions = (): string => {
    const spec = repoFile('docs/02-sdlc-pipeline-spec.md');
    const start = spec.indexOf('## 4. Flow engine additions');
    if (start < 0) throw new Error('docs/02-sdlc-pipeline-spec.md has no §4 — this check has lost its subject');
    const end = spec.indexOf('\n## ', start + 1);
    return spec.slice(start, end < 0 ? undefined : end).replace(/\s+/g, ' ');
  };

  test('the rule is in §4 beside the cross-vendor row, not only in the code that enforces it', () => {
    const table = additions();
    // The neighbour is asserted first: a §4 that had lost its other rows would satisfy the clauses
    // below over a table that no longer says anything else either.
    expect(table, '§4 no longer carries the cross-vendor row this one sits beside')
      .toContain('`cross_vendor: required` lint');
    expect(table, '§4 does not state that a step needs an id').toContain('an `id` on every step that is not a gate');
    expect(table, 'nor why — which is the half that keeps a reader from reading it as a style rule')
      .toContain('names a worktree branch, a loop counter and a run-history occurrence after it');
  });

  test('and both exemptions are stated there, because a rule with unstated exceptions is folklore', () => {
    const table = additions();
    expect(table, 'the gate exemption is not stated').toContain('A **gate** is the one exception');
    expect(table, "the fan-out template's exemption is not stated").toContain('`step:` template is exempt');
    expect(table, 'the stepless-flow rule is not stated').toContain('refuses a flow that declares no step at all');
  });

  test('and the status line records the change, as every edit to a numbered document must', () => {
    const text = repoFile('docs/02-sdlc-pipeline-spec.md');
    const start = text.indexOf('*Status:');
    expect(start, 'the spec has no status line').toBeGreaterThan(-1);
    const status = text.slice(start, text.indexOf('\n\n', start));
    expect(status, "the status line does not record this change").toContain('Q-0055');
    expect(status, 'nor carry the landing date').toContain('2026-09-08');
  });
});

describe('Q-0067 AC-13 — the documents say what a verified version is, and what it is not', () => {
  /** A document with its line breaks collapsed, because these files are hard-wrapped. */
  const flowed = (file: string): string => repoFile(file).replace(/\s+/g, ' ');

  /** The numbered documents this ticket edits, which therefore carry the claim and the date. */
  const EDITED = ['docs/03-adapter-contract.md', 'docs/04-architecture.md'];

  test('the glossary defines the term, its four states, and its decision', () => {
    // The shape Containment, Push lag, Event and Undecided already use.
    const glossary = flowed('docs/GLOSSARY.md');
    expect(glossary, 'the glossary does not define **Verified version**:').toContain('**Verified version**:');
    expect(glossary, 'it does not name where the string is recorded').toContain('verifiedVersion');
    expect(glossary, 'it does not say the comparison happens on every invocation and stores nothing')
      .toMatch(/every `quorum adapters --probe` invocation[\s\S]{0,120}nothing stored/);
    for (const state of ['as-verified', 'ahead', 'behind', 'indeterminate']) {
      expect(glossary, `it does not name the ${state} state`).toContain(`\`${state}\``);
    }
    expect(glossary, 'it does not cite the decision by title')
      .toContain('An adapter records the version it was verified against, and never a version it supports');
    expect(glossary, 'it does not cite the decision\'s date').toContain('2026-09-08');
  });

  test('and the "what it is not" half, each refusal asserted on its own', () => {
    // A list satisfied by naming one of them would let the others quietly go — and here that half is
    // the load-bearing one: the whole ticket is the difference between a record and a policy, so an
    // entry leaving room to read it as a supported range would reproduce the failure in the
    // vocabulary itself.
    const glossary = flowed('docs/GLOSSARY.md');
    expect(glossary, 'it does not refuse being read as a supported range').toMatch(/not a supported range/);
    expect(glossary, 'it does not refuse being read as a compatibility claim').toMatch(/not a compatibility claim/);
    expect(glossary, 'it does not distinguish itself from the login\'s own "verified"')
      .toMatch(/not a synonym for the `verified` a `--probe` login reports/);
    expect(glossary, 'it does not say the product never refuses on one')
      .toMatch(/no state changes an exit code or refuses a command/);
    // And the term list moves with it, which nothing else checks — the two vocabularies are compared
    // against each other above, so a term missing from BOTH would pass that comparison.
    expect(repoFile('docs/README.md')).toContain('push lag, verified version');
  });

  test('the adapter contract says its verification line is a record rather than a range', () => {
    // The sentence a contributor meets before they are tempted to bump the two numbers to whatever
    // their own machine happens to run, which is how a measurement becomes a guess.
    const contract = flowed('docs/03-adapter-contract.md');
    expect(contract, 'the document does not refuse the supported-range reading')
      .toMatch(/a record of what was measured, and never a supported range/);
    expect(contract, 'it does not say what bumping a number would claim')
      .toMatch(/re-ran the flag-by-flag verification/);
    expect(contract, 'it does not say the report refuses nothing')
      .toMatch(/never a refusal and never an exit code/);
  });

  test('and the status line of every numbered document this change edits records Q-0067', () => {
    for (const file of EDITED) {
      const text = repoFile(file);
      const start = text.indexOf('*Status:');
      expect(start, `${file} has no status line`).toBeGreaterThan(-1);
      const status = text.slice(start, text.indexOf('\n\n', start));
      expect(status, `${file}'s status line does not record this change`).toContain('Q-0067');
      expect(status, `${file}'s status line does not carry the landing date`).toContain('2026-09-08');
    }
  });
});

describe('Q-0039 AC-13 — the vocabulary says what a run lock is, and the four things it is not', () => {
  /** A document with its line breaks collapsed, because these files are hard-wrapped. */
  const flowed = (file: string): string => repoFile(file).replace(/\s+/g, ' ');

  /** The numbered document this ticket edits — the one that says what `core` enforces. */
  const EDITED = ['docs/04-architecture.md'];

  test('the glossary defines the term, its subject, its lifetime and its decision', () => {
    // The shape Containment, Push lag, Confinement and Verified version already use.
    const glossary = flowed('docs/GLOSSARY.md');
    expect(glossary, 'the glossary does not define **Run lock**:').toContain('**Run lock**:');
    expect(glossary, 'it does not name the file').toContain('.quorum/locks/<ticket-id>.json');
    expect(glossary, 'it does not say the subject is the ticket').toMatch(/subject is the ticket/);
    expect(glossary, 'it does not say how the claim is made').toMatch(/single exclusive create/);
    expect(glossary, 'it does not say when it is given back').toMatch(/`finally` covering every exit/);
    expect(glossary, 'it does not say a second run refuses rather than waiting')
      .toMatch(/refuses and names the holder; it never waits/);
    expect(glossary, 'it does not say a stale one is never reclaimed').toMatch(/never reclaimed automatically/);
    expect(glossary, 'it does not say what a dry run does').toMatch(/takes none and is refused by none/);
    expect(glossary, 'it does not cite the decision by title')
      .toContain('A run holds a lock on its ticket, and a stale one refuses rather than being reclaimed');
    expect(glossary, 'it does not cite the decision\'s date').toContain('2026-09-09');
  });

  test('and the release guarantee is bounded to what two syscalls deliver', () => {
    // The unqualified form — release happens only under this run's token, therefore a successor's
    // lock is safe — is what Q-0039 erratum E-1 narrowed and what `RunLock.release`'s own JSDoc now
    // bounds. A vocabulary entry promising more than the code delivers is the failure this
    // repository records most often, so the bound is pinned here rather than trusted to survive.
    const glossary = flowed('docs/GLOSSARY.md');
    expect(glossary, 'it does not say the check and the removal are two operations')
      .toMatch(/check and the removal are two syscalls, and the guarantee is bounded by that/);
    expect(glossary, 'it does not say which replacement survives and which is not protected')
      .toMatch(/already on disk when release begins survives, and one written between the check and the removal does not/);
    // Shown to refuse what the wording it replaces accepts, which is the `withoutIt` idiom above:
    // the sentence as it read before E-1 still satisfies the lifetime clause of the previous test
    // and neither clause of this one.
    const superseded =
      'given back in a `finally` covering every exit, and only while the file still carries the '
      + 'token the run wrote, so a lock a human cleared and a successor took is left alone.';
    expect(superseded.includes('`finally` covering every exit'), 'the superseded wording is not the lifetime sentence').toBe(true);
    expect(/removal are two syscalls/.test(superseded), 'this assertion does not refuse what the superseded wording accepts').toBe(false);
  });

  test('and the "what it is not" half, each refusal asserted on its own', () => {
    // A list satisfied by naming one of them would let the other three quietly go. Two of the four
    // are near-homographs already in this glossary, and the fourth is the one that matters most: an
    // advisory refusal read as a guarantee is a false safety claim, which is what the containment
    // and push-lag entries refuse in their own domains.
    const glossary = flowed('docs/GLOSSARY.md');
    expect(glossary, 'it does not distinguish itself from a gate').toMatch(/Not a \*\*gate\*\*/);
    expect(glossary, 'it does not distinguish itself from confinement').toMatch(/Not \*\*Confinement\*\*/);
    expect(glossary, 'it does not distinguish itself from containment').toMatch(/Not \*\*Containment\*\*/);
    expect(glossary, 'it does not say the refusal is advisory').toMatch(/And \*\*advisory\*\*/);
    expect(glossary, 'it does not say what the guarantee excludes')
      .toMatch(/not a second checkout, not `git`, not another tool, not a network filesystem/);
    // Shown to refuse what a weaker assertion accepts, which is the `withoutIt` idiom Q-0105 AC-13
    // introduced: a definition naming the term and its file and stopping there passes the clause
    // above it and none of these, and a paraphrase is exactly what this half exists to catch.
    const paraphrase = '**Run lock**: One file, `.quorum/locks/<ticket-id>.json`, that says a run holds this ticket.';
    expect(paraphrase.includes('**Run lock**:'), 'the weaker assertion does not pass over a paraphrase').toBe(true);
    expect(/Not a \*\*gate\*\*/.test(paraphrase), 'this assertion does not refuse what the weaker one accepts').toBe(false);
  });

  test('the architecture document states the rule and records the change', () => {
    // Principle 6 is where `core`'s enforced safety properties live, beside the worktree lifecycle
    // and the backlog store's boundary. Nothing automated covers what those two prose sentences say
    // beyond their presence: that half is verified by reading, and is stated rather than implied.
    const architecture = flowed('docs/04-architecture.md');
    expect(architecture, 'principle 6 does not state the rule').toContain('A ticket has one run at a time.');
    expect(architecture, 'it does not say where in the order the lock is taken')
      .toMatch(/before it reads the branch head, allocates a run directory or obtains a worktree/);
    expect(architecture, 'the run-history section does not name the second thing core writes')
      .toMatch(/second thing `core` writes under `\.quorum\/`, and it is not run history/);
    for (const file of EDITED) {
      const text = repoFile(file);
      const start = text.indexOf('*Status:');
      expect(start, `${file} has no status line`).toBeGreaterThan(-1);
      const status = text.slice(start, text.indexOf('\n\n', start));
      expect(status, `${file}'s status line does not record this change`).toContain('Q-0039');
      expect(status, `${file}'s status line does not carry the landing date`).toContain('2026-09-09');
    }
  });
});

describe('Q-0068 AC-6 / AC-14 — the documents quote the refusal the product prints, and say what a silent probe reports', () => {
  /** A document with its line breaks collapsed, because these files are hard-wrapped. */
  const flowed = (file: string): string => repoFile(file).replace(/\s+/g, ' ');

  /**
   * The BYOS refusal one adapter throws, read out of its source.
   *
   * Anchored on the guard's own line rather than on the first `new Error("…")` in the file, so a
   * refusal that moved or acquired a sibling fails here instead of being answered by a neighbouring
   * throw. Read as **text**: the dependency direction is `core → shared` and never the reverse
   * (04-architecture.md), which is the same read `events.test.ts` already makes of these two files.
   */
  const refusalIn = (vendor: string, guard: string): string => {
    const file = `packages/core/src/adapters/${vendor}.ts`;
    const found = new RegExp(`if \\(${guard}\\) throw new Error\\("(.+)"\\);`).exec(repoFile(file));
    if (!found) throw new Error(`${file} holds no BYOS refusal under \`${guard}\` — this check has lost its subject`);
    return found[1];
  };

  /**
   * One field's declared type, read out of `ProbeResult`'s verified branch.
   *
   * AC-14 pins the documented shape against `ProbeResult` rather than against a retyped literal, and
   * prose assertions cannot do that however many of them there are: three phrases inside
   * `docs/03-adapter-contract.md` only agree with each other, so narrowing `tokens` back to `number`
   * leaves the document promising a `null` the type refuses and every one of them green. Read as
   * **text**, for the reason {@link refusalIn} gives, out of a file this package's `test` task
   * already declares as an input from Q-0058.
   *
   * Scoped to the `ok: true` branch, because that is the answer this section of the document
   * describes; the union's other branch carries neither field, so a search across the whole
   * declaration would report an absence as a drift.
   */
  const probeResultField = (field: string): string => {
    const source = repoFile('packages/core/src/adapters/adapters.ts');
    const start = source.indexOf('export type ProbeResult =');
    const end = source.indexOf('ok: false;', start);
    if (start < 0 || end < 0) throw new Error('packages/core/src/adapters/adapters.ts declares no two-branch ProbeResult — this check has lost its subject');
    const found = new RegExp(`^\\s*${field}: (.+);$`, 'm').exec(source.slice(start, end));
    if (!found) throw new Error(`ProbeResult's verified branch declares no \`${field}\` — this check has lost its subject`);
    return found[1];
  };

  test('USAGE.md quotes the shipped sentence in full, product named rather than elided', () => {
    // The document carried `…runs on subscription OAuth only` — an ellipsis standing exactly where
    // the product's name goes, because the sentence it was quoting called the product a harness and
    // `product-boundaries.md` forbids writing that down. A workaround, not a convention: USAGE.md's
    // other three ellipses truncate a board row and two argument lists. With the sentence repaired
    // there is nothing left to elide, and the quotation is held to the source so the two cannot
    // drift apart again — editing either side alone turns this red.
    const refusal = refusalIn('claude', 'process\\.env\\.ANTHROPIC_API_KEY');
    expect(refusal, 'the refusal still calls the product a harness').not.toMatch(/harness/i);
    expect(repoFile('docs/USAGE.md'), 'USAGE.md does not quote the refusal as the terminal renders it')
      .toContain(`✗ claude: ${refusal}`);
    // The `✗ <vendor>: ` prefix is the renderer's, in `packages/cli/src/adapters.ts`, and quoting
    // the sentence without it would document something no terminal prints.
    expect(refusal.startsWith('✗'), 'the prefix belongs to the CLI and must not be inside core\'s sentence').toBe(false);
  });

  test('and the second vendor\'s refusal shares one tail with the first', () => {
    // Two sentences differing only in which variables they name, which is what makes the shared
    // half a term rather than two paraphrases of one.
    const claude = refusalIn('claude', 'process\\.env\\.ANTHROPIC_API_KEY');
    const codex = refusalIn('codex', 'process\\.env\\.CODEX_API_KEY \\|\\| process\\.env\\.OPENAI_API_KEY');
    const tail = ' is set — unset it; Quorum uses the CLI\'s subscription login only';
    expect(claude).toBe(`ANTHROPIC_API_KEY${tail}`);
    expect(codex).toBe(`CODEX_API_KEY/OPENAI_API_KEY${tail}`);
    // "subscription login" is the term `docs/03-adapter-contract.md` owns, which is why the sentence
    // uses it rather than coining a second spelling beside it
    // (`.claude/rules/docs-and-decisions.md`: never introduce a synonym for an existing term).
    expect(flowed('docs/03-adapter-contract.md'), 'the contract no longer owns the term this sentence borrows')
      .toContain('subscription login');
  });

  test('the adapter contract says what a probe reports when the vendor measured nothing', () => {
    // AC-14. `probeAdapter` answers `cost_usd: null` and `tokens: null` where no attempt reported a
    // measure, which is not a measured zero and is not a failed login — the two readings this
    // document has to refuse, because a contributor writing a third adapter reads it before they
    // invent a measurement to make a valid adapter pass.
    const contract = flowed('docs/03-adapter-contract.md');
    expect(contract, 'it does not say a successful probe may report no usage at all')
      .toMatch(/tokens.{0,80}null.{0,200}no usage/);
    expect(contract, 'it does not distinguish absence from a measured zero')
      .toMatch(/never rounded to zero/);
    expect(contract, 'it does not refuse reading missing usage as a failed login')
      .toMatch(/not a failed login/);
    // And the document is held to the type it describes, which the three clauses above cannot do:
    // they are self-consistent within one file. Both fields, because the paragraph states one rule
    // for the pair — a reader who trusted this document while `tokens` was `number` would be told a
    // valid adapter may report nothing by a product whose own type says it may not.
    for (const field of ['cost_usd', 'tokens']) {
      expect(probeResultField(field), `the contract says a silent probe reports \`${field}: null\`, which ProbeResult does not permit`)
        .toBe('number | null');
    }
  });

  test('and the status line of every numbered document this change edits records Q-0068', () => {
    for (const file of ['docs/03-adapter-contract.md']) {
      const text = repoFile(file);
      const start = text.indexOf('*Status:');
      expect(start, `${file} has no status line`).toBeGreaterThan(-1);
      const status = text.slice(start, text.indexOf('\n\n', start));
      expect(status, `${file}'s status line does not record this change`).toContain('Q-0068');
      expect(status, `${file}'s status line does not carry the landing date`).toContain('2026-09-10');
    }
  });
});

describe('Q-0115 AC-12 — the habit decision 088 ruled on is written down once, and only once', () => {
  /**
   * The rule about MEASURING, which is the half a decision entry deliberately does not carry.
   *
   * Decision 088 says so in as many words: the three failures that prompted it were not all `catch`
   * blocks — two were an author grepping for one token, finding nothing, and reading absence into it
   * — and it routes that half to `harness/rules.md`, adding that if it earns more than a sentence it
   * earns its own entry. So it is one sentence, and the second clause below is what keeps it one.
   *
   * `.claude/rules/engineering.md` is the DERIVED copy and is deliberately not compared here: it is
   * outside an implement step's write paths and its sync is the human's, per *"`.claude/rules/` is a
   * derived copy, not a surface a requirement may name"* (2026-08-27). Nothing in `packages/`
   * compares the two, which is a real gap and this ticket's gate obligation rather than its code.
   */
  const RULES = 'harness/rules.md';

  /** Every top-level rule by its opening — the identity an edit to an existing one would move. */
  const rulesIn = (): string[] => repoFile(RULES).split('\n')
    .filter((line) => line.startsWith('- ')).map((line) => line.slice(0, 58));

  test('the sentence is there, cites the entry by title and date, and names no file name or number', () => {
    // Unwrapped first, as every sentence-level check in this file is: `harness/rules.md` is
    // soft-wrapped, so the title spans two lines and a raw `toContain` finds neither half — the
    // failure Q-0050's own transcription scan recorded, and the one this clause hit while it was
    // being written.
    const text = repoFile(RULES).replace(/\s+/g, ' ');
    expect(text, 'the habit rule is not stated')
      .toContain('A search, grep or probe that failed to look is not a measurement that found nothing');
    expect(text, 'the entry is not cited by title').toContain('A probe that could not answer is not a negative');
    expect(text, 'nor by date, which is the other half of how an entry is cited').toContain('(2026-09-10)');
    expect(text, 'an entry is never cited by its file name').not.toContain('088-a-probe');
    expect(text, 'nor by its number').not.toMatch(/decisions? entry 088|decision 088/);
  });

  test('and it is ONE rule, added to a list nothing else moved in', () => {
    // "One sentence and no more" is the criterion, so a register is what makes it checkable in both
    // directions: a second bullet on this subject fails here, and so does an edit to any of the
    // twenty-six rules that were already written. Ordered, because a rule that moved between
    // sections is the same drift as one reworded.
    //
    // The bound, stated rather than left to be found: an identity is a rule's OPENING, so a rewrite
    // of a rule's later sentences is invisible to this. That is the trade `git.source.test.ts`'s
    // export register already makes — enough to catch a rule replaced, removed or reordered, and
    // not a byte pin on a living document.
    expect(rulesIn()).toStrictEqual([
      '- TypeScript strict. No `any`. No `@ts-ignore` without a o',
      '- Every behaviour change ships with a test. The mock-adapt',
      '- **Your worktree has no dependencies until you install th',
      "- **A test's verdict is a property of the commit, not of t",
      '- **A search, grep or probe that failed to look is not a m',
      '- **No deprecated API.** A symbol a dependency marks `@dep',
      '- Prefer small, boring, proven libraries. A new dependency',
      '- Conventional commits with the ticket id in the subject: ',
      '- **JSDoc, not line comments.** A module, exported symbol,',
      '- **Code that needs explaining is written wrong.** Fix the',
      '- **The one thing code cannot carry is why it is deliberat',
      '- **Never restate `docs/DECISIONS.md` or a ticket body in ',
      '- Files are the database. Anything persistent is a file in',
      '- One trace and event format lives in `packages/shared`. A',
      '- Vendor-specific knowledge lives in the adapter and nowhe',
      '- Safety is enforced in `core`, never in the UI and never ',
      '- Errors are explicit. Invalid structured output is saved ',
      '- **Never add an API-key path**, including in tests, fixtu',
      "- **Never write to the user's working tree from a flow.** ",
      '- Quorum is product-agnostic. No reference to any specific',
      '- Flows are YAML files in the project. The UI edits files ',
      '- Human-gated by default; `auto` is opt-in per gate; `huma',
      '- Keep the cold-clone test in mind: a feature that lengthe',
      '- The decisions are append-only. Each is one file in `docs',
      "- **An entry's date is the date it takes its place in the ",
      '- `docs/GLOSSARY.md` is the vocabulary. Add a term there b',
      '- When code and docs disagree, the docs are wrong until a ',
    ]);
    // And the register moved rather than being widened: the list without this ticket's rule is
    // refused, which is the demonstration `git.source.test.ts:47` writes for its own.
    expect(rulesIn(), 'the new rule is not in the register, so the list above was edited to fit')
      .not.toStrictEqual(rulesIn().filter((rule) => !rule.includes('A search, grep or probe')));
  });
});

describe('Q-0013 GO-3 — the architecture document describes the run host that shipped', () => {
  /**
   * §`packages/server`, sliced out rather than searched for across the whole document.
   *
   * A sentence elsewhere on the page must not satisfy a claim about what this section says — a live
   * hazard here, principle 2 stating the stream's own rules two hundred lines above it.
   */
  const section = (): string => {
    const text = repoFile('docs/04-architecture.md');
    const start = text.indexOf('### `packages/server`');
    if (start < 0) throw new Error('docs/04-architecture.md has no packages/server section — this check has lost its subject');
    const end = text.indexOf('\n### ', start + 1);
    return text.slice(start, end < 0 ? undefined : end).replace(/\s+/g, ' ');
  };

  test('it says what exists, in the terms a later child would otherwise re-decide', () => {
    // One assertion per CLAIM rather than per noun. A word list is satisfied by a document stating
    // the opposite — the lesson decision 065 exists for, where two statements of 062 were false
    // while every word in them was the right word.
    const server = section();
    expect(server, 'it does not say the package is a library rather than a process')
      .toMatch(/opens no socket, installs no process signal handler and never exits the process/);
    expect(server, 'it does not name the transport and the read-only surface as separate children')
      .toMatch(/Q-0118[\s\S]{0,400}Q-0119|Q-0119[\s\S]{0,400}Q-0118/);
    expect(server, "it does not say the run id is the host's and core's is correlated onto it")
      .toMatch(/named by an id the host mints, and `core`'s run number is correlated onto it/);
    expect(server, 'it does not say a refused start reports no run number')
      .toMatch(/reports no run number at all rather than a plausible wrong one/);
    expect(server, "it does not say why waiting for core's number could not have worked")
      .toMatch(/that allocator reserves nothing/);
    expect(server, 'it does not say a start waits for the run to be under way')
      .toMatch(/evaluated on the first pull/);
    expect(server, "it does not say the fan-out is the host's because the stream is single-consumer")
      .toMatch(/fan-out belongs to the host because the stream is single-consumer/);
    expect(server, 'it does not say a truncation notice travels beside the stream')
      .toMatch(/beside the stream rather than inside it/);
    expect(server, 'it does not say the host supplies an answer channel for every run it starts')
      .toMatch(/supplies\s+`answerGate` for every run it starts/);
    expect(server, 'it does not say there is no default answer and no timeout')
      .toMatch(/no default answer and no timeout/);
    expect(server, 'it does not say what `:id` in the routes names')
      .toMatch(/minted id is what `:id` names in the routes below/);
    expect(server, 'it does not say shutdown closes the host to new starts')
      .toMatch(/closes the host to new starts/);
    expect(server, 'it does not say why a start in flight is not yet a running run')
      .toMatch(/a start in flight is not yet a running run/);
  });

  test('and the route clause the code refuses is corrected rather than left promising it', () => {
    // `gateAnswerEnvelopeSchema` is `.strict()` over three and `askGate` raises on anything else, so
    // the document is what moves — a decision entry outranks a numbered document. The vocabulary is
    // read out of this package's own schema rather than from a literal here, so an envelope that is
    // ever widened makes this the place the two are reconciled rather than a pin that silently rots.
    const server = section();
    expect(server, 'the section still promises an override the envelope refuses')
      .not.toMatch(/gate` \(advance\/retry\/override with reason\)/);
    expect(server, 'it does not record who owns widening the envelope').toMatch(/Q-0016/);
    expect(server, 'it does not cite the entry that closed the answer set')
      .toContain("What a run's event stream carries, and how a gate answer travels back");
    for (const answer of gateAnswerSchema.options) {
      expect(server, `the section does not name the answer ${answer}`).toContain(answer);
    }
    expect(gateAnswerSchema.options, 'the answer set is no longer the closed three this clause rests on')
      .toStrictEqual(['advance', 'retry', 'abort']);
  });

  test('and the status line records the change', () => {
    const text = repoFile('docs/04-architecture.md');
    const start = text.indexOf('*Status:');
    expect(start, 'docs/04-architecture.md has no status line').toBeGreaterThan(-1);
    const status = text.slice(start, text.indexOf('\n\n', start));
    expect(status, 'the status line does not record this change').toContain('Q-0013');
    expect(status, 'the status line does not carry the landing date').toContain('2026-09-11');
  });

  test('the slice has a subject, and stops where the section does', () => {
    // Anti-vacuity: a slice running to the end of the document would carry `packages/cli`'s and
    // principle 2's sentences and satisfy several clauses above without this section saying
    // anything. Shown by naming what belongs to the next section and must not be in this one.
    expect(section().length, 'the section is implausibly short').toBeGreaterThan(1000);
    expect(section(), 'the slice ran past the end of the section').not.toContain('Same commands as the spike');
  });
});

describe('Q-0014 AC-11 — the architecture document describes the shell that shipped', () => {
  /**
   * §`apps/web`, sliced out rather than searched for across the whole document.
   *
   * The reason is the one the `packages/server` block above gives, and it is sharper here: this
   * page's package map and its status line both name `apps/web`, so a whole-document search would
   * be satisfied by a sentence written in August about an app that did not exist.
   *
   * **The two anchors are here rather than in an `apps/web` test**, which is measured rather than
   * stylistic: this package's `test` task already declares `docs/04-architecture.md` as an input,
   * where an `apps/web` test reading a repository file would earn that package its first
   * `turbo.json` and a `turbo-inputs.test.ts` registration for one assertion. Nothing here asserts
   * the prose beyond those anchors — a document held against its own paraphrase is a check with no
   * subject.
   *
   * The slice ends at the next `##` rather than the next `###`, because `apps/web` is the last
   * `###` on the page and a `###` search would run to the end of the document.
   */
  const section = (): string => {
    const text = repoFile('docs/04-architecture.md');
    const start = text.indexOf('### `apps/web`');
    if (start < 0) throw new Error('docs/04-architecture.md has no apps/web section — this check has lost its subject');
    const end = text.indexOf('\n## ', start + 1);
    return text.slice(start, end < 0 ? undefined : end).replace(/\s+/g, ' ');
  };

  test('the section names the register the shell ships, by the term it ships under', () => {
    // One anchor, and it is the load-bearing one: the rail, the router and every placeholder are
    // built FROM that table, so a document describing the shell without it is describing a
    // different design. Named by the term the code uses, so the two cannot drift into separate
    // vocabularies — which is `docs-and-decisions.md`'s no-synonyms rule at the smallest scale.
    expect(section(), 'the section does not name the route register').toMatch(/route register/i);
  });

  test('and the status line records the change', () => {
    const text = repoFile('docs/04-architecture.md');
    const start = text.indexOf('*Status:');
    expect(start, 'docs/04-architecture.md has no status line').toBeGreaterThan(-1);
    const status = text.slice(start, text.indexOf('\n\n', start));
    expect(status, 'the status line does not record this change').toContain('Q-0014');
    expect(status, 'the status line does not carry the landing date').toContain('2026-09-11');
  });

  test('the slice has a subject, and stops where the section does', () => {
    // Anti-vacuity, in the shape the block above uses: a slice running past the section would carry
    // §Adapters and satisfy a clause without this section saying anything at all.
    expect(section().length, 'the section is implausibly short').toBeGreaterThan(1000);
    expect(section(), 'the slice ran past the end of the section').not.toContain('is the first community milestone');
  });

  test('Q-0130 AC-14 — and it says this app starts and stops a run, not that it cannot', () => {
    // **Three claims went false at once and the negatives are asserted beside the positives**, in
    // the shape the Q-0122 clause below uses: what a document of this kind gets wrong is not the new
    // sentence but the old one nobody re-read. §`apps/web` said the gate screen was where this app
    // stopped being read-only, that its one write was the gate route, and that nothing starts a run
    // from mission control — all three true when they were written and all three false now.
    const text = section();
    expect(text, 'the section still says the gate screen is where this app stops being read-only')
      .not.toMatch(/and the gate screen is where this app stops being read-only/);
    expect(text, 'the section still says the gate answer is the one write')
      .not.toMatch(/\*\*The one write is `POST \/runs\/:id\/gate`/);
    expect(text, 'the section still says nothing starts a run from mission control')
      .not.toMatch(/\*\*Nothing starts a run from here\*\*/);
    expect(text, 'the section still says the write register is unmoved')
      .not.toMatch(/`WRITE_RULES` register is unmoved by this ticket/);
    // The positives, and they are the clauses a later edit is most likely to trim: WHERE the start
    // is and why, that it names every consuming flow, the two fields it will not send, and that the
    // request shape is declared once in the vocabulary package.
    expect(text, 'the section does not say where a run is started').toMatch(/ticket page starts one/);
    expect(text, 'the section does not say why it is not on a board card').toMatch(/not on a board card/);
    expect(text, 'the section does not say every consuming flow is named').toMatch(/never one/);
    expect(text, 'the section does not say which fields the browser will not send')
      .toMatch(/never `auto` and never `base`/);
    expect(text, 'the section does not name the shared request shape').toContain('wireStartRequestSchema');
    expect(text, 'the section does not say the write register moved by one permission')
      .toMatch(/one permission/);
    // The negatives have subjects: the same needles find the superseded wording where it is written.
    const asItWas = '**Since Q-0015 five of those screens exist — the backlog board, the ticket page, the gate screen, the runs landing and mission control — and the gate screen is where this app stops being read-only.** **The one write is `POST /runs/:id/gate`, and the boundary narrowed by name.** **Nothing starts a run from here**: `host.start` has one production caller, and the read-only guard\'s `WRITE_RULES` register is unmoved by this ticket.';
    for (const needle of [
      /and the gate screen is where this app stops being read-only/,
      /\*\*The one write is `POST \/runs\/:id\/gate`/,
      /\*\*Nothing starts a run from here\*\*/,
      /`WRITE_RULES` register is unmoved by this ticket/,
    ]) {
      expect(needle.test(asItWas), `the fixture no longer reproduces ${String(needle)}`).toBe(true);
    }
  });

  test('Q-0135 — and it says all four header values are on the screen, not that two are not', () => {
    // **The negative is asserted beside the positive**, in the shape the two clauses around this one
    // use: what a document of this kind gets wrong is not the new sentence but the old one nobody
    // re-read. §`apps/web` said *"Two of the four values … are still not on this wire and the screen
    // says so rather than showing them"*, and gave a reason per value — no event carries a timestamp,
    // and cost crosses only inside a message composed for a human. Both were true of the WIRE when
    // they were written and both describe a premise this ticket removed rather than contradicted:
    // the figures are read from a route, and no event gained anything.
    const text = section();
    expect(text, 'the section still says two of the four header values are not on this wire')
      .not.toMatch(/Two of the four values/);
    expect(text, 'the section still gives the retired reason for the elapsed figure')
      .not.toMatch(/no event carries a timestamp so there is no elapsed time to compute/);
    expect(text, 'the section still says cost crosses only inside a message')
      .not.toMatch(/cost crosses only inside a message composed for a human/);
    // The positives, and they are the clauses a later edit is likeliest to trim: WHERE the figures
    // come from, that the two behave differently, what stops the advancing one, and the two rules a
    // cost rendering is under.
    expect(text, 'the section does not say where the two figures are read from').toContain('GET /history/:id');
    expect(text, 'the section does not say the two values behave differently')
      .toMatch(/elapsed advances from `manifest\.started_at`/);
    expect(text, 'the section does not say what stops the advancing figure')
      .toMatch(/whichever authority speaks first/);
    expect(text, 'the section does not say the frozen figure is the engine\'s own')
      .toContain('manifest.duration_ms');
    expect(text, 'the section does not say no figure is summed across vendors')
      .toMatch(/No figure is summed across vendors/);
    expect(text, 'the section does not say the wire carries whether a run is a dry walk')
      .toMatch(/`WireRun` gains `dry`/);
    // The negatives have subjects: the same needles find the superseded wording where it is written,
    // so this clause refuses a sentence rather than matching nothing.
    const asItWas = "**Two of the four values `docs/05-design-prompt.md` screen 5 puts in the header are still not on this wire and the screen says so rather than showing them**: no event carries a timestamp so there is no elapsed time to compute, and cost crosses only inside a message composed for a human — which is **Q-0135**'s.";
    for (const needle of [
      /Two of the four values/,
      /no event carries a timestamp so there is no elapsed time to compute/,
      /cost crosses only inside a message composed for a human/,
    ]) {
      expect(needle.test(asItWas), `the fixture no longer reproduces ${String(needle)}`).toBe(true);
    }
  });

  test('Q-0122 AC-8 — and it says the app emits, rather than that it emits nothing', () => {
    // **The clause held the opposite until 2026-09-12, and that is why it is a clause rather than a
    // correction.** This section read *"The app emits nothing: it declares no `build` script, so
    // the three emitting packages are still three"* — true when Q-0014 wrote it and false the
    // moment `apps/web` declared one. What a document of this kind gets wrong is not the new
    // sentence but the old one nobody re-read, so the negative is asserted beside the positive:
    // a later edit restoring the previous wording fails here by name.
    const text = section();
    expect(text, 'the section still says the app emits nothing').not.toMatch(/[Tt]he app emits nothing/);
    expect(text, 'the section still says the emitting set is three').not.toMatch(/three emitting packages are still three/);
    expect(text, 'the section does not say the app emits').toMatch(/[Tt]he app emits/);
    // And the two halves the entry rules, which are what stop *"emits"* being read as *"ships"*:
    // the emitting set is four, the distribution set is three, and this package is in one of them.
    expect(text, 'the section does not name the build script the app declares').toContain('vite build');
    expect(text, 'the section does not say the output is served rather than shipped').toMatch(/served rather than shipped/);
    expect(text, 'the section does not cite the entry that ruled it').toContain('2026-09-12');
    // The negatives have a subject: the same needles find the superseded wording where it is
    // written, so this clause is refusing a sentence rather than matching nothing.
    const asItWas = 'All connection data remains in memory. **The app emits nothing**: it declares no `build` script, so the three emitting packages are still three,';
    expect(asItWas, 'the fixture no longer reproduces the wording this clause refuses')
      .toMatch(/[Tt]he app emits nothing/);
    expect(asItWas).toMatch(/three emitting packages are still three/);
  });
});

describe('Q-0125 AC-10 and AC-11 — the architecture document says the daemon emits, and states what actually protects the browser', () => {
  /**
   * §`packages/server`, sliced out rather than searched for — the reason the two blocks above give,
   * and it is live here twice over: the status line names this package and so does the package map.
   */
  const section = (): string => {
    const text = repoFile('docs/04-architecture.md');
    const start = text.indexOf('### `packages/server`');
    if (start < 0) throw new Error('docs/04-architecture.md has no packages/server section — this check has lost its subject');
    const end = text.indexOf('\n### ', start + 1);
    return text.slice(start, end < 0 ? undefined : end).replace(/\s+/g, ' ');
  };

  test('AC-10 — it says the package emits, rather than that it emits nothing', () => {
    // **The clause held the opposite until Q-0125, which is why the negative is asserted beside the
    // positive.** This section read *"it emits nothing: the local distribution set is three
    // packages"* — one sentence conflating the two registers, true of both while the package was in
    // neither, and false of both the moment it entered one. What a document of this kind gets wrong
    // is not the new sentence but the old one nobody re-read.
    const text = section();
    expect(text, 'the section still says the package emits nothing').not.toMatch(/it emits nothing/);
    expect(text, 'the section does not say the package publishes an exports map')
      .toMatch(/publishes that API through a conditional `exports` map/);
    expect(text, 'the section does not say it emits the artifact the default condition names')
      .toMatch(/emits the artifact the map's default condition names/);
    expect(text, 'the section does not cite the entry that ruled it')
      .toContain('A fifth package emits, and `resolved` is not a synonym for `distributed`');
  });

  test('Q-0124 — and it says the two sets are the same size again, without saying they are one question', () => {
    // **This clause asserted the opposite until Q-0124 and the inversion is the point.** It required
    // *"the distribution set stays three"* and *"a packed CLI importing it would be broken"*, which
    // were the two consequences of the split; that ticket packs the daemon, so both
    // sentences are false and the section states what replaced them. The reason the emit is owed at
    // all is unchanged and is still asserted, because no landed entry had it before Q-0125 — a
    // workspace-internal consumer running outside the workspace's own conditions.
    const text = section();
    expect(text, 'the section does not say the emitting set is five').toMatch(/emitting set is five/);
    expect(text, 'the section does not say the distribution set is five too')
      .toMatch(/local distribution set is five/);
    expect(text, 'the section still says the distribution set stays three')
      .not.toMatch(/distribution set stays three/);
    expect(text, 'the section still says a packed CLI importing it would be broken')
      .not.toMatch(/a packed `@quorum\/cli` importing it would be broken/);
    expect(text, 'the section does not say a tarball carries it').toMatch(/A tarball carries\s+this package now/);
    // **And it keeps *distributed* apart from *published***, which is the clause most likely to be
    // dropped as redundant and the one decision 096 gives its own paragraph: five tarballs move
    // nothing about registry resolution, which 078(d) still refuses.
    expect(text, 'the section does not say what distributed means here').toMatch(/never publication/);
    expect(text, 'the section does not name where publication still stands').toContain('Q-0029');
    expect(text, 'the section does not say why the emit is owed when nothing outside consumes the package')
      .toMatch(/workspace-internal consumer running outside the workspace's own\s*\*\*? ?conditions|workspace-internal consumer running outside the workspace's own conditions/);
    // The two negatives have subjects, in the shape this file's other blocks use: the same needles
    // find the superseded wording where it is written.
    // The scope is assembled rather than written, because `index.test.ts` forbids the workspace
    // scope anywhere under `src/`, this file included — the same rule every needle here follows.
    const asItWas = `the emitting set is five and the local distribution set stays three, so no tarball carries this package and a packed \`@${'quorum'}/cli\` importing it would be broken`;
    expect(asItWas, 'the fixture no longer reproduces the first wording this clause refuses')
      .toMatch(/distribution set stays three/);
    expect(asItWas, 'the fixture no longer reproduces the second wording this clause refuses')
      .toMatch(/a packed `@quorum\/cli` importing it would be broken/);
  });

  test('AC-11 — nothing gives "no exports map" as the reason a browser cannot import the daemon', () => {
    // **The premise moved and the conclusion did not.** This said the app *"cannot import"* the
    // daemon package *"at all: it has no `exports` map … where a guard is weaker than an
    // impossibility"*, and Q-0125 removes the impossibility. Deleting premise and conclusion
    // together would leave the page silent about a real hazard, so the sentence states the weaker,
    // true thing instead: a dependency edge is what a link needs, and `apps/web`'s own manifest
    // register refuses one in both directions. Decision 093 clause 5 records that the remedy first
    // reached for — extending the browser-safety scan — is unnecessary for exactly that reason.
    const text = section();
    expect(text, 'the section still gives "no exports map" as the reason').not.toMatch(/it has no `exports` map/);
    expect(text, 'the section no longer says a browser may not import the daemon')
      .toMatch(/`apps\/web` must not import `@quorum\/server`/);
    expect(text, 'the section does not name the register that actually refuses the dependency')
      .toContain('apps/web/test/package.test.ts');
    expect(text, 'the section does not say that register holds in both directions').toMatch(/both directions/);
  });

  test('AC-11 — and §`apps/web` stops giving the same dead reason for the same arrangement', () => {
    // The second site, which carries the premise in different words: *"without giving the server
    // package a browser-facing export surface"*. Sliced separately, because a clause satisfied by
    // the `packages/server` section would not be about this one.
    const whole = repoFile('docs/04-architecture.md');
    const start = whole.indexOf('### `apps/web`');
    expect(start, 'docs/04-architecture.md has no apps/web section — this check has lost its subject').toBeGreaterThan(-1);
    const end = whole.indexOf('\n## ', start + 1);
    const web = whole.slice(start, end < 0 ? undefined : end).replace(/\s+/g, ' ');
    expect(web.length, 'the section is implausibly short').toBeGreaterThan(1000);
    expect(web, 'the app section still gives the dead reason')
      .not.toMatch(/without giving the server package a browser-facing export surface/);
    expect(web, 'the app section no longer says why the frame union lives in the vocabulary package')
      .toMatch(/without either end declaring a dependency on the other/);
  });

  test('and all three negatives have subjects — the same needles find the superseded wording', () => {
    // Anti-vacuity, in the shape the Q-0122 AC-8 block above uses: a clause refusing a sentence is
    // indistinguishable from one that matches nothing until it is shown finding it.
    // **The fixtures name no package, and that is a constraint of this file rather than a choice.**
    // `index.test.ts` forbids the workspace scope anywhere under `src/`, tests included, and
    // assembles its own needle so the guard covers itself — so a fixture here reproduces the clause
    // that moved and elides the package names around it. Each still carries the needle it is shown
    // against, which is all an anti-vacuity fixture has to do.
    const impossibility = 'cannot import it at all: it has no `exports` map, and a value import from a browser bundle would pull Node builtins in with it, where a guard is weaker than an impossibility.';
    expect(impossibility, 'the fixture no longer reproduces the wording AC-11 refuses').toMatch(/it has no `exports` map/);
    const emitsNothing = 'It declares the two workspace dependencies and no external dependency, and it emits nothing: the local distribution set is three packages.';
    expect(emitsNothing, 'the fixture no longer reproduces the wording AC-10 refuses').toMatch(/it emits nothing/);
    const surface = '`packages/server` imports and re-exports it so the server and browser share that contract without giving the server package a browser-facing export surface.';
    expect(surface, 'the fixture no longer reproduces the wording the apps/web clause refuses')
      .toMatch(/without giving the server package a browser-facing export surface/);
  });

  test('the slice has a subject, and stops where the section does', () => {
    // Anti-vacuity: a slice running to the end of the document would carry `packages/cli`'s prose
    // and the status line, and satisfy several clauses above without this section saying anything.
    expect(section().length, 'the section is implausibly short').toBeGreaterThan(1000);
    expect(section(), 'the slice ran past the end of the section').not.toContain('Same commands as the spike');
    expect(section(), 'the slice ran back into the status line').not.toContain('*Status:');
  });

  test('and the status line records the change', () => {
    const text = repoFile('docs/04-architecture.md');
    const start = text.indexOf('*Status:');
    expect(start, 'docs/04-architecture.md has no status line').toBeGreaterThan(-1);
    const status = text.slice(start, text.indexOf('\n\n', start));
    expect(status, 'the status line does not record this change').toContain('Q-0125');
    expect(status, 'the status line does not carry the landing date').toContain('2026-09-12');
  });
});

describe('Q-0125 AC-12 — every count-bearing sentence in the documents is classified, and no live one says four', () => {
  /**
   * The documentation half of AC-12's register. The source half is `packages/cli/src/build.test.ts`'s.
   *
   * **Two registers because there are two owners, and that is Q-0072's rule rather than a
   * preference.** A task's cache hit may only claim that nothing it *reads* has changed, so a
   * register belongs in the package whose task already hashes its subjects. This package's own
   * `test` task
   * declares the two documents below and the decision folder; it declares neither the per-package
   * source glob nor the per-package build-configuration glob, so asserting a comment in
   * `packages/cli` or `packages/core` from here would be a read `turbo-inputs.test.ts` refuses —
   * correctly, because a cached pass would then stand over an edited comment. The four source sites
   * are therefore asserted where they are hashed. (The two globs are described rather than spelled:
   * a glob's separator closes a JSDoc block, which is what this paragraph did on its first draft.)
   *
   * **This is the only criterion of Q-0125 whose subject no existing guard reaches**, which is why
   * it asserts rather than waits, and the measurement is worth keeping: the Q-0122 AC-8 slice above
   * asserts `vite build`, *"served rather than shipped"* and a date and **no number**; the Q-0098
   * glossary slice asserts that both terms are defined, that the entry is cited and that the
   * no-synonym clauses hold, and **no number**; the Q-0013 GO-3 slice asserts six claims about the
   * run host and none about emission. Every count site could have stayed at four with the whole
   * suite green.
   */
  const LIVE: [string, RegExp][] = [
    // **Two count sentences in this document and each needs a needle only it can satisfy**, which
    // the pair below is: the **Shape** paragraph breaks its line inside the claim and the cache-hit
    // paragraph does not, so neither regex can be satisfied by the other's site. An alternation
    // spanning both would have let one site go stale while the other kept the clause green.
    ['docs/04-architecture.md', /`pnpm pack` in each of the five \*\*distribution\*\*/],
    ['docs/04-architecture.md', /\*\*Five\npackages emit and five are packed\*\*/],
    ['docs/04-architecture.md', /The five packages that emit are named under/],
    ['docs/04-architecture.md', /\*\*Five packages emit and five are packed\*\*/],
    ['docs/GLOSSARY.md', /five packages that emit/],
    ['docs/GLOSSARY.md', /The \*\*emitting set\*\* is five/],
    ['docs/GLOSSARY.md', /the \*\*local distribution set\*\* is the same five/],
  ];

  /**
   * The spellings a live site may no longer carry, asserted over the same two documents.
   *
   * An omission and a blanket replacement therefore fail differently: a site left at four fails
   * {@link LIVE}, and a historical sentence rewritten fails {@link HISTORICAL}. That pairing is R-7 —
   * the cheapest wrong implementation of this criterion is a find-and-replace over the word "four".
   */
  const SUPERSEDED: [string, RegExp][] = [
    ['docs/04-architecture.md', /four\npackages emit and three are packed|four packages emit and three are packed/],
    ['docs/04-architecture.md', /The four packages that emit are named under/],
    ['docs/04-architecture.md', /\*\*Four packages emit and three are packed\*\*/],
    ['docs/04-architecture.md', /the emitting set is four where the local distribution set stays three/],
    ['docs/GLOSSARY.md', /four packages that emit/],
    ['docs/GLOSSARY.md', /The \*\*emitting set\*\* is four/],
    ['docs/GLOSSARY.md', / is the difference: it emits and is not distributed/],
    ['docs/GLOSSARY.md', /none of the three is bundled/],
    // Q-0124's own five. The counts that were true from 2026-09-12 to 2026-09-15, and the sentences
    // that gave the split as a live fact rather than as a past one. They are the likeliest thing a
    // careless edit leaves behind, precisely because they were right three days ago.
    ['docs/04-architecture.md', /in each of the three \*\*distribution\*\*/],
    ['docs/04-architecture.md', /five\npackages emit and three are packed/],
    ['docs/04-architecture.md', /\*\*Five packages emit and three are packed\*\*/],
    // Narrowed to the clause the section carried rather than to the words alone: the **status
    // line**'s record of what Q-0125 did ends *"the local distribution set stays three."* and is
    // HISTORICAL — a needle that matched it would demand the page rewrite its own account of a past
    // ticket, which is the blanket replacement this pairing exists to refuse.
    ['docs/04-architecture.md', /local distribution set stays three, so no tarball carries/],
    ['docs/GLOSSARY.md', /the \*\*local distribution set\*\* is the first\s+three/],
  ];

  /**
   * Sentences about what a PAST ticket did, which stay exactly as they are.
   *
   * A decision entry is append-only and is not edited at all; the rest describe what Q-0122 changed
   * and stay true of Q-0122 — the same reasoning that keeps *"seeded from the spike"* on a page
   * whose spike has gone.
   */
  const HISTORICAL: [string, RegExp][] = [
    ['docs/decisions/092-a-fourth-package-emits-and-what-it-emits-is-served.md', /the emitting set is four and the local distribution set/],
    ['docs/04-architecture.md', /2026-09-12 \(Q-0122\)/],
    ['docs/GLOSSARY.md', /which took it from three packages to four/],
    // Q-0124's addition, and the one that makes the SUPERSEDED needle above narrow rather than
    // careless: the status line's account of Q-0125 states the split as that ticket left it, which
    // stays exactly as it is. A find-and-replace over "stays three" fails here.
    ['docs/04-architecture.md', /the emitting set is five and the local distribution set stays three\./],
    ['docs/decisions/093-a-fifth-package-emits-and-resolved-is-not-distributed.md', /resolved and not distributed/],
  ];

  /** The whitespace-flattened read this block's prose clauses use, as the blocks above define it. */
  const flowed = (file: string): string => repoFile(file).replace(/\s+/g, ' ');

  test('every live site states the count the register derives, and none states the superseded one', () => {
    for (const [file, needle] of LIVE) {
      expect(repoFile(file), `${file} does not carry ${String(needle)}`).toMatch(needle);
    }
    for (const [file, needle] of SUPERSEDED) {
      expect(repoFile(file), `${file} still carries the superseded ${String(needle)}`).not.toMatch(needle);
    }
  });

  test('and every historical sentence is left alone, so a blanket replacement fails as loudly as an omission', () => {
    for (const [file, needle] of HISTORICAL) {
      expect(repoFile(file), `${file}'s record of what a past ticket did was rewritten`).toMatch(needle);
    }
  });

  test('the negatives have subjects — every superseded needle finds the wording it refuses', () => {
    // The same needles run against a fixture reproducing the superseded wording, so a clause that
    // matched nothing is distinguishable from one that refused something. The fixture is the text as
    // it stood on `main` before this ticket.
    const asItWas = [
      'true when `apps/web` gained a build task. Four rather than: four',
      'packages emit and three are packed, so naming the packed set by the emitting set\'s name',
      'The four packages that emit are named under **Testing strategy**, of which this serves one.',
      '**Four packages emit and three are packed**, which since 2026-09-12 are two different sets',
      'the emitting set is four where the local distribution set stays three, and `packages/server` serves',
      'declared once in the root `turbo.json` and run in the four packages that emit. It is the',
      'The **emitting set** is four — the vocabulary package, the engine,',
      'The browser app is the difference: it emits and is not distributed, staying `private: true`',
      'A **resolved** emitted artifact is not a "bundle" — none of the three is bundled, each source',
      // Q-0124's five, reproducing the text as it stood on `main` before this ticket — including the
      // line break the **Shape** paragraph puts inside its own claim, which is what the needle for
      // that site is anchored on.
      'The **locally packed** path is supported and tested: `pnpm pack` in each of the three **distribution**',
      'packages and an install of the three tarballs together into a project outside the repository. Three',
      'rather than *"the three emitting packages"*, which is what this sentence said until 2026-09-12: **five',
      'packages emit and three are packed**, so naming the packed set by the emitting set\'s name stopped',
      '**Five packages emit and three are packed**, which since 2026-09-12 are two different sets',
      'the emitting set is five and the local distribution set stays three, so no tarball carries',
      'and the **local distribution set** is the first\nthree, what a `pnpm pack` of this repository produces',
    ].join('\n');
    for (const [, needle] of SUPERSEDED) {
      expect(asItWas, `the fixture no longer reproduces ${String(needle)}`).toMatch(needle);
    }
  });

  test('the glossary defines `resolved` by what Node does rather than by the set it used to coincide with', () => {
    // **The half that is a term rather than a count**, and the reason an entry was owed at all.
    // 092 could write *"the resolved emit of the three distribution packages"* because every
    // resolved emit happened to be packed; the daemon package makes that a coincidence of one
    // particular day. A vocabulary that names a shape by a set it merely coincides with goes false
    // again at the next emitter, so the repair is to define the shape by the mechanism.
    const glossary = flowed('docs/GLOSSARY.md');
    expect(glossary, 'the glossary still identifies the resolved shape by the distribution set')
      .not.toMatch(/the \*\*resolved\*\* emit of the three distribution packages/);
    expect(glossary, 'the glossary does not define resolved by what Node resolves')
      .toMatch(/resolved\*\* emit is what Node resolves through a package's `default` condition/);
    expect(glossary, 'the glossary does not say the two axes are independent')
      .toMatch(/resolved and not distributed/);
    // **This clause named the two packages that were the difference, and Q-0124 leaves none.** It
    // read *"the glossary does not name both packages that are the difference"*, which was a claim
    // about a split that has closed; what survives it is the reason the vocabulary was defined by
    // mechanism in the first place — so what is asserted now is that the entry says the two sets
    // coincide **without** saying they are one question, which is the sentence that keeps 093 useful
    // at the next emitter.
    expect(glossary, 'the glossary does not say the distribution set is the same five')
      .toMatch(/the \*\*local distribution set\*\* is the same five/);
    expect(glossary, 'the glossary presents the sets coinciding as a rule rather than as a moment')
      .toMatch(/a property\s+of this moment rather than a rule|a property of this moment rather than a rule/);
    expect(glossary, 'the glossary still gives the two packages as a live difference')
      .not.toMatch(/\*\*`@quorum\/web` and `@quorum\/server` are the difference\*\*/);
    expect(glossary, 'the glossary does not cite the entry that ruled it')
      .toContain('A fifth package emits, and `resolved` is not a synonym for `distributed`');
    // The negative has a subject, in the shape the block above uses.
    const asItWas = 'shapes**, and the words for them are *resolved* and *served*: the **resolved** emit of the three distribution packages, the JavaScript and declaration files Node and a packed install import;';
    expect(asItWas, 'the fixture no longer reproduces the wording this clause refuses')
      .toMatch(/the \*\*resolved\*\* emit of the three distribution packages/);
  });

  test('and the decision index carries the entry this ticket implements', () => {
    // A landed entry is cited by title and date, never by number or file name — so the index row is
    // what says it took its place, and the file is what says it exists.
    expect(repoFile('docs/DECISIONS.md'), 'the index does not carry the fifth-emitter entry')
      .toContain('A fifth package emits, and *resolved* is not a synonym for *distributed*');
    expect(repoFile('docs/decisions/093-a-fifth-package-emits-and-resolved-is-not-distributed.md'), 'the entry does not open with its title and date')
      .toMatch(/^# A fifth package emits, and \*resolved\* is not a synonym for \*distributed\* — 2026-09-12/);
    // Q-0124's own, which supersedes 094 and is what the documents above now cite.
    expect(repoFile('docs/DECISIONS.md'), 'the index does not carry the distribution-set entry')
      .toContain('The distribution set is five, and rejoins the emitting set');
    expect(repoFile('docs/decisions/096-the-distribution-set-is-five-and-rejoins-the-emitting-set.md'), 'the entry does not open with its title and date')
      .toMatch(/^# The distribution set is five, and rejoins the emitting set — 2026-09-15/);
  });
});

describe('Q-0124 AC-13 — the installation documents describe the install a stranger will perform', () => {
  /**
   * The packages a `pnpm pack` of this repository really produces, **derived from the manifests
   * rather than written down**.
   *
   * A package is in the local distribution set exactly when it declares a `files` allow-list: that
   * is what makes its tarball a decided set of paths rather than whatever the checkout happens to
   * hold, and it is the key decision 096 clause 3 names. Keyed on the **behaviour** rather than on a
   * list of names, which is the seventh recorded instance of that distinction in this repository and
   * the reason a sixth distributed package fails the two clauses below rather than passing them.
   *
   * Both workspace roots, because one of the five is not under `packages/` — `apps/web`, and the assumption that
   * broke `build.test.ts`'s own loops at this ticket, found here as well because `README.md`
   * documents the same walk for a human to type.
   */
  const WORKSPACE_ROOTS = ['packages', 'apps'];
  const MANIFEST = 'package.json';

  const distributed = (): { name: string; directory: string; tarball: string }[] => {
    const found: { name: string; directory: string; tarball: string }[] = [];
    for (const root of WORKSPACE_ROOTS) {
      for (const entry of fs.readdirSync(path.join(repoRoot, root), { withFileTypes: true })) {
        const relative = `${root}/${entry.name}`;
        if (!entry.isDirectory() || !fs.existsSync(path.join(repoRoot, relative, MANIFEST))) continue;
        const manifest = JSON.parse(repoFile(`${relative}/${MANIFEST}`)) as { name?: string; files?: unknown; version?: string };
        if (manifest.files === undefined || manifest.name === undefined) continue;
        found.push({
          name: manifest.name,
          directory: relative,
          // What `pnpm pack` writes: the scope's `@` goes, its slash becomes a dash, and the
          // version is appended. Derived from the manifest so a version bump moves the README
          // rather than this assertion.
          tarball: `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version ?? '0.0.0'}.tgz`,
        });
      }
    }
    return found.sort((a, b) => a.name.localeCompare(b.name));
  };

  /** A count as a reader meets it in prose. Five entries, because the set has never been near ten. */
  const IN_WORDS: Record<number, string> = { 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven' };

  test('the derivation has a subject, and reaches the one that is not under packages/', () => {
    // Anti-vacuity first: a walk that found nothing would leave both clauses below true of nothing,
    // and a walk that reached only `packages/` would leave the README's loop unchecked in exactly
    // the place it is wrong.
    const set = distributed();
    expect(set.length, 'no package declares a files allow-list — the clauses below prove nothing').toBeGreaterThan(2);
    expect(set.some((member) => member.directory.startsWith('apps/')),
      'the walk reaches no package outside packages/, which is the assumption this clause exists to check').toBe(true);
    expect(IN_WORDS[set.length], `${String(set.length)} distributed packages and no word for that count`).toBeDefined();
  });

  test('README names every tarball the pack loop produces, and a directory per package', () => {
    const readme = repoFile('README.md');
    for (const member of distributed()) {
      expect(readme, `README does not install ${member.tarball}`).toContain(member.tarball);
      expect(readme, `README's pack loop does not reach ${member.directory}`).toContain(member.directory);
    }
    // And the count it states in prose agrees, so a sixth member arriving fails here rather than
    // being installed by a block whose own sentence says there are five.
    // Compared case-insensitively because the count opens a sentence in the document and is mid
    // sentence here; what is held is the number, not the capital.
    expect(readme.toLowerCase(), 'the README states a tarball count that is not the set it installs')
      .toContain(`${IN_WORDS[distributed().length]} tarballs, installed together`);
  });

  test('and pillar 7 states the same count, which is what every product-manager step is fed', () => {
    // **Asserted before the README's own clause would matter most.** `harness/product-context.md` is
    // read at run time by every product-manager step, so a false installation claim there is one
    // every future requirement inherits — Q-0098's finding, and the reason this is a criterion
    // rather than a tidy-up.
    const pillar = repoFile('harness/product-context.md').replace(/\s+/g, ' ');
    expect(pillar, 'pillar 7 states a distribution count that is not the set on disk')
      .toContain(`the ${IN_WORDS[distributed().length]} **distribution** packages`);
    // The negative has a subject: the same needle finds the superseded count where it is written.
    const asItWas = 'and the locally packed path (the three **distribution** packages\' tarballs installed together';
    expect(asItWas, 'the fixture no longer reproduces the wording this clause replaces')
      .toContain('the three **distribution** packages');
  });
});

describe('Q-0017 AC-4 — the two artifacts claiming this app fetches nothing say what they enforce', () => {
  /**
   * The describe title `apps/web/test/source.test.ts` gives its network scan.
   *
   * **Read here rather than asserted there**, on the precedent this file already states for the two
   * `apps/web` anchors above: this package's `test` task declares `docs/04-architecture.md` as an
   * input, and holding a document's wording against a guard's from inside `apps/web` would earn that
   * package its first `turbo.json` for one assertion. The read in the other direction — this file
   * opening a file under `apps/` — is declared in `packages/shared/turbo.json` and registered in
   * `packages/core/src/turbo-inputs.test.ts`'s manifest, which is the other half of that trade.
   */
  const scanTitle = (): string => {
    const source = repoFile('apps/web/test/source.test.ts');
    const found = /describe\('(AC-10 — every request[^']+)'/.exec(source);
    if (!found) throw new Error('apps/web/test/source.test.ts has no network-scan describe — this check has lost its subject');
    return found[1];
  };

  /** The architecture document's own clause about what this app fetches. */
  const architectureClause = (): string => {
    const text = repoFile('docs/04-architecture.md');
    const start = text.indexOf('### `apps/web`');
    if (start < 0) throw new Error('docs/04-architecture.md has no apps/web section — this check has lost its subject');
    const end = text.indexOf('\n## ', start + 1);
    const web = text.slice(start, end < 0 ? undefined : end).replace(/\s+/g, ' ');
    const found = /and \*\*([^*]+)\*\* — a deliberate divergence/.exec(web);
    if (!found) throw new Error('docs/04-architecture.md no longer carries the fetch clause — this check has lost its subject');
    return found[1];
  };

  test('neither claims that nothing is fetched, which stopped being true at this ticket', () => {
    // `apps/web/src/daemon-client.ts` asks the daemon for the backlog on every board load. Both
    // artifacts said the shell fetched nothing from a network, and both are enforced by a scan for
    // three URL literals that a same-origin path trips none of — so both claims would have gone on
    // passing while being false. That is a check outliving its subject at the level of the CLAIM
    // rather than of the assertion, which is the class this repository records most.
    const stale = /fetches nothing|nothing is fetched/i;
    for (const [what, text] of [['the scan title', scanTitle()], ['the architecture clause', architectureClause()]] as const) {
      expect(stale.test(text), `${what} still says nothing is fetched`).toBe(false);
    }
    // The needle discriminates, over the wording each of them carried until this ticket.
    expect(stale.test('AC-10 — loading the shell fetches nothing from a network')).toBe(true);
    expect(stale.test('and **nothing is fetched from a network** — a deliberate divergence')).toBe(true);
  });

  test('and each states the property the scan actually enforces, on the same three axes', () => {
    // What was always true, and still is: no absolute URL, no third-party host, no font host —
    // every request the app makes is same-origin and page-relative. Nothing in the scan itself was
    // weakened: the three needles, the licence subtraction and its both-directions test are
    // untouched.
    //
    // **What this enforces is each sentence against three needles, and NOT the two against each
    // other.** It was titled *"so they cannot drift apart"* and commented as holding them *"against
    // each other rather than each against a paraphrase"* until Q-0127, and it does neither: the two
    // strings are never compared. The needles are real, so the clause was not vacuous — what was
    // false is its own account of the mechanism, which is the class this repository records most.
    // Corrected rather than strengthened: comparing two prose sentences written for two audiences
    // for equality is a check that fails on a legitimate edit to either. What it does hold is that
    // neither sentence can drop one of the three axes without failing here, and the case below is
    // what shows each needle firing.
    for (const [what, text] of [['the scan title', scanTitle()], ['the architecture clause', architectureClause()]] as const) {
      expect(text, `${what} does not state the same-origin property`).toMatch(/same-origin/i);
      expect(text, `${what} no longer names the absolute URL it forbids`).toMatch(/absolute URL/i);
      expect(text, `${what} no longer names the font host it forbids`).toMatch(/font host/i);
    }
  });

  test('and each of the three needles is what fails when a sentence drops that axis (Q-0127)', () => {
    // The anti-vacuity half the clause above never had: three needles that matched everything would
    // satisfy it over any pair of sentences at all. Each is shown red against the REAL sentence with
    // that one phrase removed, so what is demonstrated is this check firing rather than a fixture
    // agreeing with itself.
    const AXES: [RegExp, RegExp][] = [
      [/same-origin/i, /same-origin/gi],
      [/absolute URL/i, /absolute URLs?/gi],
      [/font host/i, /font hosts?/gi],
    ];
    for (const [what, text] of [['the scan title', scanTitle()], ['the architecture clause', architectureClause()]] as const) {
      for (const [needle, strip] of AXES) {
        expect(needle.test(text), `${what} does not satisfy ${String(needle)} as it stands`).toBe(true);
        expect(needle.test(text.replace(strip, 'something else')),
          `${what} still satisfies ${String(needle)} with that phrase removed`).toBe(false);
      }
    }
  });

  test('the app really does fetch now, so neither clause is being narrowed for nothing', () => {
    // Anti-vacuity from the other side: a claim narrowed for an occasion that never arrived is a
    // document weakened for no reason. The occasion is a real module making a real request.
    const client = repoFile('apps/web/src/daemon-client.ts');
    expect(client, 'the client no longer fetches — this narrowing has lost its occasion').toContain('fetch(');
    expect(/https?:\/\//.test(client), 'the client names an absolute URL after all').toBe(false);
  });
});

describe('Q-0017 AC-15 — the design brief stops promising a gate action the engine refuses', () => {
  /**
   * The brief proper: everything below the rule that separates it from this repository's own record
   * of what has been corrected in it.
   *
   * The split is what the document already has, and it is load-bearing here. The status block above
   * the rule is where a correction is written down, so it NAMES the wording it removed; the brief
   * below is what somebody pastes into a prompt. A scan over the whole file could not tell a promise
   * from the record of one having been withdrawn.
   */
  const brief = (): string => {
    const text = repoFile('docs/05-design-prompt.md');
    const rule = text.indexOf('\n---\n');
    if (rule < 0) throw new Error('docs/05-design-prompt.md has no rule separating its status block from the brief');
    return text.slice(rule);
  };

  /** The status block above that rule — the repository's record rather than the brief. */
  const record = (): string => {
    const text = repoFile('docs/05-design-prompt.md');
    return text.slice(0, text.indexOf('\n---\n')).replace(/\s+/g, ' ');
  };

  test('the brief offers no override and no "Advance anyway"', () => {
    // Third document to carry that promise and the last to be corrected. `gateAnswerSchema` is a
    // three-member enum and `gateAnswerEnvelopeSchema` is `.strict()` over it, so `askGate` raises
    // on anything else — an override control is a screen a reader would build and the engine would
    // refuse. Q-0013's gate found it in `04-architecture.md` and in `06-development-plan.md`, and
    // Q-0118 recorded the discharge as complete while this file had never been looked at.
    expect(/\boverride/i.test(brief()), 'the brief still offers an override').toBe(false);
    expect(/advance anyway/i.test(brief()), 'the brief still offers an "Advance anyway" control').toBe(false);
    // Both needles discriminate, over the two wordings this ticket removed.
    expect(/\boverride/i.test('then advances, re-runs, or overrides.')).toBe(true);
    expect(/advance anyway/i.test('secondary "Advance anyway" (override, requires a one-line reason)')).toBe(true);
    // …and the record above the rule still carries the word, which is what makes the slice a
    // separation rather than a hole: the correction has to be able to name what it removed.
    expect(/\boverride/i.test(record()), 'the correction no longer names the wording it withdrew').toBe(true);
  });

  test('and it names the three answers the schema permits, which is the half a deletion would miss', () => {
    // A negative alone is satisfied by a paragraph that stopped mentioning gates at all. What is
    // asserted is the answer set, taken from the schema rather than transcribed beside it.
    const answers = [...gateAnswerSchema.options];
    expect(answers.slice().sort(), 'the answer set moved and this check did not')
      .toStrictEqual(['abort', 'advance', 'retry']);
    for (const answer of answers) {
      expect(brief().includes(`\`${answer}\``), `the brief does not name ${answer}`).toBe(true);
    }
  });

  test('the three documents agree: each names what refuses the override rather than the override', () => {
    // *"The three documents' answer sets agree"*, as a property a check can hold: none of them
    // offers the control, and each names the schema that refuses it — which is what makes the
    // agreement a shared reason rather than three independent silences.
    const SITES: [string, string][] = [
      ['docs/04-architecture.md', repoFile('docs/04-architecture.md')],
      ['docs/06-development-plan.md', repoFile('docs/06-development-plan.md')],
      ['docs/05-design-prompt.md', repoFile('docs/05-design-prompt.md')],
    ];
    for (const [name, text] of SITES) {
      expect(text, `${name} does not name the schema that refuses an override`).toContain('gateAnswerEnvelopeSchema');
    }
    // And the record above the rule names the other two, so the set is visible as complete rather
    // than as two thirds of one — which is how this file came to be missed.
    expect(record(), 'the correction does not name the architecture document').toContain('docs/04-architecture.md');
    expect(record(), 'the correction does not name the development plan').toContain('docs/06-development-plan.md');
  });

  test('and the board paragraph records the four divergences the screen that shipped has from it', () => {
    const text = brief();
    const board = text.slice(text.indexOf('**2. Backlog board.**'), text.indexOf('**3. Harness editor.**'));
    expect(board.length, 'the board paragraph was not found — this check has lost its subject').toBeGreaterThan(500);
    for (const [what, needle] of [
      ['the column count', /Ten columns, not eight/],
      ['the missing denominator', /carry no denominator/],
      ['what the cost figure is not', /neither per vendor nor cost to date/],
      ['the refused button', /No "Run next flow/],
    ] as [string, RegExp][]) {
      expect(needle.test(board), `the board paragraph does not record ${what}`).toBe(true);
    }
  });

  test('Q-0130 AC-14 — the board paragraph says where the refused button went, and screen 5 records the stop', () => {
    const text = brief();
    // The board's own paragraph keeps the refusal — `No "Run next flow ▸"` is asserted above — and
    // gains where the control actually went. A negative alone would be satisfied by a paragraph
    // that simply stopped mentioning it.
    const board = text.slice(text.indexOf('**2. Backlog board.**'), text.indexOf('**3. Harness editor.**'));
    expect(board, 'the board paragraph does not say where the control went instead')
      .toMatch(/on the ticket page, not on a card/);
    expect(board, 'the board paragraph does not say why it is not on a card').toMatch(/middle-click/);
    expect(board, 'the board paragraph no longer says the board writes nothing').toMatch(/still writes nothing/);
    // Screen 5's paragraph names a stop button and until this ticket nothing recorded what shipped
    // instead. Sliced between its own heading and the gate screen's, so a clause satisfied by the
    // gate paragraph would not be about this one.
    const run = text.slice(text.indexOf('**5. Live run'), text.indexOf('**6. Gate screen'));
    expect(run.length, 'the mission control paragraph was not found — this check has lost its subject')
      .toBeGreaterThan(500);
    for (const [what, needle] of [
      ['what decides whether the control is offered', /never from the connection/],
      ['that it is confirmed and single', /confirmed rather than immediate/],
      ['what a 204 does and does not establish', /delivery, not an ending/],
      ['that it is not a gate answer', /a stop is not a gate answer/],
    ] as [string, RegExp][]) {
      expect(needle.test(run), `the mission control paragraph does not record ${what}`).toBe(true);
    }
  });

  test('Q-0016 AC-14 — and the gate paragraph records the three the gate screen has', () => {
    const text = brief();
    const gate = text.slice(text.indexOf('**6. Gate screen (second hero).**'), text.indexOf('**7. Step chat'));
    expect(gate.length, 'the gate paragraph was not found — this check has lost its subject').toBeGreaterThan(500);
    for (const [what, needle] of [
      ['that the third answer is not primary and is often not offered', /not the primary action/],
      ['when the screen is actually reached', /Reached when a run parks/],
      // **Re-aimed twice and deleted neither time.** Q-0129 moved it from *the ticket owing the
      // decision* to *the ticket owing the diff*; Q-0134 landed that half, so what is left to ask
      // is what a divergence paragraph is for — that the brief records what shipped INSTEAD of the
      // mockup. The needle is the shape that differs, and it is the one the mockup names and the
      // screen refuses.
      ['what shipped instead of the mockup\'s side-by-side view', /unified rather than side-by-side/],
      ['that the decision the step returned IS rendered', /reached/],
      ['why no severity headline is rendered, with the measurement', /1,080/],
      ['that the reviewed patch IS rendered', /renders the reviewed patch/],
      ['why the patch is not on the event stream, with the measurement', /200,000/],
    ] as [string, RegExp][]) {
      expect(needle.test(gate), `the gate paragraph does not record ${what}`).toBe(true);
    }
    // The negatives beside the positives, in this file's own shape: a clause routing a LANDED half
    // to the ticket that owed it must be gone rather than merely joined by a newer one, because a
    // paragraph still naming a successor tells a reader to wait for work that is done.
    expect(gate, 'the paragraph still routes the decision to the ticket that has landed it')
      .not.toMatch(/Q-0129's/);
    expect(gate, 'the paragraph still says the screen shows no region for the diff')
      .not.toMatch(/shows no region standing in for/);
    expect(gate, 'the paragraph still routes the diff to the ticket that has landed it')
      .not.toMatch(/Q-0134's/);
  });

  test('and the count in it is re-derived, with the grep that produces it and the one that does not', () => {
    // **The rule this clause exists for**: a measurement copied from a document is not a
    // measurement, and this repository has recorded a correction travelling one document further by
    // being copied. So the paragraph carries the command that produces its figure, and says which
    // near-miss command does not — `grep -c 'gate='` also collects the retry-grant lines and one
    // hand-written note, which is how a plausible wrong number gets into a document.
    const text = brief();
    const gate = text.slice(text.indexOf('**6. Gate screen (second hero).**'), text.indexOf('**7. Step chat'));
    expect(gate, 'the paragraph states a figure without the command that produces it')
      .toContain("grep -hE 'gate=[a-z-]+ answer=(advance|retry|abort)' backlog/*/runs.log | wc -l");
    expect(gate, 'the paragraph does not warn off the count that over-collects').toMatch(/is not the figure/);
    // The two figures and their difference are all stated, so a reader can check the arithmetic
    // without re-running anything: the wider count, the narrower one, and what the gap is made of.
    for (const [what, needle] of [
      ['the engine-answer count', /\*\*220\*\*/],
      ['how many of them carry no target', /\*\*148\*\*/],
      ['the over-collecting count', /returns 255/],
      ['what the gap is made of', /34 retry-grant lines and one hand-written erratum note/],
    ] as [string, RegExp][]) {
      expect(needle.test(gate), `the paragraph does not state ${what}`).toBe(true);
    }
  });
});

/**
 * The run-event contract, and **the first file under `contracts/` any suite in this workspace
 * reads** — that directory has no package, so nothing had opened one before and no task declared
 * one. `packages/shared/turbo.json` gains the row, and removing it turns three clauses of
 * `packages/core/src/turbo-inputs.test.ts` red naming this path.
 *
 * The path is a quoted literal inside the read rather than a `const` the two callers share:
 * that scanner collects a literal and reads a binding as an indirect route, which would then need
 * excusing in a register for nothing. Measured — as a `const` it reported
 * `repoFile → CONTRACT` unregistered.
 */
const runEventsContract = (): string => repoFile('contracts/Q-0050/run-events.contract.md');

/** The `*"Title"* (YYYY-MM-DD)` shape `.claude/rules/docs-and-decisions.md` requires of a citation. */
const CITATION = /\*"([^"]+)"\*\s*\((\d{4}-\d{2}-\d{2})\)/;

/** A citation by file name: a path into the folder, or a bare `NNN-slug.md` basename. */
const BY_FILE_NAME = /decisions\/[^\s)]+\.md|\b\d{3}-[a-z0-9-]+\.md/;

/** A citation by number: `decision 097`, `entry 97`, `#097`. */
const BY_NUMBER = /\b(?:decision|entry)\s+#?0*\d{1,3}\b|#0\d{2}\b/i;

/**
 * The superseded-by notes in a contract that are about `reached`, selected by their subject rather
 * than by their position — so reordering the document cannot quietly move the check below onto a
 * different paragraph. Paragraphs are blank-line separated, and no line of the fenced declaration
 * block carries `superseded by`, so the block cannot be collected as one.
 */
function reachedNotes(contract: string): string[] {
  return contract
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.includes('superseded by') && /\breached\b/.test(paragraph));
}

/**
 * The one thing wrong with the contract's `reached` note, or `null` where it cites a landed entry
 * the way the rule requires.
 *
 * **It returns the problem rather than asserting, so that the shipped contract and the fixtures
 * below go through the same code.** A fixture checked by a second implementation demonstrates that
 * implementation and not this guard, which is the nit Q-0125 shipped three times; and `contracts/`
 * is outside the chore role's write paths, so mutating the real file to show a clause red is not
 * available here (erratum E-6).
 *
 * **What it checks is that the citation RESOLVES**, never that it equals a title typed here. An
 * entry is cited by its title and date and never by its file name or its number, so the citation is
 * parsed out of the note, looked up in `docs/DECISIONS.md`'s index, and matched against the entry
 * the index links to. A guard comparing the note with a transcribed string would pass over an index
 * row renamed underneath it, which is the drift a citation rule exists to catch.
 */
function citationProblem(
  contract: string,
  rows: readonly Listed[],
  entries: ReadonlyMap<string, string>,
): string | null {
  const notes = reachedNotes(contract);
  if (notes.length === 0) {
    return 'the contract carries no superseded-by note about `reached` — this check has lost its subject';
  }
  if (notes.length > 1) {
    return `the contract carries ${notes.length} superseded-by notes about \`reached\`, so which one rules the field is ambiguous`;
  }
  const note = notes[0];
  if (BY_FILE_NAME.test(note)) return 'the note cites the entry by its file name';
  if (BY_NUMBER.test(note)) return 'the note cites the entry by its number';
  const cited = CITATION.exec(note);
  if (!cited) return 'the note names no entry by title and date';
  // The contract's prose is wrapped at the column this repository writes to, so the title spans a
  // line break and the captured text carries the newline with it. Collapsing is what makes the
  // lookup below the index lookup it reads as — without it the shipped note fails here.
  const title = cited[1].replace(/\s+/g, ' ');
  const date = cited[2];
  const row = rows.find((listedEntry) => listedEntry.title === title);
  if (!row) return `the note cites "${title}", which docs/DECISIONS.md does not list`;
  if (row.date !== date) {
    return `the note dates that entry ${date} where the index lists it under ${row.date}`;
  }
  const entry = entries.get(row.file);
  if (entry === undefined) {
    return `the index links "${title}" to ${row.file}, which docs/decisions/ does not hold`;
  }
  const heading = entry.split('\n', 1)[0];
  if (heading !== `# ${title} — ${date}`) {
    return `${row.file} opens "${heading}" rather than with the title and date the note cites`;
  }
  // …and the entry it resolves to is the one that rules THIS field. Without this clause the note
  // could cite any landed entry, resolve cleanly, and still not be the ruling it claims to be.
  for (const subject of ['reached', 'gateQuestionEventSchema']) {
    if (!entry.includes(subject)) {
      return `${row.file} does not name \`${subject}\`, so it is not the entry that rules this field`;
    }
  }
  return null;
}

describe('Q-0129 AC-12 — the run-event contract cites the entry that rules `reached`', () => {
  test('the shipped note names a landed entry by title and date, and the citation resolves', () => {
    expect(citationProblem(runEventsContract(), listed(), onDisk())).toBeNull();
  });

  test('and the note it rests on is really there, beside the declaration it amends', () => {
    // Anti-vacuity beside the predicate: this is what says the paragraph the whole check hangs off
    // is about what it claims to be about, rather than some other superseded-by note in the file —
    // there is a second one, added by Q-0040.
    const contract = runEventsContract();
    const notes = reachedNotes(contract);
    expect(notes.length, 'the contract carries no superseded-by note about `reached`').toBe(1);
    expect(notes[0], 'the note does not name the event the field was added to').toContain('GateQuestionEvent');
    expect(
      contract.indexOf(notes[0]),
      'the note does not sit after the declaration block it amends',
    ).toBeGreaterThan(contract.indexOf('interface GateQuestionEvent'));
  });

  test('and every way of getting the citation wrong is refused, through that same predicate', () => {
    const TITLE = 'A gate question carries the decision that reached it';
    const ROWS: Listed[] = [{ title: TITLE, file: '097-slug.md', date: '2026-09-17' }];
    const ENTRY = `# ${TITLE} — 2026-09-17\n\n\`gateQuestionEventSchema\` gains one optional field, \`reached\`.\n`;
    const ENTRIES = new Map([['097-slug.md', ENTRY]]);
    const GOOD = `\`GateQuestionEvent\` gained \`reached\` — superseded by *"${TITLE}"* (2026-09-17).`;

    // The positive control first. Without it every clause below would be satisfied by a predicate
    // that refuses everything, which is a demonstration of nothing.
    expect(citationProblem(`# c\n\n${GOOD}\n`, ROWS, ENTRIES), 'the well-formed fixture was refused').toBeNull();

    for (const [what, contract, needle] of [
      ['no note at all', '# c\n\nNothing about the field here.\n', /lost its subject/],
      ['two notes about the field', `# c\n\n${GOOD}\n\n${GOOD}\n`, /ambiguous/],
      [
        'a citation by file name',
        '# c\n\n`reached` — superseded by decisions/097-a-gate-question.md.\n',
        /by its file name/,
      ],
      ['a citation by number', '# c\n\n`reached` — superseded by decision 097.\n', /by its number/],
      [
        'no citation at all',
        "# c\n\n`reached` — superseded by the ruling landed at this ticket's gate.\n",
        /names no entry by title and date/,
      ],
      [
        'a title the index does not list',
        '# c\n\n`reached` — superseded by *"A ruling nobody landed"* (2026-09-17).\n',
        /docs\/DECISIONS\.md does not list/,
      ],
      [
        'a date the index disagrees with',
        `# c\n\n\`reached\` — superseded by *"${TITLE}"* (2026-09-16).\n`,
        /where the index lists it under/,
      ],
    ] as [string, string, RegExp][]) {
      const problem = citationProblem(contract, ROWS, ENTRIES);
      expect(problem, `a note with ${what} was accepted`).not.toBeNull();
      expect(problem, `a note with ${what} was refused for the wrong reason`).toMatch(needle);
    }

    // The last two branches need a different index or a different entry, so they sit beside the
    // loop rather than inside it.
    expect(
      citationProblem(`# c\n\n${GOOD}\n`, ROWS, new Map()),
      'an index row pointing at a file the folder does not hold was accepted',
    ).toMatch(/docs\/decisions\/ does not hold/);
    expect(
      citationProblem(`# c\n\n${GOOD}\n`, ROWS, new Map([['097-slug.md', `# ${TITLE} — 2026-09-18\n\n\`gateQuestionEventSchema\` \`reached\`\n`]])),
      "an entry whose own heading disagrees with the index's date was accepted",
    ).toMatch(/rather than with the title and date/);
    expect(
      citationProblem(`# c\n\n${GOOD}\n`, ROWS, new Map([['097-slug.md', `# ${TITLE} — 2026-09-17\n\nAbout something else entirely.\n`]])),
      'an entry that does not rule this field was accepted',
    ).toMatch(/is not the entry that rules this field/);
  });
});
