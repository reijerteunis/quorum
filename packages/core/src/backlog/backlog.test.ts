// Q-0043: the backlog store, asserted against real files.
//
// The independent witness here is the repository's own corpus and the `yaml` emitter, not the
// spike's suite — both suites can be green over a wrong port (harness/port-charter.md §2), because
// a test ported alongside a mis-ported module agrees with it. So the byte-fidelity criterion runs
// against all thirty checked-in `ticket.md` files rather than against a fixture, and every other
// case builds the directory it asserts.
//
// No case asserts a fact about this repository that the next landing changes (the
// permanent-acceptance-test decision, docs/DECISIONS.md 2026-08-23): the corpus test asserts that
// each ticket round-trips, which stays true as tickets are added, and never that there are thirty
// of them or that any particular one exists.
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';
import YAML, { YAMLParseError } from 'yaml';

import { parseTicketId } from '@quorum/shared';

import { Backlog, parseFrontmatter, renderFrontmatter } from './backlog.js';
import type { TicketRecord } from './backlog.js';
import { TICKET_ID_PATTERN } from '../run-history/reader.js';
import { removeTempDirs, tempDir, walk, write } from '../../test/repo.js';
import { repoFile, repoRoot } from '../../test/corpus.js';

afterAll(removeTempDirs);

/** An empty backlog root that exists. */
const emptyBacklog = (): Backlog => new Backlog(tempDir('backlog-'));

/** A backlog root path that does NOT exist. */
const missingBacklog = (): Backlog => new Backlog(path.join(tempDir('missing-'), 'no-backlog-here'));

/** A ticket folder written by hand, so the test controls every byte of it. */
function ticketAt(backlog: Backlog, folder: string, text: string): TicketRecord {
  write(path.join(backlog.root, folder, 'ticket.md'), text);
  return backlog.read(folder);
}

const FIXTURE = [
  '---',
  'id: Q-0001',
  'title: A ticket',
  'stage: draft',
  'owner: ruud',
  'repos: []',
  'branch: harness/Q-0001/integration',
  'priority: p2',
  'created: 2026-08-26',
  'iterations: {}',
  'history: []',
  '---',
  '# Intent',
  '',
  'Body text.',
  '',
].join('\n');

/** One row of the allocation table: a backlog to build, and the id or the refusal it must answer. */
interface AllocationRow {
  name: string;
  criterion: string;
  tickets: [string, string][];
  id?: string;
  throws?: string;
}

/**
 * The allocation table, READ rather than transcribed — and read from beside this file, which is
 * where Q-0107 AC-8 moved it.
 *
 * It was `spike/test/q0080-allocation.json` until then, so that `spike/test/q0080-allocation.js`
 * and this file could drive one table through two `Backlog` implementations. The spike's reader
 * still drives it, reaching across the boundary, until Q-0103 deletes that tree; what changed is
 * the direction, so the copy that survives the cutover is the one that holds the bytes. Two copies
 * of a table drift; there is one (Q-0080 AC-11).
 */
const TABLE = JSON.parse(repoFile('packages/core/src/backlog/q0080-allocation.json')) as {
  rows: AllocationRow[];
  grammar: { accepts: string[]; rejects: string[] };
};

/**
 * What the table drove when it was read from `spike/test/`, measured on the tree at `d24fb8b`
 * before the move: eleven rows, three accepted ids, eight rejected ones, and the thirty-three
 * assertions the two loops below make over them.
 *
 * Q-0107 AC-8 asks for the row count and the assertion count to be identical before and after,
 * *asserted rather than eyeballed* — because a move that silently truncated the file would leave
 * both loops iterating a shorter array and both tests green. The two loops record what they
 * actually visited and the assertions below compare that against these numbers, so the claim is
 * about executed assertions rather than about the file's length.
 */
const BEFORE_THE_MOVE = { rows: 11, accepts: 3, rejects: 8, assertions: 33 } as const;

/** Every table-driven assertion the two tests below make, in the order they make them. */
const visited: string[] = [];

/**
 * Every `ticket.md` in a `backlog/` subdirectory of THIS repository, and a loud failure when there
 * are none — a check that skips its subject must not report success (docs/DECISIONS.md,
 * 2026-08-25).
 */
function corpusTickets(): string[] {
  const root = path.join(repoRoot, 'backlog');
  if (!fs.existsSync(root)) {
    throw new Error(`corpus missing: ${root} does not exist — byte fidelity proves nothing without it`);
  }
  const files = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, 'ticket.md'))
    .filter((file) => fs.existsSync(file))
    .sort();
  if (!files.length) throw new Error('corpus empty: backlog/ holds no ticket.md — byte fidelity proves nothing without one');
  return files;
}

describe('AC-2 — parseFrontmatter accepts exactly what it accepts today, and invents nothing', () => {
  test('a well-formed file splits into its block and its body', () => {
    expect(parseFrontmatter(FIXTURE)).toStrictEqual({
      meta: {
        id: 'Q-0001', title: 'A ticket', stage: 'draft', owner: 'ruud', repos: [],
        branch: 'harness/Q-0001/integration', priority: 'p2', created: '2026-08-26',
        iterations: {}, history: [],
      },
      body: '# Intent\n\nBody text.\n',
    });
  });

  test('no delimiters at all: the whole file is the body, silently', () => {
    // The silence contradicts harness/rules.md's "errors are explicit" and is carried, not fixed.
    const text = '# Just markdown\n\nno frontmatter here\n';
    expect(parseFrontmatter(text)).toStrictEqual({ meta: {}, body: text });
  });

  test('an empty block yields an empty object — harness/roles/code-reviewer.md is this shape', () => {
    expect(parseFrontmatter('---\n\n---\nbody\n')).toStrictEqual({ meta: {}, body: 'body\n' });
  });

  test('a leading blank line or a BOM means no match, so nothing is stripped or repaired', () => {
    // The BOM is constructed rather than pasted: an invisible character in a test is a test
    // nobody can review.
    const bom = String.fromCharCode(0xfeff);
    for (const text of ['\n---\na: 1\n---\nbody\n', `${bom}---\na: 1\n---\nbody\n`]) {
      expect(parseFrontmatter(text)).toStrictEqual({ meta: {}, body: text });
    }
  });

  test('a --- line inside the body belongs to the body: the match is non-greedy', () => {
    expect(parseFrontmatter('---\na: 1\n---\nabove\n---\nbelow\n'))
      .toStrictEqual({ meta: { a: 1 }, body: 'above\n---\nbelow\n' });
  });

  test('the closing delimiter is accepted with and without a trailing newline', () => {
    expect(parseFrontmatter('---\na: 1\n---')).toStrictEqual({ meta: { a: 1 }, body: '' });
    expect(parseFrontmatter('---\na: 1\n---\n')).toStrictEqual({ meta: { a: 1 }, body: '' });
  });

  test('a role file goes through the same function — it is not a ticket-specific reader', () => {
    // spike/src/engine.js:727-732 reads harness/roles/*.md with it, which is why nothing here is
    // typed as a ticket and nothing validates.
    expect(parseFrontmatter('---\nadapter: claude\nmodel: opus\npaths:\n  - packages\n---\nYou are…\n'))
      .toStrictEqual({ meta: { adapter: 'claude', model: 'opus', paths: ['packages'] }, body: 'You are…\n' });
  });

  test('malformed YAML throws the emitter\'s own error, unwrapped and un-re-messaged', () => {
    // What a command prints is externally observable, so the message is not ours to improve.
    expect(() => parseFrontmatter('---\n{\n---\nbody\n')).toThrow(YAMLParseError);
  });
});

describe('AC-3 — a ticket this writer wrote round-trips byte for byte', () => {
  test('every ticket.md in this repository survives parse-then-render unchanged', () => {
    const files = corpusTickets();
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      const { meta, body } = parseFrontmatter(text);
      expect(renderFrontmatter(meta, body), `${path.relative(repoRoot, file)} does not round-trip`).toBe(text);
    }
  });

  test('the corpus includes a ticket with non-empty iterations and history', () => {
    // Otherwise the round-trip above would be proving fidelity only for the trivial shape.
    const shapes = corpusTickets().map((file) => parseFrontmatter(fs.readFileSync(file, 'utf8')).meta as {
      iterations?: Record<string, number>;
      history?: unknown[];
    });
    expect(shapes.some((meta) => Object.keys(meta.iterations ?? {}).length > 0)).toBe(true);
    expect(shapes.some((meta) => (meta.history ?? []).length > 0)).toBe(true);
  });

  test('the emitter runs with NO options: a long scalar still folds at 80 columns', () => {
    // The pin. yaml's default lineWidth is 80 and the longest `title:` line on disk is exactly 80,
    // so `lineWidth: 0` — the natural thing to reach for when a title wraps oddly — would unfold
    // every long line in the backlog on the next write, and would fail here instead.
    const title = `${'x'.repeat(60)} ${'y'.repeat(30)}`;
    const rendered = renderFrontmatter({ title }, 'body\n');
    expect(rendered).toBe(`---\ntitle: ${'x'.repeat(60)}\n  ${'y'.repeat(30)}\n---\nbody\n`);
    expect(parseFrontmatter(rendered).meta).toStrictEqual({ title });
  });

  test('changing one field changes one line, and nothing else in the file', () => {
    const before = FIXTURE;
    const { meta, body } = parseFrontmatter(before);
    (meta as { stage: string }).stage = 'requirements';
    const after = renderFrontmatter(meta, body);

    const changed = before.split('\n')
      .map((line, i) => [line, after.split('\n')[i]])
      .filter(([a, b]) => a !== b);
    expect(changed).toStrictEqual([['stage: draft', 'stage: requirements']]);
    expect(after.split('\n')).toHaveLength(before.split('\n').length);
  });

  test('empty iterations and history are emitted, arrays keep their order, dates stay strings', () => {
    const meta = { repos: ['b', 'a', 'c'], created: '2026-08-26', iterations: {}, history: [] };
    expect(renderFrontmatter(meta, 'x'))
      .toBe('---\nrepos:\n  - b\n  - a\n  - c\ncreated: 2026-08-26\niterations: {}\nhistory: []\n---\nx');
    expect(parseFrontmatter(`${renderFrontmatter(meta, 'x')}\n`).meta).toStrictEqual(meta);
  });

  test('leading blank lines of the body go; nothing else about the body is touched', () => {
    expect(renderFrontmatter({ a: 1 }, '\n\n  x\n\ny')).toBe('---\na: 1\n---\n  x\n\ny');
  });

  test('no trailing newline is added to a body that has none', () => {
    expect(renderFrontmatter({ a: 1 }, 'body')).toBe('---\na: 1\n---\nbody');
  });
});

describe('AC-4 — reading never validates, never rewrites and never reorders', () => {
  test('an unknown key keeps its POSITION, not merely its presence', () => {
    // backlog/Q-0033-…/ticket.md carries `depends_on` between `created` and `iterations`. Running
    // a read through `ticketSchema.parse()` — the schema is a `z.looseObject`, so it preserves that
    // key rather than dropping it — would still return a NEW object with the key moved to the end,
    // and the next write would commit the move.
    const backlog = emptyBacklog();
    const text = FIXTURE.replace('iterations: {}', 'depends_on: Q-0006\niterations: {}');
    const ticket = ticketAt(backlog, 'Q-0001-a-ticket', text);

    expect(Object.keys(ticket.meta)).toStrictEqual([
      'id', 'title', 'stage', 'owner', 'repos', 'branch', 'priority', 'created', 'depends_on',
      'iterations', 'history',
    ]);
    backlog.write(ticket);
    expect(fs.readFileSync(path.join(ticket.dir, 'ticket.md'), 'utf8')).toBe(text);

    ticket.meta.stage = 'green';
    backlog.write(ticket);
    expect(fs.readFileSync(path.join(ticket.dir, 'ticket.md'), 'utf8'))
      .toBe(text.replace('stage: draft', 'stage: green'));
  });

  test('a ticket the schema would reject still reads, exactly as it does today', () => {
    const backlog = emptyBacklog();
    const ticket = ticketAt(backlog, 'Q-0002-odd', FIXTURE.replace('stage: draft', 'stage: shipped'));
    expect(ticket.meta.stage).toBe('shipped');
  });

  test('read reports an absolute dir and the folder basename', () => {
    const backlog = emptyBacklog();
    const ticket = ticketAt(backlog, 'Q-0003-paths', FIXTURE);
    expect(path.isAbsolute(ticket.dir)).toBe(true);
    expect(ticket.dir).toBe(path.join(backlog.root, 'Q-0003-paths'));
    expect(ticket.folder).toBe('Q-0003-paths');
    expect(ticket.body).toBe('# Intent\n\nBody text.\n');
  });
});

describe('AC-5 — Backlog stays Object.create-compatible, because --dry is built on it', () => {
  test('the exact shape of spike/src/engine.js:29-35 still reads, and writes nothing', () => {
    const backlog = emptyBacklog();
    const ticket = ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);
    fs.writeFileSync(path.join(ticket.dir, 'notes.md'), 'note\n');
    const before = walk(backlog.root);

    const readOnly: Backlog = Object.create(backlog, {
      write: { value: () => undefined },
      writeFile: { value: () => '' },
      log: { value: () => undefined },
    });

    expect(readOnly.root).toBe(backlog.root);
    expect(readOnly.read('Q-0001').meta.id).toBe('Q-0001');
    expect(readOnly.list().map((t) => t.folder)).toStrictEqual(['Q-0001-a-ticket']);
    expect(readOnly.dirOf('Q-0001')).toBe(ticket.dir);
    // Q-0080: the backlog here is one Q-0001, so the allocator answers within its prefix. What this
    // test exists to prove — a stubbed Backlog writes nothing — is unaffected by which id it names.
    expect(readOnly.nextId()).toBe('Q-0002');
    expect(readOnly.readFiles(ticket, 'notes.md')).toStrictEqual([{ rel: 'notes.md', text: 'note\n' }]);

    const stubbed = readOnly.read('Q-0001');
    stubbed.meta.stage = 'deployed';
    readOnly.write(stubbed);
    readOnly.writeFile(stubbed, 'dev/x.md', 'x');
    readOnly.log(stubbed, 'nothing happened');

    expect(walk(backlog.root)).toStrictEqual(before);
    expect(fs.readFileSync(path.join(ticket.dir, 'ticket.md'), 'utf8')).toBe(FIXTURE);
  });
});

describe('AC-6 — ticket resolution and listing, including the error text', () => {
  test('resolution by folder name, by id, and the verbatim refusal', () => {
    const backlog = emptyBacklog();
    ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);
    expect(backlog.dirOf('Q-0001-a-ticket')).toBe(path.join(backlog.root, 'Q-0001-a-ticket'));
    expect(backlog.dirOf('Q-0001')).toBe(path.join(backlog.root, 'Q-0001-a-ticket'));
    expect(() => backlog.dirOf('Q-9999')).toThrow('ticket not found: Q-9999');
  });

  test('a backlog root that does not exist refuses rather than crashing, and lists nothing', () => {
    const backlog = missingBacklog();
    expect(backlog.list()).toStrictEqual([]);
    expect(() => backlog.dirOf('Q-0001')).toThrow('ticket not found: Q-0001');
  });

  test('list is non-recursive and needs a ticket.md: files, bare folders and nested ones are out', () => {
    const backlog = emptyBacklog();
    ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);
    write(path.join(backlog.root, 'README.md'), 'not a ticket\n');
    fs.mkdirSync(path.join(backlog.root, 'Q-0002-no-file'), { recursive: true });
    write(path.join(backlog.root, 'archive', 'Q-0003-deep', 'ticket.md'), FIXTURE);

    expect(backlog.list().map((t) => t.folder)).toStrictEqual(['Q-0001-a-ticket']);
  });
});

describe('AC-7 — create() and nextId(), with Q-0038\'s branch-ref defect pinned as it is', () => {
  afterEach(() => { vi.useRealTimers(); });

  /** `create()` reads the clock and the environment; both are controlled here, then restored. */
  function creating<T>(fn: () => T): T {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T09:08:07.000Z'));
    const previous = process.env.USER;
    process.env.USER = 'tester';
    try {
      return fn();
    } finally {
      if (previous === undefined) delete process.env.USER; else process.env.USER = previous;
      vi.useRealTimers();
    }
  }

  test('an empty backlog yields T-0001 and this exact file', () => {
    const backlog = emptyBacklog();
    const ticket = creating(() => backlog.create({ title: 'Port the backlog', intent: '\n  Do the thing.\n\n' }));

    expect(ticket.folder).toBe('T-0001-port-the-backlog');
    expect(fs.readFileSync(path.join(ticket.dir, 'ticket.md'), 'utf8')).toBe([
      '---',
      'id: T-0001',
      'title: Port the backlog',
      'stage: draft',
      // Q-0112: `unknown` while `$USER` is stubbed to `tester` two functions up, which is the
      // point — `core` reads no environment for an identity, and the stub is kept rather than
      // removed so this file demonstrates the ignoring rather than merely not exercising it.
      'owner: unknown',
      'repos: []',
      'branch: harness/T-0001/integration',
      'priority: p2',
      'created: 2026-08-26',
      'iterations: {}',
      'history: []',
      '---',
      'Do the thing.',
      '',
    ].join('\n'));
  });

  test('owner and repos are taken from the caller when given', () => {
    const backlog = emptyBacklog();
    const ticket = creating(() => backlog.create({ title: 'x', intent: 'y', owner: 'someone', repos: ['a', 'b'] }));
    expect(ticket.meta.owner).toBe('someone');
    expect(ticket.meta.repos).toStrictEqual(['a', 'b']);
  });

  test('the slug lowercases, collapses non-alphanumerics, trims hyphens and cuts at 40', () => {
    const backlog = emptyBacklog();
    const cases: [string, string][] = [
      ['  Hello, World! ', 'hello-world'],
      ['///leading and trailing///', 'leading-and-trailing'],
      ['Ünïcødé stays out', 'n-c-d-stays-out'],
      ['A'.repeat(60), 'a'.repeat(40)],
      ['core/backlog — tickets, frontmatter and stages', 'core-backlog-tickets-frontmatter-and-sta'],
    ];
    for (const [title, slug] of cases) {
      const ticket = creating(() => backlog.create({ title, intent: 'i' }));
      expect(ticket.folder.replace(/^T-\d{4}-/, ''), title).toBe(slug);
      fs.rmSync(ticket.dir, { recursive: true, force: true });
    }
  });

  test('nextId counts the ids on disk, so a Q- backlog allocates a Q- id — Q-0080 inverts this pin', () => {
    // This test read `T-0001` over the first two tickets and `T-0008` once a T-0007 joined them,
    // which is the defect Q-0043 carried and Q-0080 fixes. The first half INVERTS. The second half
    // is rewritten rather than kept, because the mixed Q-/T- backlog it built is what the allocator
    // now refuses — what it proved, that the counter works when the prefix matches, is preserved by
    // the T-0006/T-0007 → T-0008 row of the shared table below (Q-0080 AC-10).
    const backlog = emptyBacklog();
    ticketAt(backlog, 'Q-0006-something', FIXTURE.replace('id: Q-0001', 'id: Q-0006'));
    ticketAt(backlog, 'Q-0043-something', FIXTURE.replace('id: Q-0001', 'id: Q-0043'));
    expect(backlog.nextId()).toBe('Q-0044');

    ticketAt(backlog, 'T-0007-something', FIXTURE.replace('id: Q-0001', 'id: T-0007'));
    expect(() => backlog.nextId()).toThrow('the backlog uses more than one prefix — Q- (2), T- (1)');
  });

  test('create writes a branch NAME and makes no ref, no worktree and no second directory', () => {
    // Register row 19: a port that quietly started creating branches would be changing behaviour
    // under cover of a translation. Q-0038 owns the missing ref.
    const backlog = emptyBacklog();
    const ticket = creating(() => backlog.create({ title: 'branchless', intent: 'i' }));
    expect(ticket.meta.branch).toBe('harness/T-0001/integration');
    expect(walk(backlog.root)).toStrictEqual(['T-0001-branchless', 'T-0001-branchless/ticket.md']);
  });
});

describe('Q-0080 — one backlog, one prefix, and an allocator that refuses rather than guessing', () => {
  /** A backlog holding exactly the `[folder, id]` pairs a table row names. */
  const backlogOf = (tickets: readonly (readonly [string, string])[]): Backlog => {
    const backlog = emptyBacklog();
    for (const [folder, id] of tickets) ticketAt(backlog, folder, FIXTURE.replace('id: Q-0001', `id: ${id}`));
    return backlog;
  };

  /** The message a call threw, or `null` when it returned — so a row asserts the WHOLE sentence. */
  function refusal(call: () => unknown): string | null {
    try { call(); return null; } catch (error) { return (error as Error).message; }
  }

  test('AC-2/AC-3/AC-4 — every row of the shared table, and every criterion it claims to cover', () => {
    for (const row of TABLE.rows) {
      const backlog = backlogOf(row.tickets);
      const label = `${row.criterion} — ${row.name}`;
      visited.push(`row: ${label}`);
      if (row.throws === undefined) expect(backlog.nextId(), label).toBe(row.id);
      else expect(refusal(() => backlog.nextId()), label).toBe(row.throws);
    }
    // An identity, not a count: a row silently retitled leaves this red rather than passing on 11.
    expect([...new Set(TABLE.rows.map((row) => row.criterion))].sort())
      .toStrictEqual(['AC-2', 'AC-3', 'AC-4(a)', 'AC-4(b)', 'AC-4(c)']);
  });

  test('AC-1 — one grammar: what shared parses is what harness runs resolves, over one corpus', () => {
    /** The id put back together from its parts, which is `null` exactly when it was not an id. */
    const roundTrip = (value: unknown): string | null => {
      const parts = parseTicketId(value);
      return parts === null ? null : `${parts.prefix}-${String(parts.number).padStart(4, '0')}`;
    };
    for (const id of TABLE.grammar.accepts) {
      visited.push(`accepts: ${id}`, `accepts (run history): ${id}`);
      expect(roundTrip(id), id).toBe(id);
      expect(TICKET_ID_PATTERN.test(id), `${id}: run history agrees`).toBe(true);
    }
    for (const not of TABLE.grammar.rejects) {
      visited.push(`rejects: ${not}`, `rejects (run history): ${not}`);
      expect(roundTrip(not), not).toBeNull();
      expect(TICKET_ID_PATTERN.test(not), `${not}: run history agrees`).toBe(false);
    }
    // A ticket.md the frontmatter reader fell open on carries no id at all, and AC-4(a) counts it.
    expect(roundTrip(undefined)).toBeNull();
    expect(roundTrip(null)).toBeNull();
  });

  test('Q-0107 AC-8 — the move cost the table no row and this file no assertion', () => {
    // Read after the two tests above have run, which is why it is declared after them: `visited`
    // is what they ACTUALLY iterated, not what the file happens to contain. A move that truncated
    // the JSON would leave both loops shorter and both of them green.
    //
    // Two clauses, because a count is not an identity (Q-0073). The first says the labels are the
    // ones the table names; the second says how many there were, pinned at what they were on
    // `d24fb8b` with the file still under `spike/test/`. Losing a row fails the second alone;
    // renaming one fails the first alone.
    const derived = [
      ...TABLE.rows.map((row) => `row: ${row.criterion} — ${row.name}`),
      ...TABLE.grammar.accepts.flatMap((id) => [`accepts: ${id}`, `accepts (run history): ${id}`]),
      ...TABLE.grammar.rejects.flatMap((not) => [`rejects: ${not}`, `rejects (run history): ${not}`]),
    ];
    expect(visited, 'the two loops above visited exactly what the table names').toStrictEqual(derived);
    expect({
      rows: TABLE.rows.length,
      accepts: TABLE.grammar.accepts.length,
      rejects: TABLE.grammar.rejects.length,
      assertions: visited.length,
    }).toStrictEqual(BEFORE_THE_MOVE);
  });

  test('AC-5 — a taken id and an occupied folder are refused, and the refusal writes nothing', () => {
    const backlog = emptyBacklog();
    const taken = FIXTURE.replace('id: Q-0001', 'id: Q-0081');
    const ticket = ticketAt(backlog, 'Q-0081-taken', taken);
    backlog.writeFile(ticket, 'requirements/merged.md', 'merged\n');
    const before = walk(backlog.root);

    expect(refusal(() => backlog.create({ title: 'taken', intent: 'i', id: 'Q-0081' })))
      .toBe('ticket folder already exists: Q-0081-taken');
    expect(refusal(() => backlog.create({ title: 'a different title', intent: 'i', id: 'Q-0081' })))
      .toBe('ticket id already taken: Q-0081 already belongs to Q-0081-taken');

    expect(walk(backlog.root)).toStrictEqual(before);
    expect(fs.readFileSync(path.join(ticket.dir, 'ticket.md'), 'utf8')).toBe(taken);
  });

  test('AC-3/AC-5 — three tickets with one title get three ids and three folders', () => {
    const backlog = emptyBacklog();
    for (const expected of ['T-0001', 'T-0002', 'T-0003']) {
      expect(backlog.create({ title: 'The same title', intent: 'i' }).meta.id).toBe(expected);
    }
    expect(backlog.list().map((t) => t.folder).sort()).toStrictEqual([
      'T-0001-the-same-title', 'T-0002-the-same-title', 'T-0003-the-same-title',
    ]);
    for (const t of backlog.list()) expect(t.body, t.folder).toBe('i\n');
  });

  test('AC-6 — a backlog root that does not exist is still created, ticket folder and all', () => {
    // mkdirSync(dir, { recursive: true }) was doing two jobs. Only one of them was the defect, and
    // no test covered the other: missingBacklog() reached list() and dirOf() and never create().
    const backlog = missingBacklog();
    expect(backlog.create({ title: 'First ticket', intent: 'i' }).folder).toBe('T-0001-first-ticket');
    expect(backlog.read('T-0001').meta.id).toBe('T-0001');
  });

  test('AC-9 — an explicit id supplies the number and skips no check', () => {
    const backlog = backlogOf([['Q-0006-a', 'Q-0006'], ['T-0007-b', 'T-0007']]);
    expect(refusal(() => backlog.nextId())).toContain('more than one prefix');
    // The point of the flag: a backlog allocation refuses is inconvenient, not blocked.
    expect(backlog.create({ title: 'explicit', intent: 'i', id: 'Q-0081' }).meta.id).toBe('Q-0081');
    for (const bad of ['q-1', 'Q-81', 'Q-00081']) {
      expect(refusal(() => backlog.create({ title: 't', intent: 'i', id: bad })), bad)
        .toBe(`not a ticket id: '${bad}' — an id is <PREFIX>-nnnn, like Q-0081`);
    }
    expect(refusal(() => backlog.create({ title: 'again', intent: 'i', id: 'Q-0006' })))
      .toBe('ticket id already taken: Q-0006 already belongs to Q-0006-a');
  });

  // The value is whatever `--id` was given, and the message is one line by contract. Unescaped, a
  // newline splits it into three and the second reads like harness output. Q-0080 review nit.
  test('AC-8 — a control character in a rejected id is escaped, so the refusal stays one line', () => {
    const backlog = backlogOf([]);
    const message = refusal(() => backlog.create({ title: 't', intent: 'i', id: 'Q-0099\nFAKE: injected' }));
    // Asserted rather than defaulted: a create() that did not refuse at all would otherwise read
    // as a one-line message and pass.
    expect(message, 'create must refuse an id the grammar rejects').not.toBeNull();
    expect(message!.split('\n')).toHaveLength(1);
    expect(message!).toContain('\\x0a');
    expect(message!).not.toContain('\nFAKE');
    const ansi = refusal(() => backlog.create({ title: 't', intent: 'i', id: 'Q-0099\u001b[31m' }));
    expect(ansi, 'create must refuse this one too').not.toBeNull();
    expect(ansi!, 'an ANSI escape is the same defect wearing colour').toContain('\\x1b');
    expect(ansi!).not.toContain('\u001b');
  });

  test('AC-7 — reading is untouched: a mixed, partly unreadable backlog still lists and reads', () => {
    const backlog = backlogOf([['Q-0006-a', 'Q-0006'], ['T-0007-b', 'T-0007'], ['damaged-x', 'not-an-id']]);
    expect(backlog.list().map((t) => t.folder).sort()).toStrictEqual(['Q-0006-a', 'T-0007-b', 'damaged-x']);
    expect(backlog.read('Q-0006').meta.id).toBe('Q-0006');
    expect(backlog.read('damaged-x').meta.id).toBe('not-an-id');
    expect(() => backlog.dirOf('Q-9999')).toThrow('ticket not found: Q-9999');
  });
});

describe('AC-8 — the three write paths write what they wrote, and nothing else on disk changes', () => {
  test('write replaces ticket.md and touches no other path', () => {
    const backlog = emptyBacklog();
    const ticket = ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);
    write(path.join(ticket.dir, 'requirements', 'merged.md'), 'merged\n');
    const before = walk(backlog.root);

    ticket.meta.stage = 'green';
    backlog.write(ticket);

    expect(walk(backlog.root)).toStrictEqual(before);
    expect(fs.readFileSync(path.join(ticket.dir, 'requirements', 'merged.md'), 'utf8')).toBe('merged\n');
    expect(fs.readFileSync(path.join(ticket.dir, 'ticket.md'), 'utf8'))
      .toBe(FIXTURE.replace('stage: draft', 'stage: green'));
  });

  test('writeFile creates parents, returns the absolute path, and adds a newline only if missing', () => {
    const backlog = emptyBacklog();
    const ticket = ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);

    const abs = backlog.writeFile(ticket, 'dev/deep/report.md', 'no newline');
    expect(abs).toBe(path.join(ticket.dir, 'dev', 'deep', 'report.md'));
    expect(fs.readFileSync(abs, 'utf8')).toBe('no newline\n');

    expect(fs.readFileSync(backlog.writeFile(ticket, 'dev/two.md', 'has one\n'), 'utf8')).toBe('has one\n');
    expect(fs.readFileSync(backlog.writeFile(ticket, 'dev/three.md', 'trailing\n\n'), 'utf8')).toBe('trailing\n\n');
  });

  test('log appends timestamped lines and never rewrites one', () => {
    const backlog = emptyBacklog();
    const ticket = ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);
    backlog.log(ticket, 'run=1 flow=chore start stage=requirements');
    const first = fs.readFileSync(path.join(ticket.dir, 'runs.log'), 'utf8');
    backlog.log(ticket, 'run=1 completed stage=requirements→reviewed');

    const lines = fs.readFileSync(path.join(ticket.dir, 'runs.log'), 'utf8').split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe('');
    expect(`${lines[0]}\n`).toBe(first);
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z run=1 flow=chore start stage=requirements$/);
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z run=1 completed stage=requirements→reviewed$/);
  });

  test('every read path changes nothing at all', () => {
    const backlog = emptyBacklog();
    const ticket = ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);
    write(path.join(ticket.dir, 'dev', 'a.md'), 'a\n');
    const before = walk(backlog.root);

    backlog.list();
    backlog.dirOf('Q-0001');
    backlog.read('Q-0001');
    backlog.readFiles(ticket, 'dev/');
    backlog.nextId();

    expect(walk(backlog.root)).toStrictEqual(before);
  });
});

describe('AC-9 — readFiles keeps its glob semantics exactly', () => {
  function withArtifacts(): { backlog: Backlog; ticket: TicketRecord } {
    const backlog = emptyBacklog();
    const ticket = ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);
    // Written in reverse order on purpose, so the sort below is doing work rather than agreeing
    // with the order the directory happens to hold.
    write(path.join(ticket.dir, 'requirements', 'candidate-codex.md'), 'codex\n');
    write(path.join(ticket.dir, 'requirements', 'candidate-claude.md'), 'claude\n');
    write(path.join(ticket.dir, 'requirements', 'merged.md'), 'merged\n');
    write(path.join(ticket.dir, 'dev', 'notes.md'), 'notes\n');
    write(path.join(ticket.dir, 'dev', 'deep', 'more.md'), 'more\n');
    return { backlog, ticket };
  }

  test('a literal filename matches itself', () => {
    const { backlog, ticket } = withArtifacts();
    expect(backlog.readFiles(ticket, 'requirements/merged.md'))
      .toStrictEqual([{ rel: path.join('requirements', 'merged.md'), text: 'merged\n' }]);
  });

  test('* is the only wildcard, and results are sorted by basename', () => {
    const { backlog, ticket } = withArtifacts();
    expect(backlog.readFiles(ticket, 'requirements/candidate-*.md')).toStrictEqual([
      { rel: path.join('requirements', 'candidate-claude.md'), text: 'claude\n' },
      { rel: path.join('requirements', 'candidate-codex.md'), text: 'codex\n' },
    ]);
  });

  test('? is escaped: it matches a literal question mark and not any character', () => {
    const { backlog, ticket } = withArtifacts();
    expect(backlog.readFiles(ticket, 'requirements/merged?md')).toStrictEqual([]);
    write(path.join(ticket.dir, 'requirements', 'odd?name.md'), 'odd\n');
    expect(backlog.readFiles(ticket, 'requirements/odd?name.md'))
      .toStrictEqual([{ rel: path.join('requirements', 'odd?name.md'), text: 'odd\n' }]);
  });

  test('the other regex metacharacters match literally too', () => {
    const { backlog, ticket } = withArtifacts();
    const literal = 'a+b^c$d{e}f(g)h|i[j]k.md';
    write(path.join(ticket.dir, 'requirements', literal), 'literal\n');
    expect(backlog.readFiles(ticket, `requirements/${literal}`))
      .toStrictEqual([{ rel: path.join('requirements', literal), text: 'literal\n' }]);
  });

  test('a pattern ending in / walks the subtree, nested files included', () => {
    const { backlog, ticket } = withArtifacts();
    const found = backlog.readFiles(ticket, 'dev/');
    expect(found.map((f) => f.rel).sort()).toStrictEqual([path.join('dev', 'deep', 'more.md'), path.join('dev', 'notes.md')]);
    expect(found.map((f) => f.text).sort()).toStrictEqual(['more\n', 'notes\n']);
  });

  test('no match is empty, and so is a directory that is not there', () => {
    const { backlog, ticket } = withArtifacts();
    expect(backlog.readFiles(ticket, 'requirements/nothing-*.md')).toStrictEqual([]);
    expect(backlog.readFiles(ticket, 'solution/contracts.md')).toStrictEqual([]);
    expect(backlog.readFiles(ticket, 'solution/')).toStrictEqual([]);
  });
});

// Q-0059: the store reads and writes inside its own root, and nowhere else.
//
// Every guard below carries its own BENIGN twin. A confinement guard is the easiest thing in this
// repository to ship green and useless, because a guard that refuses everything passes every
// negative test ever written — so each case that must be refused sits beside one that must still be
// accepted. AC-7 is not a describe of its own: what it asks for is that the AC-8 and AC-9 blocks
// above pass UNEDITED, which is a property of this file rather than a new assertion.

/**
 * A backlog root two levels below the temporary directory, so a fixture can sit genuinely outside
 * it and still inside the tree `removeTempDirs` deletes — a symlink left in the system temporary
 * directory is litter the next ticket inherits (the shape `run-history/reader.test.ts` uses).
 */
function nestedBacklog(): Backlog {
  const root = path.join(tempDir('confine-'), 'repo', 'backlog');
  fs.mkdirSync(root, { recursive: true });
  return new Backlog(root);
}

/** A directory outside `backlog.root`, and still inside what `removeTempDirs` deletes. */
function outsideOf(backlog: Backlog, name: string): string {
  const dir = path.join(path.dirname(path.dirname(backlog.root)), name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Whether this filesystem lets a fixture stage a symlink at all, and what it said if not.
 *
 * A test may skip only when the OPERATING SYSTEM refuses to create the link, never when the
 * implementation rejects the input, and the skip names what could not be staged. An unconditional
 * test of an environment capability is a verdict about the machine — see *"A test's verdict is a
 * property of the commit, not of the checkout or the account"* (2026-08-30) and Q-0105's GO-3.
 */
const NO_SYMLINKS: string | null = (() => {
  const dir = tempDir('symlink-probe-');
  try {
    fs.symlinkSync(path.join(dir, 'target'), path.join(dir, 'link'));
    return null;
  } catch (error) {
    return `this filesystem refuses to stage a symlink: ${(error as Error).message}`;
  }
})();

/** The message a call threw, or `null` when it returned — so a case asserts the WHOLE sentence. */
function refused(call: () => unknown): string | null {
  try { call(); return null; } catch (error) { return (error as Error).message; }
}

describe('Q-0059 AC-2 — a token that is not one name is refused on the string alone', () => {
  test('the six shapes are refused, each naming the condition and no remedy', () => {
    const backlog = nestedBacklog();
    ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);
    for (const token of ['', '.', '..', '../secret', 'a/b', '/etc', 'Q-0001/']) {
      expect(refused(() => backlog.dirOf(token)), token)
        .toBe(`not a ticket token: '${token}' — a ticket is one folder directly under the backlog root`);
    }
  });

  test('and a control character in the refused token is escaped, so the refusal stays one line', () => {
    // The token is attacker-controlled and the message is one line by contract — Q-0080's reviewer's
    // nit, inherited here by construction rather than by remembering, since every quoted value in
    // this module goes through the same helper.
    const backlog = nestedBacklog();
    const message = refused(() => backlog.dirOf('../Q-0001\nFAKE: injected'));
    expect(message, 'dirOf must refuse a token that is not one name').not.toBeNull();
    expect(message!.split('\n')).toHaveLength(1);
    expect(message!).toContain('\\x0a');
    expect(message!).not.toContain('\nFAKE');
  });

  test('and refused before the filesystem is touched at all', () => {
    // AC-2's other half: the refusal is decided on the string, so it discloses nothing and costs
    // nothing. Asserted on the calls rather than on the message, because a guard that runs after a
    // `readdirSync` produces the same sentence and is a different fix.
    const backlog = nestedBacklog();
    const spies = (['existsSync', 'readdirSync', 'realpathSync', 'statSync'] as const)
      .map((api) => vi.spyOn(fs, api));
    try {
      expect(refused(() => backlog.dirOf('../secret'))).toContain('not a ticket token');
      for (const spy of spies) expect(spy, `dirOf reached fs.${spy.getMockName()}`).not.toHaveBeenCalled();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });

  test('twin — a token that reaches the PREFIX branch still resolves', () => {
    // That branch is guarded too, so it needs a case proving the guard admits its own subject.
    const backlog = nestedBacklog();
    ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);
    expect(backlog.dirOf('Q-0001')).toBe(path.join(backlog.root, 'Q-0001-a-ticket'));
    expect(backlog.read('Q-0001').meta.id).toBe('Q-0001');
  });

  test('a file named like a ticket is not a ticket folder — a named behaviour change', () => {
    // Stated rather than left to be discovered. `existsSync` used to admit it, and `read` then
    // died on ENOTDIR one line later; the same predicate now answers dirOf and AC-5's record check,
    // so a value the store would refuse to write to is not one it hands out either.
    const backlog = nestedBacklog();
    write(path.join(backlog.root, 'Q-0002'), 'not a folder\n');
    expect(refused(() => backlog.dirOf('Q-0002'))).toBe('ticket not found: Q-0002');
  });
});

describe('Q-0059 AC-3 — a name that resolves outside the root is refused, symlink included', () => {
  test('a single-segment symlink pointing OUT of the backlog root is refused', (ctx) => {
    if (NO_SYMLINKS) ctx.skip(NO_SYMLINKS);
    const backlog = nestedBacklog();
    ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);
    const secret = outsideOf(backlog, 'secret');
    write(path.join(secret, 'ticket.md'), FIXTURE.replace('id: Q-0001', 'id: SECRET-0001'));
    fs.symlinkSync(secret, path.join(backlog.root, 'Q-0009-alias'));

    // Every lexical clause passes, and the answer is still a refusal.
    const token = 'Q-0009-alias';
    expect(token).toBe(path.basename(token));
    expect(fs.statSync(path.join(backlog.root, token)).isDirectory(), 'statSync follows the link').toBe(true);
    expect(refused(() => backlog.dirOf(token))).toBe(`ticket not found: ${token}`);
    // And it discloses nothing about where the link pointed.
    expect(refused(() => backlog.read(token))).toBe(`ticket not found: ${token}`);
    expect(backlog.list().map((t) => String(t.meta.id))).not.toContain('SECRET-0001');
  });

  test('twin — a symlink pointing at a SIBLING ticket folder is an alias, and is accepted', (ctx) => {
    if (NO_SYMLINKS) ctx.skip(NO_SYMLINKS);
    // It resolves to a path whose real parent IS the real root, so it is inside the boundary and
    // the rule admits it with no special case. A write through it writes the sibling's own
    // `ticket.md`, to the same bytes in the same folder — the answer reader.test.ts already pins
    // for run history.
    const backlog = nestedBacklog();
    const ticket = ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);
    fs.symlinkSync(ticket.dir, path.join(backlog.root, 'Q-0001-alias'));

    // The JOINED path, not the resolved one — OQ-2, and the divergence from run history's guard.
    expect(backlog.dirOf('Q-0001-alias')).toBe(path.join(backlog.root, 'Q-0001-alias'));
    const through = backlog.read('Q-0001-alias');
    expect(through.meta.id).toBe('Q-0001');
    through.meta.stage = 'green';
    backlog.write(through);
    expect(fs.readFileSync(path.join(ticket.dir, 'ticket.md'), 'utf8'))
      .toBe(FIXTURE.replace('stage: draft', 'stage: green'));
  });

  test('twin — a backlog root reached THROUGH a symlink still accepts its own children', (ctx) => {
    if (NO_SYMLINKS) ctx.skip(NO_SYMLINKS);
    // The over-refusal a half-resolved comparison produces, on the shape this repository's own
    // fixtures have: `os.tmpdir()` is `/var/folders/…` on macOS and `/private/var/…` resolved.
    const real = nestedBacklog();
    ticketAt(real, 'Q-0001-a-ticket', FIXTURE);
    const aliased = path.join(outsideOf(real, 'aliases'), 'backlog');
    fs.symlinkSync(real.root, aliased);
    const backlog = new Backlog(aliased);

    expect(backlog.dirOf('Q-0001')).toBe(path.join(aliased, 'Q-0001-a-ticket'));
    expect(backlog.read('Q-0001').meta.id).toBe('Q-0001');
    expect(backlog.readFiles(backlog.read('Q-0001'), 'ticket.md').map((f) => f.rel)).toStrictEqual(['ticket.md']);
    expect(refused(() => backlog.dirOf('..'))).toContain('not a ticket token');
  });

  test('a sibling-named root is not this root: /x/backlog-old is outside /x/backlog', () => {
    // R-5, and the reason the comparison is between path components rather than string prefixes.
    // No symlink is needed to stage it, which is why it sits outside the three cases above.
    const backlog = nestedBacklog();
    const older = new Backlog(`${backlog.root}-old`);
    ticketAt(older, 'Q-0001-a-ticket', FIXTURE);
    const foreign = older.read('Q-0001');

    expect(refused(() => backlog.write(foreign)))
      .toBe(`not a ticket folder in this backlog: '${foreign.dir}'`);
    expect(older.read('Q-0001').meta.id, 'and the foreign backlog is untouched').toBe('Q-0001');
  });
});

describe('Q-0059 AC-5 — every method taking a record verifies the record\'s folder', () => {
  /** A record whose `dir` is whatever the caller says, which is all a plain interface guarantees. */
  const forged = (ticket: TicketRecord, dir: string): TicketRecord => ({ ...ticket, dir });

  /** Each of the four, refused, with the tree on BOTH sides of the boundary snapshotted around it. */
  function refusesAll(backlog: Backlog, record: TicketRecord, outside: string): void {
    const before = { root: walk(backlog.root), outside: walk(outside) };
    const sentence = `not a ticket folder in this backlog: '${record.dir}'`;
    expect(refused(() => backlog.write(record)), 'write').toBe(sentence);
    expect(refused(() => backlog.writeFile(record, 'dev/note.md', 'x')), 'writeFile').toBe(sentence);
    expect(refused(() => backlog.readFiles(record, 'ticket.md')), 'readFiles').toBe(sentence);
    expect(refused(() => backlog.log(record, 'run=1 start')), 'log').toBe(sentence);
    // R-3: the criterion is that nothing happened, not that the call threw.
    expect(walk(backlog.root), 'the backlog root').toStrictEqual(before.root);
    expect(walk(outside), 'the tree outside it').toStrictEqual(before.outside);
  }

  test('a record pointing outside the root is refused by all four, and nothing moves', () => {
    const backlog = nestedBacklog();
    const ticket = ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);
    const outside = outsideOf(backlog, 'elsewhere');
    write(path.join(outside, 'ticket.md'), FIXTURE);
    refusesAll(backlog, forged(ticket, outside), outside);
  });

  test('a record pointing through an ESCAPING symlink is refused by all four too', (ctx) => {
    if (NO_SYMLINKS) ctx.skip(NO_SYMLINKS);
    const backlog = nestedBacklog();
    const ticket = ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);
    const outside = outsideOf(backlog, 'elsewhere');
    write(path.join(outside, 'ticket.md'), FIXTURE);
    fs.symlinkSync(outside, path.join(backlog.root, 'Q-0009-alias'));
    refusesAll(backlog, forged(ticket, path.join(backlog.root, 'Q-0009-alias')), outside);
  });

  test('twin — every record read, list and create produce is accepted by all four', () => {
    const backlog = nestedBacklog();
    ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);
    const records = [backlog.read('Q-0001'), backlog.list()[0], backlog.create({ title: 'made here', intent: 'i' })];
    for (const record of records) {
      backlog.write(record);
      expect(backlog.writeFile(record, 'dev/note.md', 'x')).toBe(path.join(record.dir, 'dev', 'note.md'));
      expect(backlog.readFiles(record, 'dev/note.md').map((f) => f.text)).toStrictEqual(['x\n']);
      backlog.log(record, 'run=1 start');
      expect(fs.existsSync(path.join(record.dir, 'runs.log')), record.folder).toBe(true);
    }
  });
});

describe('Q-0059 AC-6 — a destination or a pattern outside the ticket folder is refused', () => {
  /** A ticket with the artifacts a shipped flow would have written into it. */
  function withArtifacts(): { backlog: Backlog; ticket: TicketRecord; outside: string } {
    const backlog = nestedBacklog();
    const ticket = ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);
    write(path.join(ticket.dir, 'requirements', 'candidate-claude.md'), 'claude\n');
    write(path.join(ticket.dir, 'dev', 'notes.md'), 'notes\n');
    const outside = outsideOf(backlog, 'elsewhere');
    write(path.join(outside, 'secret.md'), 'secret\n');
    return { backlog, ticket, outside };
  }

  test('writeFile refuses a climbing or absolute destination, and creates no directory', () => {
    const { backlog, ticket, outside } = withArtifacts();
    const before = { root: walk(backlog.root), outside: walk(outside) };
    for (const rel of ['', '../escape.md', '../../etc/passwd', 'dev/../../escape.md', '/etc/passwd']) {
      expect(refused(() => backlog.writeFile(ticket, rel, 'x')), rel)
        .toBe(`not a path inside the ticket folder: '${rel}'`);
    }
    expect(walk(backlog.root)).toStrictEqual(before.root);
    expect(walk(outside)).toStrictEqual(before.outside);
  });

  test('readFiles refuses a climbing or absolute pattern rather than answering []', () => {
    // The ruling: `[]` is what a legitimately absent directory answers, so returning it here would
    // shrink an agent's prompt with nothing going red.
    const { backlog, ticket } = withArtifacts();
    for (const pattern of ['', '.', '../', '../*.md', '../elsewhere/', '/etc/']) {
      expect(refused(() => backlog.readFiles(ticket, pattern)), pattern)
        .toBe(`not a path inside the ticket folder: '${pattern}'`);
    }
  });

  test('a symlinked subdirectory pointing OUT is refused by both, on both readFiles branches', (ctx) => {
    if (NO_SYMLINKS) ctx.skip(NO_SYMLINKS);
    // The clause a lexical comparison cannot make: every one of these is lexically inside the ticket
    // folder, and the deepest existing ancestor of each resolves outside it.
    const { backlog, ticket, outside } = withArtifacts();
    fs.symlinkSync(outside, path.join(ticket.dir, 'out'));
    const before = walk(outside);
    for (const rel of ['out/x.md', 'out/deeper/x.md']) {
      expect(refused(() => backlog.writeFile(ticket, rel, 'x')), rel)
        .toBe(`not a path inside the ticket folder: '${rel}'`);
    }
    for (const pattern of ['out/*.md', 'out/']) {
      expect(refused(() => backlog.readFiles(ticket, pattern)), pattern)
        .toBe(`not a path inside the ticket folder: '${pattern}'`);
    }
    expect(walk(outside), 'nothing was written through the link').toStrictEqual(before);
  });

  test('twin — every shape the shipped flows write still works, parents and all', () => {
    const { backlog, ticket } = withArtifacts();
    for (const rel of ['dev/rounds/x.md', 'review/chore/run-2/chore-iter-1.md', '.harness/run-1/verdict.json']) {
      expect(fs.readFileSync(backlog.writeFile(ticket, rel, 'body'), 'utf8'), rel).toBe('body\n');
    }
    expect(backlog.readFiles(ticket, 'requirements/candidate-*.md').map((f) => f.text)).toStrictEqual(['claude\n']);
    expect(backlog.readFiles(ticket, 'dev/').map((f) => f.rel).sort())
      .toStrictEqual([path.join('dev', 'notes.md'), path.join('dev', 'rounds', 'x.md')]);
    expect(backlog.readFiles(ticket, 'solution/contracts.md'), 'an absent directory is still []').toStrictEqual([]);
  });

  test('twin — a symlinked subdirectory pointing INSIDE the ticket folder is written through', (ctx) => {
    if (NO_SYMLINKS) ctx.skip(NO_SYMLINKS);
    const { backlog, ticket } = withArtifacts();
    fs.symlinkSync(path.join(ticket.dir, 'dev'), path.join(ticket.dir, 'alias'));
    expect(backlog.writeFile(ticket, 'alias/through.md', 'body')).toBe(path.join(ticket.dir, 'alias', 'through.md'));
    expect(fs.readFileSync(path.join(ticket.dir, 'dev', 'through.md'), 'utf8')).toBe('body\n');
    expect(backlog.readFiles(ticket, 'alias/notes.md').map((f) => f.text)).toStrictEqual(['notes\n']);
  });
});

describe('Q-0059 AC-10 — the guard refuses nothing this product ships', () => {
  /** Every `write:`, `writes:` and `input.backlog` value a flow file declares, at any depth. */
  function declaredPaths(document: unknown): string[] {
    if (Array.isArray(document)) return document.flatMap(declaredPaths);
    if (document === null || typeof document !== 'object') return [];
    const node = document as Record<string, unknown>;
    const here: string[] = [];
    if (typeof node.write === 'string') here.push(node.write);
    if (Array.isArray(node.writes)) here.push(...node.writes.filter((v): v is string => typeof v === 'string'));
    const input = node.input as Record<string, unknown> | undefined;
    if (Array.isArray(input?.backlog)) here.push(...input.backlog.filter((v): v is string => typeof v === 'string'));
    return [...here, ...Object.values(node).flatMap(declaredPaths)];
  }

  /** The values, READ from the files rather than transcribed, so a flow added later is covered. */
  function shippedPaths(): { file: string; value: string }[] {
    const found: { file: string; value: string }[] = [];
    for (const relative of ['harness/flows', 'packages/cli/templates/harness/flows']) {
      const flowsDir = path.join(repoRoot, relative);
      const files = fs.readdirSync(flowsDir).filter((name) => name.endsWith('.yaml'));
      if (!files.length) throw new Error(`corpus missing: ${relative} holds no flow — this check proves nothing without one`);
      for (const name of files) {
        const values = declaredPaths(YAML.parse(fs.readFileSync(path.join(flowsDir, name), 'utf8')));
        if (!values.length) throw new Error(`${relative}/${name} declares no write path or backlog input — the extraction has lost its subject`);
        for (const value of values) found.push({ file: `${relative}/${name}`, value });
      }
    }
    return found;
  }

  test('every write path and backlog glob the six flows declare, in both copies, is accepted', () => {
    const backlog = nestedBacklog();
    const ticket = ticketAt(backlog, 'Q-0001-a-ticket', FIXTURE);
    const refusals = shippedPaths()
      .filter(({ value }) => refused(() => backlog.readFiles(ticket, value)) !== null
        || refused(() => backlog.writeFile(ticket, value, 'x')) !== null)
      .map(({ file, value }) => `${file}: ${value}`);
    expect(refusals, 'the guard refuses a path this product ships').toStrictEqual([]);
  });
});
