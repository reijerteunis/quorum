// Q-0080: `harness ticket new` allocates the id that follows the backlog it is standing in, and
// refuses rather than answering when it cannot read one.
//
// The defect was not "a fresh repository collides" — a fresh repository allocates T-0001, and the
// next invocation reads that back and allocates T-0002, which smoke.js has always executed. It was
// that a backlog whose ids the allocator cannot parse was read as EMPTY: fifty-three tickets on
// disk, none of them counted, T-0001 handed out every time, and create() then replacing the folder
// it collided with. So every fixture here that must fail carries ids that are not `T-`.
//
// The table below is not written here: q0080-allocation.json is the one copy, and
// packages/core/src/backlog/backlog.test.ts asserts the same rows. A fix in one tree alone passes
// its own suite while the other — the tree that actually runs every flow in this repository today
// — keeps handing out T-0001.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Backlog, parseTicketId } from '../src/backlog.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', 'bin', 'harness.js');
const TABLE = JSON.parse(fs.readFileSync(path.join(here, 'q0080-allocation.json'), 'utf8'));

let failed = 0;
const scenario = (id, title, fn) => {
  try { fn(); console.log(`✓ ${id} — ${title}`); }
  catch (e) { failed++; console.error(`✗ ${id} — ${title}\n  ${String(e.message).split('\n').slice(0, 8).join('\n  ')}`); }
};

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), `q0080-${prefix}`));

/** A ticket.md with the id the caller names, so a fixture controls what the allocator reads. */
const FIXTURE = (id) => [
  '---', `id: ${id}`, 'title: A ticket', 'stage: draft', 'owner: qa', 'repos: []',
  `branch: harness/${id}/integration`, 'priority: p2', 'created: 2026-08-30',
  'iterations: {}', 'history: []', '---', 'Body.', '',
].join('\n');

/** A backlog root holding exactly the `[folder, id]` pairs given. */
function backlogOf(tickets) {
  const root = tmp('backlog-');
  for (const [folder, id] of tickets) {
    fs.mkdirSync(path.join(root, folder), { recursive: true });
    fs.writeFileSync(path.join(root, folder, 'ticket.md'), FIXTURE(id));
  }
  return new Backlog(root);
}

/** Every path under `dir`, relative and sorted — the shape a refusal must leave untouched. */
function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    out.push(path.relative(base, full));
    if (entry.isDirectory()) walk(full, base, out);
  }
  return out;
}

/** A project `harness init` made, in its own git repository, with an empty backlog. */
function project() {
  const dir = tmp('project-');
  execSync('git init -q && git -c user.email=q@a -c user.name=qa commit -q --allow-empty -m init', { cwd: dir });
  const r = spawnSync(process.execPath, [bin, 'init'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, `harness init failed: ${r.stderr}`);
  return dir;
}

const cli = (dir, ...args) => spawnSync(process.execPath, [bin, ...args, '--project', dir], { cwd: dir, encoding: 'utf8' });
const folders = (dir) => fs.readdirSync(path.join(dir, 'backlog')).sort();

console.log('q0080 ticket-id allocation');

scenario('A1', 'AC-1 — the grammar accepts an id of any prefix and rejects every near miss', () => {
  for (const id of TABLE.grammar.accepts) {
    const parsed = parseTicketId(id);
    assert.ok(parsed, `${id} is a ticket id`);
    assert.equal(`${parsed.prefix}-${String(parsed.number).padStart(4, '0')}`, id, `${id} round-trips`);
  }
  for (const not of TABLE.grammar.rejects) assert.equal(parseTicketId(not), null, `${not} is not a ticket id`);
  // Not a string is not an error: a ticket.md the frontmatter reader falls open on has no id.
  assert.equal(parseTicketId(undefined), null, 'undefined is not a ticket id');
  assert.equal(parseTicketId(null), null, 'null is not a ticket id');
});

scenario('A2', 'AC-1 — the spike holds one spelling of the grammar, and the CLI is not a second', () => {
  // The shape rather than a fixed transcription: a character class of letters and one of digits on
  // the same line is what a second copy of this grammar looks like however it is punctuated.
  const GRAMMAR = /\[A-Z\][^\n]*\[0-9\]/;
  const cliSource = fs.readFileSync(bin, 'utf8');
  assert.equal(GRAMMAR.test(cliSource), false, 'spike/bin/harness.js must not spell the grammar again');
  assert.ok(/import \{[^}]*parseTicketId[^}]*\} from '\.\.\/src\/backlog\.js'/.test(cliSource),
    'the CLI resolves a ticket id through the one spelling');
  const source = fs.readFileSync(path.join(here, '..', 'src', 'backlog.js'), 'utf8');
  assert.equal((source.match(new RegExp(GRAMMAR.source, 'g')) ?? []).length, 1, 'and backlog.js spells it exactly once');
});

scenario('A3', 'AC-2/AC-3/AC-4 — every row of the shared table, over nextId()', () => {
  for (const row of TABLE.rows) {
    const backlog = backlogOf(row.tickets);
    if (row.throws === undefined) {
      assert.equal(backlog.nextId(), row.id, `${row.criterion} — ${row.name}`);
    } else {
      assert.throws(() => backlog.nextId(), (e) => e.message === row.throws, `${row.criterion} — ${row.name}`);
    }
  }
  // An identity, not a count: a row silently retitled leaves this red rather than passing on 11.
  assert.deepEqual([...new Set(TABLE.rows.map((row) => row.criterion))].sort(),
    ['AC-2', 'AC-3', 'AC-4(a)', 'AC-4(b)', 'AC-4(c)'], 'the table covers every criterion it claims');
});

scenario('A4', 'AC-5 — a refusal names what it hit and leaves the backlog byte for byte as it was', () => {
  const backlog = backlogOf([['Q-0081-taken', 'Q-0081']]);
  const before = walk(backlog.root);

  assert.throws(() => backlog.create({ title: 'taken', intent: 'i', id: 'Q-0081' }),
    (e) => e.message === 'ticket folder already exists: Q-0081-taken');
  assert.throws(() => backlog.create({ title: 'a different title', intent: 'i', id: 'Q-0081' }),
    (e) => e.message === 'ticket id already taken: Q-0081 already belongs to Q-0081-taken');

  assert.deepEqual(walk(backlog.root), before, 'a refusal wrote nothing');
  assert.equal(fs.readFileSync(path.join(backlog.root, 'Q-0081-taken', 'ticket.md'), 'utf8'), FIXTURE('Q-0081'));
});

scenario('A5', 'AC-6 — a backlog root that does not exist is created, ticket folder and all', () => {
  const backlog = new Backlog(path.join(tmp('missing-'), 'no-backlog-here'));
  const ticket = backlog.create({ title: 'First ticket', intent: 'i', owner: 'qa' });
  assert.equal(ticket.folder, 'T-0001-first-ticket');
  assert.equal(backlog.read('T-0001').meta.id, 'T-0001');
});

scenario('A6', 'AC-9 — an explicit id goes through every check and skips none', () => {
  const backlog = backlogOf([]);
  assert.equal(backlog.create({ title: 'explicit', intent: 'i', id: 'Q-0081' }).meta.id, 'Q-0081');
  for (const bad of ['q-1', 'Q-81', 'Q-00081']) {
    assert.throws(() => backlog.create({ title: 't', intent: 'i', id: bad }),
      (e) => e.message === `not a ticket id: '${bad}' — an id is <PREFIX>-nnnn, like Q-0081`, bad);
  }
});

scenario('A7', 'AC-3 — init then three ticket new gives T-0001, T-0002, T-0003, each its own folder', () => {
  const dir = project();
  for (const expected of ['T-0001', 'T-0002', 'T-0003']) {
    const r = cli(dir, 'ticket', 'new', 'The same title', '--intent', 'i');
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes(expected), `${expected}: ${r.stdout}`);
  }
  assert.deepEqual(folders(dir), ['T-0001-the-same-title', 'T-0002-the-same-title', 'T-0003-the-same-title']);
  for (const folder of folders(dir)) {
    assert.ok(fs.existsSync(path.join(dir, 'backlog', folder, 'ticket.md')), `${folder} kept its ticket.md`);
  }
});

scenario('A8', 'AC-8 — a refusal is one line and exit 1, never a stack trace', () => {
  const dir = project();
  assert.equal(cli(dir, 'ticket', 'new', 'First', '--intent', 'i', '--id', 'Q-0006').status, 0);
  assert.equal(cli(dir, 'ticket', 'new', 'Second', '--intent', 'i', '--id', 'T-0007').status, 0);

  const mixed = cli(dir, 'ticket', 'new', 'Third', '--intent', 'i');
  assert.equal(mixed.status, 1, 'a backlog it cannot read refuses');
  assert.ok(mixed.stderr.includes('the backlog uses more than one prefix — Q- (1), T- (1)'), mixed.stderr);
  assert.ok(mixed.stderr.includes('pass --id <ID> or reconcile the backlog'), mixed.stderr);
  assert.equal(mixed.stderr.includes('\n    at '), false, 'a stack trace tells an adopter the product crashed');

  const collision = cli(dir, 'ticket', 'new', 'Anything', '--intent', 'i', '--id', 'Q-0006');
  assert.equal(collision.status, 1);
  assert.ok(collision.stderr.includes('ticket id already taken: Q-0006 already belongs to Q-0006-first'), collision.stderr);
  assert.equal(collision.stderr.includes('\n    at '), false);

  const bad = cli(dir, 'ticket', 'new', 'Anything', '--intent', 'i', '--id', 'q-1');
  assert.equal(bad.status, 1);
  assert.ok(bad.stderr.includes("not a ticket id: 'q-1'"), bad.stderr);
  assert.equal(bad.stderr.includes('\n    at '), false);

  // The escape hatch is what makes a refusal survivable rather than a dead end.
  assert.equal(cli(dir, 'ticket', 'new', 'Fourth', '--intent', 'i', '--id', 'Q-0081').status, 0);
  assert.deepEqual(folders(dir), ['Q-0006-first', 'Q-0081-fourth', 'T-0007-second']);
});

scenario('A9', 'AC-7 — reading is untouched over the mixed backlog allocation refuses', () => {
  const dir = project();
  assert.equal(cli(dir, 'ticket', 'new', 'First', '--intent', 'i', '--id', 'Q-0006').status, 0);
  assert.equal(cli(dir, 'ticket', 'new', 'Second', '--intent', 'i', '--id', 'T-0007').status, 0);

  const board = cli(dir, 'board');
  assert.equal(board.status, 0, board.stderr);
  assert.ok(board.stdout.includes('Q-0006') && board.stdout.includes('T-0007'), board.stdout);

  const runs = cli(dir, 'runs', 'Q-0006');
  assert.equal(runs.status, 0, runs.stderr);

  const backlog = new Backlog(path.join(dir, 'backlog'));
  assert.equal(backlog.read('Q-0006').meta.id, 'Q-0006');
  assert.equal(backlog.list().length, 2);
  assert.throws(() => backlog.dirOf('Q-9999'), (e) => e.message === 'ticket not found: Q-9999');
});

if (failed) { console.error(`\n✗ ${failed} q0080 scenario(s) failed`); process.exit(1); }
console.log('✓ q0080 allocation');
