// A dry run previews; it never mutates.
//
// `harness run requirements Q-0034 --dry` advanced the ticket from draft to requirements, wrote a
// runs.log and appended a "completed" history entry — without invoking a single agent or writing a
// single artifact. The preview then blocked the real run, because the stage the flow consumes had
// already been consumed by nothing. Every *step* checked ctx.dry; the run's own bookkeeping did
// not. See Q-0034.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Backlog } from '../src/backlog.js';
import { loadFlow, runFlow } from '../src/engine.js';

const spike = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const scenario = async (id, title, fn) => {
  try { await fn(); console.log(`✓ ${id} — ${title}`); }
  catch (e) { failed++; console.error(`✗ ${id} — ${title}\n  ${e.message}`); }
};
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };

// Any ui method is a no-op except gate, which auto-advances. A Proxy rather than a literal so the
// test does not break every time the engine calls a new reporting method.
const silent = new Proxy({}, {
  get: (_, name) => (name === 'gate' ? async () => 'advance' : () => {}),
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0034-dry-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'base');
  const harnessDir = path.join(root, 'harness');
  write(path.join(harnessDir, 'roles', 'product-manager.md'), '---\nadapter: mock\n---\nPM.\n');
  write(path.join(harnessDir, 'flows', 'two-step.yaml'), [
    'name: two-step', 'consumes: draft', 'produces: requirements', 'steps:',
    '  - id: pm', '    role: product-manager', '    adapter: mock',
    '    input: { backlog: [ticket.md] }', '    output: { write: requirements/candidate.md }',
    '  - gate: human', '    reason: approve',
  ].join('\n') + '\n');
  const backlog = new Backlog(path.join(root, 'backlog'));
  const ticket = backlog.create({ title: 'Dry run must not mutate', intent: 'Preview only.', owner: 'qa' });
  return { root, harnessDir, backlog, ticket };
}

const state = (dir) => ({
  ticket: fs.readFileSync(path.join(dir, 'ticket.md'), 'utf8'),
  files: fs.readdirSync(dir).sort(),
});

console.log('q0034 dry run');

await scenario('D1', 'a dry run leaves ticket.md byte-identical and writes no runs.log', async () => {
  const { harnessDir, backlog, ticket } = fixture();
  const flow = loadFlow(path.join(harnessDir, 'flows', 'two-step.yaml'));
  const before = state(ticket.dir);
  assert.equal(ticket.meta.stage, 'draft', 'fixture should start at draft');

  await runFlow({ flow, ticket, backlog, harnessDir, repoDir: path.dirname(path.dirname(ticket.dir)),
    config: {}, ui: silent, dry: true });

  const after = state(ticket.dir);
  assert.equal(after.ticket, before.ticket, 'ticket.md was rewritten by a dry run');
  assert.deepEqual(after.files, before.files, 'a dry run created files in the ticket folder');
  assert.ok(!after.files.includes('runs.log'), 'a dry run wrote runs.log');
  assert.equal(backlog.read(ticket.meta.id).meta.stage, 'draft', 'a dry run advanced the stage on disk');
});

await scenario('D2', 'the real run still consumes the stage a dry run previewed', async () => {
  const { harnessDir, backlog, ticket } = fixture();
  const flow = loadFlow(path.join(harnessDir, 'flows', 'two-step.yaml'));
  const repoDir = path.dirname(path.dirname(ticket.dir));

  await runFlow({ flow, ticket, backlog, harnessDir, repoDir, config: {}, ui: silent, dry: true });
  // The bug: this second call threw "is at stage requirements, flow consumes draft".
  const res = await runFlow({ flow, ticket: backlog.read(ticket.meta.id), backlog, harnessDir, repoDir,
    config: {}, ui: silent, auto: true });

  assert.equal(res.status, 'completed');
  assert.equal(backlog.read(ticket.meta.id).meta.stage, 'requirements');
});

if (failed) { console.error(`\n✗ ${failed} scenario(s) failed`); process.exit(1); }
console.log('\n✓ 2 scenarios passed');
