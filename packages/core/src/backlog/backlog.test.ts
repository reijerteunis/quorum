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
import { YAMLParseError } from 'yaml';

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
 * The allocation table, READ rather than transcribed. `spike/test/q0080-allocation.js` drives the
 * same rows through the spike's own `Backlog`, and the spike is what runs every flow in this
 * repository today — a fix that lands in `core` alone passes here and leaves that tree handing out
 * `T-0001`. Two copies of a table drift; there is one (Q-0080 AC-11).
 */
const TABLE = JSON.parse(repoFile('spike/test/q0080-allocation.json')) as {
  rows: AllocationRow[];
  grammar: { accepts: string[]; rejects: string[] };
};

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
      'owner: tester',
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
      expect(roundTrip(id), id).toBe(id);
      expect(TICKET_ID_PATTERN.test(id), `${id}: run history agrees`).toBe(true);
    }
    for (const not of TABLE.grammar.rejects) {
      expect(roundTrip(not), not).toBeNull();
      expect(TICKET_ID_PATTERN.test(not), `${not}: run history agrees`).toBe(false);
    }
    // A ticket.md the frontmatter reader fell open on carries no id at all, and AC-4(a) counts it.
    expect(roundTrip(undefined)).toBeNull();
    expect(roundTrip(null)).toBeNull();
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
