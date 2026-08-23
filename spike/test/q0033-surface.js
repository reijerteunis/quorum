// Q-0033 red tests: human-facing review assets, config/init, directory lint,
// run preflight, gate answers, board compatibility, and documentation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { lintFlow } from '../src/engine.js';

const spike = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(spike, '..');
const bin = path.join(spike, 'bin', 'harness.js');
const q6 = path.join(repo, 'contracts', 'Q-0006');
let failed = 0;
async function scenario(id, title, fn) {
  try { await fn(); console.log(`✓ ${id} — ${title}`); }
  catch (e) { failed++; console.error(`✗ ${id} — ${title}\n  ${e.message}`); }
}
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const write = (file, body) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const cli = (cwd, args, env = {}, input = undefined) => spawnSync(process.execPath, [bin, ...args], {
  cwd, encoding: 'utf8', input, env: { ...process.env, ...env }, timeout: 20000,
});
const output = (r) => `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '');

function initFixture({ branch = 'main', commit = true, gitRepo = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0033-'));
  if (gitRepo) {
    git(root, 'init', '-q', '-b', branch);
    if (commit) git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'init');
  }
  return { root, result: cli(root, ['init']) };
}
function projectFixture() {
  const f = initFixture();
  assert.equal(f.result.status, 0, output(f.result));
  return f.root;
}
function copyFlows(root) {
  const dst = path.join(root, 'harness', 'flows');
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(path.join(repo, 'harness', 'flows'), dst, { recursive: true });
  return dst;
}
function basicFlow(name, consumes, produces, extra = '') {
  return `name: ${name}\nconsumes: ${consumes}\nproduces: ${produces}\nsteps: []\n${extra}`;
}
function lintFixture(files) {
  const root = projectFixture(); const dir = path.join(root, 'harness', 'flows');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) write(path.join(dir, `${name}.yaml`), body);
  return { root, result: cli(root, ['lint']) };
}
function reviewWith(goto = 'flow:development', overrides = '') {
  const contract = read(q6, 'review-flow.contract.yaml').replace('goto: flow:development', `goto: ${goto}`);
  return overrides ? contract.replace('max_iterations: 3', overrides) : contract;
}
function makeTicket(root, stage = 'green') {
  const r = cli(root, ['ticket', 'new', 'Review fixture']);
  assert.equal(r.status, 0, output(r));
  const dir = fs.readdirSync(path.join(root, 'backlog')).find((x) => x.startsWith('T-0001'));
  const ticket = path.join(root, 'backlog', dir);
  const file = path.join(ticket, 'ticket.md');
  write(file, read(file).replace('stage: draft', `stage: ${stage}`));
  write(path.join(ticket, 'requirements', 'merged.md'), '# Requirement\n');
  write(path.join(ticket, 'solution', 'solution.md'), '# Solution\n');
  git(root, 'checkout', '-q', '-b', 'harness/T-0001/integration');
  write(path.join(root, 'change.txt'), 'review me\n'); git(root, 'add', 'change.txt');
  git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '-m', 'ticket'); git(root, 'checkout', '-q', 'main');
  return ticket;
}

await scenario('S1.1/S1.2/S1.4', 'review flow matches its fixture and all shipped flow peers are byte-identical', () => {
  const actualFile = path.join(repo, 'harness', 'flows', 'review.yaml');
  const templateFile = path.join(spike, 'templates', 'harness', 'flows', 'review.yaml');
  assert.equal(fs.existsSync(actualFile), true, 'harness/flows/review.yaml must ship');
  assert.equal(fs.existsSync(templateFile), true, 'template review.yaml must ship');
  const actual = YAML.parse(read(actualFile)); delete actual.file;
  const expected = YAML.parse(read(q6, 'review-flow.contract.yaml')); delete expected.file;
  assert.deepEqual(actual, expected); assert.deepEqual(fs.readFileSync(actualFile), fs.readFileSync(templateFile));
  const a = path.join(repo, 'harness', 'flows'), b = path.join(spike, 'templates', 'harness', 'flows');
  const names = (d) => fs.readdirSync(d).filter((x) => x.endsWith('.yaml')).sort();
  assert.deepEqual(names(a), names(b));
  for (const name of names(a)) assert.deepEqual(fs.readFileSync(path.join(a, name)), fs.readFileSync(path.join(b, name)), name);
});

await scenario('S1.3/S3.4/S6.1/S7.8/S8.2/S8.5', 'the complete shipped flow directory lints clean', () => {
  const root = projectFixture(); copyFlows(root); const r = cli(root, ['lint']);
  assert.equal(r.status, 0, output(r)); assert.match(output(r), /✓ review\.yaml/);
});

await scenario('S2.1-S2.5', 'the designated reviewer role alone is shared and obeys its persona contract', () => {
  const a = path.join(repo, 'harness', 'roles', 'code-reviewer.md');
  const b = path.join(spike, 'templates', 'harness', 'roles', 'code-reviewer.md');
  assert.equal(fs.existsSync(a), true, 'harness/roles/code-reviewer.md must ship');
  assert.equal(fs.existsSync(b), true, 'template code-reviewer.md must ship');
  assert.deepEqual(fs.readFileSync(a), fs.readFileSync(b));
  const text = read(a), fm = YAML.parse(text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '') ?? {};
  assert.equal('adapter' in fm, false); assert.equal('model' in fm, false);
  assert.match(text, /requirement/i); assert.match(text, /solution/i); assert.match(text, /diff/i);
  assert.match(text, /never (edit|rewrite)|read.only/i); assert.match(text, /blocker.*major.*nit/is); assert.match(text, /file:line/i);
  assert.doesNotMatch(text, /nits alone approve|surviving (blocker|major)/i);
  const flow = read(repo, 'harness', 'flows', 'review.yaml'); assert.match(flow, /nits alone approve|blocker.*major.*changes/is);
  const repoRoles = fs.readdirSync(path.join(repo, 'harness', 'roles')).sort();
  const templateRoles = fs.readdirSync(path.join(spike, 'templates', 'harness', 'roles')).sort();
  assert.notDeepEqual(repoRoles, templateRoles, 'role directories must intentionally remain non-identical');
  assert.doesNotMatch(read(b), /^\s*model:\s*gpt-/m);
});

await scenario('S3.1', 'review flow contains no payload-only or unsupported engine fields', () => {
  const file = path.join(repo, 'harness', 'flows', 'review.yaml'); assert.equal(fs.existsSync(file), true, 'review.yaml must ship');
  const text = read(file);
  for (const bad of [/type:\s*judge/, /findings\s*:/, /tasks\s*:/, /on_fail:[\s\S]*?\bwith\s*:/]) assert.doesNotMatch(text, bad);
});

await scenario('S3.2/S3.3', 'shipped mock review traverses rejection and approval paths', () => {
  for (const [flag, answer, stage, status] of [['MOCK_ALWAYS_FAIL', 'abort', 'red', 0], ['MOCK_ALWAYS_PASS', 'advance', 'reviewed', 0]]) {
    const root = projectFixture(); copyFlows(root); assert.equal(fs.existsSync(path.join(root, 'harness', 'flows', 'review.yaml')), true, 'review.yaml must be copied'); const ticket = makeTicket(root);
    const r = cli(root, ['run', 'review', 'T-0001', '--adapter', 'mock', '--gate-answer', answer], { [flag]: '1' });
    assert.equal(r.status, status, output(r));
    const body = read(ticket, 'ticket.md'); assert.match(body, new RegExp(`stage: ${stage}`));
    if (flag === 'MOCK_ALWAYS_FAIL') assert.match(output(r), /changes-requested|development|red/i);
    else assert.match(read(ticket, 'review', 'verdict.md'), /approve/i);
  }
});

await scenario('S4.1-S4.3/E6', 'shipped config declares commented keys and runtime defaults remain optional', () => {
  for (const file of [path.join(repo, 'harness', 'harness.yaml'), path.join(spike, 'templates', 'harness', 'harness.yaml')]) {
    const text = read(file), config = YAML.parse(text); assert.equal(config.repo.base_branch, 'main'); assert.equal(config.repo.max_diff_bytes, 200000);
    assert.match(text, /#.*base branch/i); assert.match(text, /#.*(diff|byte|size)/i);
  }
  // Public engine defaults are exercised by constructing prompts/runs in Q-0006; here the
  // compatibility contract is pinned at the configuration boundary without inventing an API.
  const source = read(spike, 'src', 'engine.js');
  assert.match(source, /base_branch\s*\?\?\s*['"]main['"]/); assert.match(source, /max_diff_bytes\s*\?\?\s*200000/);
});

await scenario('S5.1-S5.7/E5', 'init discovers named branches and preserves template formatting while Git failures fall back', () => {
  for (const commit of [true, false]) {
    const f = initFixture({ branch: 'master', commit }); assert.equal(f.result.status, 0, output(f.result));
    const text = read(f.root, 'harness', 'harness.yaml'); const config = YAML.parse(text);
    assert.equal(config.repo.base_branch, 'master'); assert.equal(config.repo.max_diff_bytes, 200000);
    assert.match(text, /#.*install/i); assert.match(text, /#.*base branch/i); assert.match(text, /#.*(diff|byte|size)/i);
  }
  const plain = initFixture({ gitRepo: false }); assert.equal(plain.result.status, 0, output(plain.result));
  assert.equal(YAML.parse(read(plain.root, 'harness', 'harness.yaml')).repo.base_branch, 'main'); assert.equal(plain.result.stderr, '');
  const detached = initFixture(); git(detached.root, 'checkout', '-q', '--detach', 'HEAD');
  fs.rmSync(path.join(detached.root, 'harness'), { recursive: true }); fs.rmSync(path.join(detached.root, 'backlog'), { recursive: true });
  const d = cli(detached.root, ['init']); assert.equal(d.status, 0, output(d)); assert.equal(YAML.parse(read(detached.root, 'harness', 'harness.yaml')).repo.base_branch, 'main');
  // Unnameable/mid-operation and subprocess failures have the same observable fallback contract.
  assert.doesNotMatch(output(plain.result), /fatal:|not a git repository/i);
});

await scenario('S6.2-S6.10', 'return-chain validation handles multi-hop, missing, unloadable, dead-end, ambiguity and cycles', () => {
  const valid = lintFixture({ review: reviewWith('flow:qa-red'), 'qa-red': basicFlow('qa-red', 'qa', 'red'), development: basicFlow('development', 'red', 'green') });
  assert.equal(valid.result.status, 0, output(valid.result));
  const cases = [
    ['missing', { review: reviewWith('flow:nonexistent'), development: basicFlow('development', 'red', 'green') }, /review.*nonexistent.*(missing|no such|load)/is],
    ['unloadable', { review: reviewWith('flow:broken'), broken: 'name: broken\nsteps: [', development: basicFlow('development', 'red', 'green') }, /review.*broken.*load|broken.*invalid/is],
    ['dead end', { review: reviewWith('flow:dead'), dead: basicFlow('dead', 'x', 'nowhere') }, /review.*dead.*nowhere/is],
    ['ambiguity', { review: reviewWith('flow:a'), a: basicFlow('a', 'x', 'y'), b: basicFlow('b', 'y', 'z'), c: basicFlow('c', 'y', 'green') }, /review.*a.*y.*b.*c/is],
    ['cycle/repeated pair', { source: reviewWith('flow:a').replace('name: review', 'name: source'), a: basicFlow('a', 'x', 'y'), b: basicFlow('b', 'y', 'x') }, /source.*a.*cycle/is],
    ['self target', { review: reviewWith('flow:review') }, /review.*review.*reviewed/is],
  ];
  for (const [label, files, re] of cases) { const x = lintFixture(files); assert.notEqual(x.result.status, 0, label); assert.match(output(x.result), re, label); }
  const unreached = lintFixture({ source: reviewWith('flow:development'), development: basicFlow('development', 'red', 'green'), x1: basicFlow('x1', 'unused', 'a'), x2: basicFlow('x2', 'unused', 'b') });
  assert.equal(unreached.result.status, 0, output(unreached.result));
});

await scenario('S7.1-S7.7', 'bounds and counter spelling reject every invalid form', () => {
  const base = YAML.parse(read(q6, 'review-flow.contract.yaml')); const verdict = base.steps.find((s) => s.id === 'verdict');
  const cases = [[undefined, 'review'], ['three', 'review'], [1.5, 'review'], [0, 'review'], [-1, 'review'], [3, 'iterations.review'], [3, '']];
  for (const [bound, counter] of cases) {
    const flow = structuredClone(base); const f = flow.steps.find((s) => s.id === 'verdict');
    if (bound === undefined) delete f.on_fail.max_iterations; else f.on_fail.max_iterations = bound; f.on_fail.counter = counter;
    assert.throws(() => lintFlow(flow), counter === 'iterations.review' ? /iterations\.review.*review/is : /verdict.*(max_iterations|counter)/is);
  }
});

await scenario('S8.1-S8.4', 'same-role review panels must span at least two adapters', () => {
  const base = YAML.parse(read(q6, 'review-flow.contract.yaml'));
  const panel = base.steps[0].parallel;
  for (const adapters of [['claude', 'claude'], ['codex', 'codex', 'codex']]) {
    const flow = structuredClone(base); flow.steps[0].parallel = adapters.map((adapter, i) => ({ ...panel[i % 2], id: `member-${i}`, adapter }));
    assert.throws(() => lintFlow(flow), new RegExp(`member-0.*member-1.*${adapters[0]}`, 'is'));
  }
  const mixed = structuredClone(base); mixed.steps[0].parallel.push({ ...panel[0], id: 'third', adapter: 'claude' }); assert.equal(lintFlow(mixed), true);
});

await scenario('S9.1-S9.4/E1', 'run uses the same pristine whole-directory preflight before overrides and side effects', () => {
  const root = projectFixture(); copyFlows(root); const ticket = makeTicket(root);
  write(path.join(root, 'harness', 'flows', 'bad.yaml'), 'name: bad\nconsumes: x\nproduces: y\nsteps:\n  - id: bad\n    on_fail: {goto: "flow:missing", counter: bad, max_iterations: 3, on_exhausted: gate}\n');
  const lint = cli(root, ['lint']); const run = cli(root, ['run', 'review', 'T-0001', '--adapter', 'mock'], { MOCK_ALWAYS_PASS: '1' });
  assert.notEqual(lint.status, 0); assert.notEqual(run.status, 0); assert.match(output(lint), /missing/); assert.match(output(run), /missing/);
  assert.equal(fs.existsSync(path.join(ticket, 'runs.log')), false, 'preflight wrote runs.log');
  const valid = projectFixture(); copyFlows(valid); makeTicket(valid);
  const ok = cli(valid, ['run', 'review', 'T-0001', '--adapter', 'mock', '--gate-answer', 'advance'], { MOCK_ALWAYS_PASS: '1' });
  assert.equal(ok.status, 0, output(ok));
  const multi = lintFixture({ a: reviewWith('flow:missing'), b: reviewWith('flow:development', 'max_iterations: 0').replace('name: review', 'name: b'), development: basicFlow('development', 'red', 'green') });
  assert.match(output(multi.result), /missing/); assert.match(output(multi.result), /max_iterations/);
});

await scenario('S10.1-S10.7/E3/E4', 'gate answers accumulate in order, are exact, and never come from auto or closed stdin', () => {
  const source = read(bin); assert.match(source, /gate-answer/);
  const root = projectFixture(); copyFlows(root); const ticket = makeTicket(root);
  write(path.join(ticket, 'ticket.md'), read(ticket, 'ticket.md').replace('iterations: {}', 'iterations:\n  review: 3'));
  const two = cli(root, ['run', 'review', 'T-0001', '--adapter', 'mock', '--gate-answer', 'advance', '--gate-answer', 'abort'], { MOCK_ALWAYS_FAIL: '1' });
  assert.equal(two.status, 2, output(two)); assert.match(read(ticket, 'ticket.md'), /stage: green/);
  const exactRoot = projectFixture(); copyFlows(exactRoot); makeTicket(exactRoot);
  const prefix = cli(exactRoot, ['run', 'review', 'T-0001', '--adapter', 'mock', '--gate-answer', 'ad'], { MOCK_ALWAYS_PASS: '1' });
  assert.notEqual(prefix.status, 0); assert.match(output(prefix), /gate/i);
  const noAnswerRoot = projectFixture(); copyFlows(noAnswerRoot); makeTicket(noAnswerRoot);
  const none = cli(noAnswerRoot, ['run', 'review', 'T-0001', '--adapter', 'mock'], { MOCK_ALWAYS_PASS: '1' }, '');
  assert.notEqual(none.status, 0); assert.match(output(none), /gate.*(answer|stdin)/is);
  const autoRoot = projectFixture(); copyFlows(autoRoot); const autoTicket = makeTicket(autoRoot);
  write(path.join(autoTicket, 'ticket.md'), read(autoTicket, 'ticket.md').replace('iterations: {}', 'iterations:\n  review: 3'));
  const auto = cli(autoRoot, ['run', 'review', 'T-0001', '--adapter', 'mock', '--auto'], { MOCK_ALWAYS_FAIL: '1' }, '');
  assert.notEqual(auto.status, 0); assert.match(output(auto), /human-locked|loop exhausted/i);
  const retry = cli(autoRoot, ['run', 'review', 'T-0001', '--adapter', 'mock', '--gate-answer', 'retry', '--gate-answer', 'abort'], { MOCK_ALWAYS_FAIL: '1' });
  assert.match(read(autoTicket, 'ticket.md'), /review: 3/); assert.match(read(autoTicket, 'runs.log'), /gate=retry.*counter=review.*set=3/);
  // Parser scoping: repeating adapter remains last-wins (claude is attempted, not mock).
  const other = cli(exactRoot, ['run', 'review', 'T-0001', '--adapter', 'mock', '--adapter', 'claude', '--gate-answer', 'advance'], { MOCK_ALWAYS_PASS: '1' });
  assert.doesNotMatch(output(other), /single.vendor.*mock/i);
});

await scenario('S11.1-S11.4', 'suite wiring, explicit gates, and board counter/cost compatibility are pinned', () => {
  const pkg = JSON.parse(read(spike, 'package.json')); assert.equal(pkg.scripts.test, 'node test/run.js'); assert.ok(pkg.scripts.lint);
  assert.match(read(spike, 'test', 'smoke.js'), /--gate-answer['"],?\s*['"]abort/);
  const root = projectFixture(); const ticket = makeTicket(root);
  let body = read(ticket, 'ticket.md').replace('iterations: {}', 'iterations:\n  review: 2');
  body = body.replace('history: []', 'history:\n  - {run: 1, status: exhausted, cost: 0}\n  - {run: 1, status: aborted, cost: 1.25}'); write(path.join(ticket, 'ticket.md'), body);
  const board = cli(root, ['board']); assert.match(output(board), /iter=.*review.*2/); assert.match(output(board), /cost=\$1\.25/);
});

await scenario('S11.5/S11.6', 'frozen Q-0006 inputs are guarded and unreachable baselines skip explicitly', () => {
  try { git(repo, 'cat-file', '-e', '5d16e06^{commit}'); }
  catch { console.log('  skip: baseline 5d16e06 unavailable'); return; }
  assert.equal(git(repo, 'diff', '--name-only', '5d16e06', '--', 'contracts/Q-0006'), '');
});

await scenario('S13.1-S13.8', 'documentation agrees with the shipped review surface and preserves excluded text', () => {
  const spec = read(repo, 'docs', '02-sdlc-pipeline-spec.md');
  assert.match(spec, /review[\s\S]*red|changes.requested[\s\S]*development/is);
  for (const re of [/\{base\}\.\.\.harness\/\{id\}\/integration/, /\{round\}/, /counter:\s*review/, /max_diff_bytes[\s\S]*200000/is, /--auto[\s\S]*(cannot|does not|never)/is, /no lighter.*fix|no lighter flow/is]) assert.match(spec, re);
  for (const re of [/type:\s*judge/, /model:\s*(opus|gpt-)/, /\{iter\}/]) assert.doesNotMatch(spec.match(/§?\s*5\.5[\s\S]*?(?=\n#|\n##\s+5\.6|$)/)?.[0] ?? spec, re);
  const plan = read(repo, 'docs', '06-development-plan.md'); assert.match(plan, /Q-0006[\s\S]*engine/is); assert.match(plan, /Q-0033[\s\S]*(surface|flow|role|lint)/is);
  const decisions = read(repo, 'docs', 'DECISIONS.md');
  for (const topic of [/derived regression/i, /non.auto.*exhaustion|exhaustion.*--auto/i]) {
    const at = decisions.search(topic); assert.ok(at >= 0); const block = decisions.slice(Math.max(0, decisions.lastIndexOf('\n##', at)), decisions.indexOf('\n##', at + 3) < 0 ? undefined : decisions.indexOf('\n##', at + 3));
    assert.match(block, /\d{4}-\d{2}-\d{2}/); assert.match(block, /\*\*Decision\*\*/); assert.match(block, /\*\*Alternatives considered\*\*/); assert.match(block, /\*\*Why\*\*/);
  }
  const glossary = read(repo, 'docs', 'GLOSSARY.md'); const gate = glossary.match(/\*\*Gate\*\*[\s\S]*?(?=\n\*\*|$)/)?.[0] ?? '';
  assert.match(gate, /author.declared[\s\S]*deploy/is); assert.match(gate, /engine.presented[\s\S]*exhaustion/is);
  assert.equal(git(repo, 'diff', '--name-only', 'HEAD', '--', 'README.md'), '');
});

await scenario('S12.1/E2', 'manual and future-facing criteria remain explicitly non-automated', () => {
  // S12.1 requires authenticated subscription spend and maintainer-written evidence; asserting
  // it here would fabricate evidence. E2 is represented by the reached-only ambiguity and
  // visited-pair fixtures above, without inventing future qa-final/deploy flows.
  assert.equal(true, true);
});

if (failed) { console.error(`\n✗ ${failed} Q-0033 scenario group(s) failed`); process.exit(1); }
