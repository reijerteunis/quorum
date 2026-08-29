// Q-0077: `harness run --base <ref>`, so a ticket whose branch is contained in the base can still
// be reviewed.
//
// Every fixture builds its own throwaway repository. Nothing here asserts the containment state of
// a branch in THIS repository — the permanent-acceptance-test decision (2026-08-23).
//
// The load-bearing scenario is B2: `--base` moves the DIFF ANCHOR and not the branch a run merges
// from. Those are two different meanings of "base" and the flag must move exactly one of them.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { materialiseDiff } from '../src/engine.js';

const bin = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'bin/harness.js');
const cli = (root, args) => spawnSync(process.execPath, [bin, ...args, '--project', root], { encoding: 'utf8' });

let failed = 0;
const scenario = async (id, title, fn) => {
  try { await fn(); console.log(`✓ ${id} — ${title}`); }
  catch (e) { failed++; console.error(`✗ ${id} — ${title}\n  ${String(e.message).split('\n').slice(0, 6).join('\n  ')}`); }
};
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const commit = (cwd, msg) => git(cwd, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '-m', msg);
const write = (f, x) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, x); };

const BRANCH = 'harness/T-9/integration';
const STEP = { id: 'review-claude', input: { diff: '{base}...harness/{id}/integration' } };
const ctxFor = (root, vars) => ({
  repoDir: root, config: { repo: { base_branch: 'main' } }, vars,
  ticket: { meta: { id: 'T-9' } }, backlog: { log: () => {} }, runId: 1,
});

/** One commit on main, a branch that adds a line, then main takes the branch — a CONTAINED ticket. */
function contained() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0077-'));
  git(root, 'init', '-q', '-b', 'main');
  write(path.join(root, 'a.txt'), 'one\n');
  git(root, 'add', '-A'); commit(root, 'base');
  const beforeWork = git(root, 'rev-parse', 'HEAD');
  git(root, 'branch', BRANCH);
  git(root, 'checkout', '-q', BRANCH);
  write(path.join(root, 'a.txt'), 'one\ntwo\n'); git(root, 'add', '-A'); commit(root, 'the ticket\'s work');
  git(root, 'checkout', '-q', 'main');
  git(root, 'merge', '-q', '--no-ff', '-m', 'take the branch', BRANCH);
  return { root, beforeWork };
}

console.log('q0077 --base');

await scenario('B1', 'AC-5 — a contained ticket has an empty range against the configured base, and a usable one against --base', async () => {
  const { root, beforeWork } = contained();

  // The regression this ticket exists to fix, driven rather than described: with the configured
  // base the review range is empty and materialiseDiff refuses.
  let refused = null;
  try { materialiseDiff(STEP, ctxFor(root, { id: 'T-9', base: 'main' })); } catch (e) { refused = e; }
  assert.ok(refused, 'a contained ticket must produce an empty range against the configured base');

  // With --base aimed before the work, the same step gets the ticket's own diff back.
  const out = materialiseDiff(STEP, ctxFor(root, { id: 'T-9', base: beforeWork }));
  const text = typeof out === 'string' ? out : JSON.stringify(out);
  assert.ok(text.includes('a.txt'), `the override must yield the ticket's own diff: ${text.slice(0, 200)}`);
  assert.ok(text.includes('two'), 'the diff must contain the line the ticket added');
});

await scenario('B2', 'AC-3 — the override moves the diff anchor and leaves repo.base_branch alone', async () => {
  const { root, beforeWork } = contained();
  const ctx = ctxFor(root, { id: 'T-9', base: beforeWork });
  materialiseDiff(STEP, ctx);

  // The whole design. If the flag had been implemented by overwriting the configured branch — the
  // cheaper shape Q-0077's open question refuses — this would read the SHA, and a later rework or
  // integrate step would MERGE that revision into the ticket's branch.
  assert.equal(ctx.config.repo.base_branch, 'main', 'repo.base_branch is what a run merges from and must not move');
  assert.equal(ctx.vars.base, beforeWork, 'the diff anchor is what moved');
});

await scenario('B3', 'AC-2 — the range guard accepts an arbitrary revision as the base and still refuses an unrelated ref', async () => {
  const { root, beforeWork } = contained();

  // The guard forbids a FLOW FILE aiming at unrelated refs. Once --base names the anchor, the
  // guard's own notion of "related" moves with it — Q-0034 wrote it that way on purpose.
  materialiseDiff(STEP, ctxFor(root, { id: 'T-9', base: beforeWork }));

  // And a third ref, related to neither the effective base nor this ticket, is still refused.
  git(root, 'branch', 'harness/T-OTHER/integration');
  const unrelated = { id: 'x', input: { diff: '{base}...harness/T-OTHER/integration' } };
  let refused = null;
  try { materialiseDiff(unrelated, ctxFor(root, { id: 'T-9', base: beforeWork })); } catch (e) { refused = e; }
  assert.ok(refused, 'an endpoint belonging to another ticket must still be refused');
  assert.match(refused.message, /input\.diff must relate/, `the guard's own message: ${refused?.message}`);
});

await scenario('B4', 'AC-4 — with no override the anchor is the configured base, unchanged', async () => {
  const { root } = contained();
  const ctx = ctxFor(root, { id: 'T-9', base: 'main' });
  let refused = null;
  try { materialiseDiff(STEP, ctx); } catch (e) { refused = e; }
  assert.ok(refused, 'the default path is the behaviour that was there before this ticket');
  assert.equal(ctx.vars.base, 'main');
});

await scenario('B5', 'AC-1 — the CLI threads --base to the run, and refuses the bare flag', async () => {
  // The last link: argv → runFlow. B1-B4 cover vars.base → range, and the core suite covers
  // options.base → vars.base; without this the two halves are joined only by reading.
  const { root } = contained();

  // A bare `--base` parses to `true` in the generic flag parser. It names no revision, so it is
  // refused rather than coerced into the string "true" and interpolated into a range.
  const bare = cli(root, ['run', 'review', 'T-9', '--base']);
  assert.equal(bare.status, 1, `a valueless --base must fail: ${bare.stdout}${bare.stderr}`);
  assert.match(`${bare.stdout}${bare.stderr}`, /--base needs a revision/);

  // And the flag appears in the usage line, so it is discoverable.
  const usage = cli(root, ['run']);
  assert.match(`${usage.stdout}${usage.stderr}`, /\[--base <ref>\]/, 'the usage string names the flag');
});

process.exit(failed ? 1 : 0);
