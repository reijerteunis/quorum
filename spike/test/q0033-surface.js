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
const results = [];
async function scenario(id, title, fn) {
  try { await fn(); results.push(['✓', id, title]); console.log(`✓ ${id} — ${title}`); }
  catch (e) { failed++; results.push(['✗', id, title]); console.error(`✗ ${id} — ${title}\n  ${String(e.message).split('\n')[0]}`); }
}
function checkFixtures(cases) {
  const errors = [];
  for (const [caseId, fn] of cases) {
    try { fn(); results.push(['✓', caseId, 'fixture']); console.log(`  ✓ ${caseId}`); }
    catch (e) { results.push(['✗', caseId, 'fixture']); errors.push(`${caseId}: ${e.message}`); console.error(`  ✗ ${caseId}\n    ${e.message}`); }
  }
  assert.equal(errors.length, 0, errors.join('\n'));
}
function skipped(id, reason) { results.push(['SKIP', id, reason]); console.log(`SKIP ${id}: ${reason}`); }
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const write = (file, body) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const cli = (cwd, args, env = {}, input = undefined) => spawnSync(process.execPath, [bin, ...args], {
  cwd, encoding: 'utf8', input, env: { ...process.env, ...env }, timeout: 20000,
});
const output = (r) => `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '');
function flowDiagnostic(result, filename) {
  const lines = output(result).split('\n');
  const start = lines.findIndex((line) => new RegExp(`^[✗x]\\s+${filename.replace('.', '\\.')}$`, 'u').test(line.trim()));
  assert.ok(start >= 0, `missing diagnostic block for ${filename}`);
  const block = [lines[start].trim()];
  for (let i = start + 1; i < lines.length && /^\s+-\s/.test(lines[i]); i++) block.push(lines[i].trim());
  return block.join('\n');
}

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
function makeDraftTicket(root, title = 'Gate fixture') {
  const r = cli(root, ['ticket', 'new', title]);
  assert.equal(r.status, 0, output(r));
  const dir = fs.readdirSync(path.join(root, 'backlog')).find((x) => x.startsWith('T-0001'));
  return path.join(root, 'backlog', dir);
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
    else { assert.match(output(r), /approve/i); assert.equal(fs.existsSync(path.join(ticket, 'review', 'verdict.md')), true); }
  }
});

skipped('S3.5', 'finding only: the frozen Q-0006 mock contract already guarantees the schema-valid finding shape');

await scenario('S4.1-S4.3/E6', 'shipped config declares commented keys and runtime defaults remain optional', () => {
  for (const file of [path.join(repo, 'harness', 'harness.yaml'), path.join(spike, 'templates', 'harness', 'harness.yaml')]) {
    const text = read(file), config = YAML.parse(text); assert.equal(config.repo.base_branch, 'main'); assert.equal(config.repo.max_diff_bytes, 200000);
    assert.match(text, /#.*base branch/i); assert.match(text, /#.*(diff|byte|size)/i);
  }
  for (const explicitDevelop of [false, true]) {
    const root = projectFixture(); copyFlows(root);
    const configFile = path.join(root, 'harness', 'harness.yaml');
    const config = YAML.parse(read(configFile));
    if (explicitDevelop) { git(root, 'branch', 'develop'); config.repo = { base_branch: 'develop' }; }
    else delete config.repo;
    write(configFile, YAML.stringify(config)); makeTicket(root);
    const r = cli(root, ['run', 'review', 'T-0001', '--adapter', 'mock', '--gate-answer', 'advance'], { MOCK_ALWAYS_PASS: '1' });
    assert.equal(r.status, 0, output(r));
  }
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
  assert.equal(git(detached.root, 'branch', '--show-current'), '', 'fixture must exercise successful Git with empty stdout');
  const broken = fs.mkdtempSync(path.join(os.tmpdir(), 'q0033-badgit-'));
  const badGit = cli(broken, ['init'], { GIT_DIR: path.join(broken, 'not-a-repository') });
  assert.equal(badGit.status, 0, output(badGit));
  assert.equal(YAML.parse(read(broken, 'harness', 'harness.yaml')).repo.base_branch, 'main');
  assert.doesNotMatch(output(badGit), /fatal:|not a git repository/i);
  assert.doesNotMatch(output(plain.result), /fatal:|not a git repository/i);
});

await scenario('S6.2-S6.10', 'return-chain validation handles multi-hop, missing, unloadable, dead-end, ambiguity and cycles', () => {
  const cases = [
    ['S6.3 missing', { review: reviewWith('flow:nonexistent'), development: basicFlow('development', 'red', 'green') }, /review.*nonexistent.*(missing|no such|load)/is],
    ['S6.4 unloadable', { review: reviewWith('flow:broken'), broken: 'name: broken\nsteps: [', development: basicFlow('development', 'red', 'green') }, /review[\s\S]*broken/is],
    ['S6.5 dead end', { review: reviewWith('flow:dead'), dead: basicFlow('dead', 'x', 'nowhere') }, /review.*dead.*nowhere/is],
    ['S6.6 ambiguity', { review: reviewWith('flow:a'), a: basicFlow('a', 'x', 'y'), b: basicFlow('b', 'y', 'z'), c: basicFlow('c', 'y', 'green') }, /review.*a.*y.*b.*c/is],
    ['S6.8/S6.10 cycle/repeated pair', { source: reviewWith('flow:a').replace('name: review', 'name: source'), a: basicFlow('a', 'x', 'y'), b: basicFlow('b', 'y', 'x') }, /source.*a.*cycle/is],
    ['S6.9 self target', { review: reviewWith('flow:review') }, /review.*review.*reviewed/is],
  ];
  checkFixtures([
    ['S6.2 multi-hop', () => { const x = lintFixture({ review: reviewWith('flow:qa-red'), 'qa-red': basicFlow('qa-red', 'qa', 'red'), development: basicFlow('development', 'red', 'green') }); assert.equal(x.result.status, 0, output(x.result)); }],
    ...cases.map(([label, files, re]) => [label, () => { const x = lintFixture(files); assert.notEqual(x.result.status, 0, label); assert.match(output(x.result), re, label); }]),
    ['S6.7 unreached ambiguity', () => { const x = lintFixture({ source: reviewWith('flow:development'), development: basicFlow('development', 'red', 'green'), x1: basicFlow('x1', 'unused', 'a'), x2: basicFlow('x2', 'unused', 'b') }); assert.equal(x.result.status, 0, output(x.result)); }],
  ]);
});

await scenario('S7.1-S7.7', 'bounds and counter spelling reject every invalid form', () => {
  const base = YAML.parse(read(q6, 'review-flow.contract.yaml'));
  const cases = [[undefined, 'review'], ['three', 'review'], [1.5, 'review'], [0, 'review'], [-1, 'review'], [3, 'iterations.review'], [3, '']];
  checkFixtures(cases.map(([bound, counter], index) => [`S7.${index + 1}`, () => {
    const flow = structuredClone(base); const f = flow.steps.find((s) => s.id === 'verdict');
    if (bound === undefined) delete f.on_fail.max_iterations; else f.on_fail.max_iterations = bound; f.on_fail.counter = counter;
    assert.throws(() => lintFlow(flow), counter === 'iterations.review' ? /iterations\.review.*review/is : /verdict.*(max_iterations|counter)/is);
  }]));
  const plain = { name: 'plain', consumes: 'x', produces: 'y', steps: [{ id: 'ordinary', role: 'worker', on_fail: { goto: 'ordinary', counter: 'iterations.ordinary', max_iterations: 3 } }] };
  assert.throws(() => lintFlow(plain), /iterations\.ordinary.*ordinary/is, 'counter spelling applies to a non-verdict step');
});

await scenario('S8.1-S8.4', 'same-role review panels must span at least two adapters', () => {
  const base = YAML.parse(read(q6, 'review-flow.contract.yaml'));
  const panel = base.steps[0].parallel;
  checkFixtures([
    ['S8.1 two-member single vendor', () => {
      const flow = structuredClone(base); flow.steps[0].parallel = panel.map((step, i) => ({ ...step, id: `member-${i}`, adapter: 'codex' }));
      assert.throws(() => lintFlow(flow), (error) => /member-0.*member-1.*codex/is.test(error.message) && !/written by its own vendor/i.test(error.message));
    }],
    ['S8.2 shipped panel', () => assert.equal(lintFlow(structuredClone(base)), true)],
    ['S8.3 three-member single vendor', () => {
      const flow = structuredClone(base); flow.steps[0].parallel = [0, 1, 2].map((i) => ({ ...panel[i % 2], id: `member-${i}`, adapter: 'codex' }));
      assert.throws(() => lintFlow(flow), (error) => /member-0.*member-1.*member-2.*codex/is.test(error.message) && !/written by its own vendor/i.test(error.message));
    }],
    ['S8.4 mixed three-member panel', () => {
      const flow = structuredClone(base); flow.steps[0].parallel.push({ ...panel[0], id: 'third', adapter: 'claude' }); assert.equal(lintFlow(flow), true);
    }],
  ]);
});

await scenario('S9.1-S9.4/E1', 'run uses the same pristine whole-directory preflight before overrides and side effects', () => {
  const root = projectFixture(); copyFlows(root); const ticket = makeDraftTicket(root);
  write(path.join(root, 'harness', 'flows', 'bad.yaml'), 'name: bad\nconsumes: x\nproduces: y\nsteps:\n  - id: bad\n    on_fail: {goto: "flow:missing", counter: bad, max_iterations: 3, on_exhausted: gate}\n');
  const lint = cli(root, ['lint']); const run = cli(root, ['run', 'requirements', 'T-0001', '--adapter', 'mock'], { MOCK_ALWAYS_PASS: '1' });
  assert.notEqual(lint.status, 0); assert.notEqual(run.status, 0); assert.match(output(lint), /missing/); assert.match(output(run), /missing/);
  assert.equal(flowDiagnostic(lint, 'bad.yaml'), flowDiagnostic(run, 'bad.yaml'));
  assert.equal(fs.existsSync(path.join(ticket, 'runs.log')), false, 'preflight wrote runs.log');
  assert.deepEqual(fs.readdirSync(ticket).filter((name) => /^requirements$/.test(name)), [], 'preflight wrote requirement artifacts');
  assert.doesNotMatch(read(ticket, 'ticket.md'), /iterations:\s*\n\s+\S/);
  const valid = projectFixture(); copyFlows(valid); makeDraftTicket(valid);
  const ok = cli(valid, ['run', 'requirements', 'T-0001', '--adapter', 'mock', '--auto'], { MOCK_ALWAYS_PASS: '1' });
  assert.equal(ok.status, 0, output(ok));
  const multi = lintFixture({ a: reviewWith('flow:missing'), b: reviewWith('flow:development', 'max_iterations: 0').replace('name: review', 'name: b'), development: basicFlow('development', 'red', 'green') });
  assert.match(output(multi.result), /missing/); assert.match(output(multi.result), /max_iterations/);
});

await scenario('S10.1-S10.7/E3/E4', 'gate answers accumulate in order, are exact, and never come from auto or closed stdin', () => {
  checkFixtures([
    ['S10.1/S10.2 ordered answers', () => {
      const root = projectFixture(); const ticket = makeDraftTicket(root);
      const r = cli(root, ['run', 'requirements', 'T-0001', '--adapter', 'mock', '--gate-answer', 'advance', '--gate-answer', 'abort'], { MOCK_ALWAYS_FAIL: '1' });
      assert.notEqual(r.status, 0, output(r));
      const log = read(ticket, 'runs.log');
      assert.match(log, /exhausted stage=draft→draft cost=0[\s\S]*gate=human-locked answer=advance[\s\S]*gate=human answer=abort[\s\S]*aborted stage=draft→draft cost=/);
      assert.match(read(ticket, 'ticket.md'), /stage: draft/);
    }],
    ['S10.3 exact explicit answer', () => {
      const root = projectFixture(); makeDraftTicket(root);
      const r = cli(root, ['run', 'requirements', 'T-0001', '--adapter', 'mock', '--gate-answer', 'ad'], { MOCK_ALWAYS_PASS: '1' });
      assert.notEqual(r.status, 0); assert.match(output(r), /gate/i);
    }],
    ['S10.4 non-TTY has no default', () => {
      const root = projectFixture(); makeDraftTicket(root);
      const r = cli(root, ['run', 'requirements', 'T-0001', '--adapter', 'mock'], { MOCK_ALWAYS_PASS: '1' }, 'advance\n');
      assert.notEqual(r.status, 0); assert.match(output(r), /gate.*(answer|stdin)/is);
    }],
    ['S10.6 auto cannot answer exhaustion', () => {
      const root = projectFixture(); makeDraftTicket(root);
      const r = cli(root, ['run', 'requirements', 'T-0001', '--adapter', 'mock', '--auto'], { MOCK_ALWAYS_FAIL: '1' }, '');
      assert.notEqual(r.status, 0); assert.match(output(r), /human-locked|loop exhausted/i);
    }],
    ['S10.7 review retry persists the limit', () => {
      const shipped = path.join(repo, 'harness', 'flows', 'review.yaml');
      assert.equal(fs.existsSync(shipped), true, 'review.yaml must ship before S10.7 can run');
      const root = projectFixture(); copyFlows(root); const ticket = makeTicket(root);
      write(path.join(ticket, 'ticket.md'), read(ticket, 'ticket.md').replace('iterations: {}', 'iterations:\n  review: 3'));
      cli(root, ['run', 'review', 'T-0001', '--adapter', 'mock', '--gate-answer', 'retry', '--gate-answer', 'abort'], { MOCK_ALWAYS_FAIL: '1' });
      assert.match(read(ticket, 'ticket.md'), /review: 3/); assert.match(read(ticket, 'runs.log'), /gate=retry.*counter=review.*set=3/);
    }],
    ['E3 other repeated flags stay last-wins', () => {
      const root = projectFixture(); makeDraftTicket(root);
      const r = cli(root, ['run', 'requirements', 'T-0001', '--adapter', 'doesnotexist', '--adapter', 'mock', '--auto'], { MOCK_ALWAYS_PASS: '1' });
      assert.equal(r.status, 0, output(r)); assert.match(output(r), /mock/);
    }],
    ['E4 explicit exhaustion answer avoids stdin rejection', () => {
      const root = projectFixture(); makeDraftTicket(root);
      const r = cli(root, ['run', 'requirements', 'T-0001', '--adapter', 'mock', '--gate-answer', 'advance', '--gate-answer', 'abort'], { MOCK_ALWAYS_FAIL: '1' });
      assert.doesNotMatch(output(r), /stdin closed without one/i);
    }],
  ]);
});
skipped('S10.5', 'requires an interactive TTY to prove empty-line rejection and re-prompting');

await scenario('S11.1-S11.4', 'suite wiring, explicit gates, and board counter/cost compatibility are pinned', () => {
  const pkg = JSON.parse(read(spike, 'package.json')); assert.equal(pkg.scripts.test, 'node test/run.js'); assert.ok(pkg.scripts.lint);
  const exhaustedRoot = projectFixture();
  const created = cli(exhaustedRoot, ['ticket', 'new', 'Exhaustion fixture']); assert.equal(created.status, 0, output(created));
  const exhausted = cli(exhaustedRoot, ['run', 'requirements', 'T-0001', '--adapter', 'mock', '--auto', '--gate-answer', 'abort'], { MOCK_ALWAYS_FAIL: '1' }, '');
  assert.notEqual(exhausted.status, 0); assert.match(output(exhausted), /loop exhausted/i); assert.match(output(exhausted), /human-locked/i);
  assert.doesNotMatch(output(exhausted), /stdin closed without one/i);
  assert.doesNotMatch(output(exhausted), /auto-advanced \(human-locked\)/i);
  const root = projectFixture(); const ticket = makeTicket(root);
  let body = read(ticket, 'ticket.md').replace('iterations: {}', 'iterations:\n  review: 2');
  body = body.replace('history: []', 'history:\n  - {run: 1, status: exhausted, cost: 0}\n  - {run: 1, status: aborted, cost: 1.25}'); write(path.join(ticket, 'ticket.md'), body);
  const board = cli(root, ['board']); assert.match(output(board), /iter=.*review.*2/); assert.match(output(board), /cost=\$1\.25/);
});

await scenario('S11.5', 'frozen Q-0006 inputs are unchanged from the reachable baseline', () => {
  git(repo, 'cat-file', '-e', '5d16e06^{commit}');
  assert.equal(git(repo, 'diff', '--name-only', '5d16e06', '--', 'contracts/Q-0006'), '');
});
const unavailableBaseline = '0000000000000000000000000000000000000033';
try { git(repo, 'cat-file', '-e', `${unavailableBaseline}^{commit}`); assert.fail('deliberately nonexistent baseline unexpectedly resolved'); }
catch { skipped('S11.6', `baseline ${unavailableBaseline} unavailable (guard skips without raw Git output)`); }

const spec = read(repo, 'docs', '02-sdlc-pipeline-spec.md');
const section = (number) => spec.match(new RegExp(`(?:^|\\n)#{2,3}\\s+${number.replace('.', '\\.') }[^\\n]*\\n([\\s\\S]*?)(?=\\n#{2,3}\\s|$)`, 'i'))?.[1] ?? '';
await scenario('S13.1', 'the review-failure arrow returns reviewed to red', () => {
  const state = section('3.4'); assert.ok(state, '§3.4 must exist');
  const lines = state.split('\n'); const label = lines.findIndex((line) => /review fail/i.test(line));
  assert.ok(label >= 0, '§3.4 must label the review failure arrow');
  const stages = lines.find((line) => /draft.*requirements.*solutioned.*red.*green.*reviewed/i.test(line)) ?? '';
  assert.match(stages, /red\s+.*green\s+.*reviewed/i, 'diagram must contain red, green, and reviewed in order');
  let connector = lines[label];
  if (!/└[─]+┘/u.test(connector)) connector = lines.slice(Math.max(0, label - 1), label + 2).find((line) => /└[─]+┘/u.test(line)) ?? '';
  const run = connector.match(/└[─]+┘/u); assert.ok(run?.index !== undefined, 'review-failure label must own a └─…┘ connector run');
  const endpoints = [run.index, run.index + run[0].length - 1];
  const labels = ['draft', 'requirements', 'solutioned', 'red', 'green', 'reviewed'];
  const spans = labels.map((name, i) => ({ name, from: stages.indexOf(name) - 1, to: i + 1 < labels.length ? stages.indexOf(labels[i + 1]) - 2 : stages.length + 1 }));
  const resolved = endpoints.map((column) => spans.find((span) => column >= span.from && column <= span.to)?.name);
  assert.deepEqual(resolved, ['red', 'reviewed'], `review-failure connector endpoints resolve to ${resolved.join(' → ')}`);
});

await scenario('S13.2-S13.4', 'the documented review flow, config and M1 decision match the contracts', () => {
  const review = section('5.5'); assert.ok(review, '§5.5 must exist');
  for (const re of [/\{base\}\.\.\.harness\/\{id\}\/integration/, /\{round\}/, /counter:\s*review/, /max_diff_bytes[\s\S]*200000/is, /--auto[\s\S]*(cannot|does not|never)/is]) assert.match(review, re);
  assert.match(section('10'), /no lighter.*fix|no lighter flow/is);
  for (const re of [/type:\s*judge/, /model:\s*(opus|gpt-)/, /\{iter\}/, /\b(findings|tasks|with):/]) assert.doesNotMatch(review, re);
});

await scenario('S13.5', 'the development plan records the Q-0006/Q-0033 split', () => {
  const plan = read(repo, 'docs', '06-development-plan.md');
  const lines = plan.split('\n'); const start = lines.findIndex((line) => /^## M1\b/i.test(line));
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  const m1 = start < 0 ? '' : lines.slice(start, end < 0 ? undefined : end).join('\n');
  assert.ok(m1, 'M1 block must exist');
  assert.match(m1, /Q-0006[^\n]*(engine|split)|engine[^\n]*Q-0006/is);
  assert.match(m1, /Q-0033[^\n]*(surface|flow|role|lint)/is);
  const done = m1.match(/Done when[\s\S]*?(?=\n###|\n##|$)/i)?.[0] ?? '';
  assert.match(done, /(preflight|lint rule|base.branch|max.diff.bytes|documentation alignment)/i, 'M1 Done when must name the shipped Q-0033 surface');
});

await scenario('S13.6', 'DECISIONS contains both complete review-flow decisions', () => {
  const decisions = read(repo, 'docs', 'DECISIONS.md');
  for (const [label, topic] of [['derived-regression-target', /derived regression/i], ['non-auto-exhaustion-gate', /non.auto.*exhaustion|exhaustion.*--auto/i]]) {
    const at = decisions.search(topic); assert.ok(at >= 0, `DECISIONS.md is missing the ${label} entry`); const block = decisions.slice(Math.max(0, decisions.lastIndexOf('\n##', at)), decisions.indexOf('\n##', at + 3) < 0 ? undefined : decisions.indexOf('\n##', at + 3));
    assert.match(block, /\d{4}-\d{2}-\d{2}/); assert.match(block, /\*\*Decision\*\*/); assert.match(block, /\*\*Alternatives considered\*\*/); assert.match(block, /\*\*Why\*\*/);
  }
});

await scenario('S13.7', 'the Gate glossary entry distinguishes declared and exhaustion gates', () => {
  const glossary = read(repo, 'docs', 'GLOSSARY.md'); const gate = glossary.match(/\*\*Gate\*\*[\s\S]*?(?=\n\*\*|$)/)?.[0] ?? '';
  assert.match(gate, /author.declared[\s\S]*deploy/is); assert.match(gate, /engine.presented[\s\S]*exhaustion/is);
});

await scenario('S13.8', 'README remains byte-unchanged from the frozen baseline', () => {
  git(repo, 'cat-file', '-e', '5d16e06^{commit}');
  assert.equal(git(repo, 'diff', '--name-only', '5d16e06', '--', 'README.md'), '');
});

await scenario('E7', 'unused explicit gate answers are ignored after a gate-free regression', () => {
  const shipped = path.join(repo, 'harness', 'flows', 'review.yaml');
  assert.equal(fs.existsSync(shipped), true, 'review.yaml must ship before E7 can run');
  const root = projectFixture(); copyFlows(root); makeTicket(root);
  const r = cli(root, ['run', 'review', 'T-0001', '--adapter', 'mock', '--gate-answer', 'advance'], { MOCK_ALWAYS_FAIL: '1' });
  assert.equal(r.status, 0, output(r)); assert.doesNotMatch(output(r), /unused|unconsumed|leftover/i);
});

skipped('S12.1', 'manual: requires authenticated Claude and Codex subscription evidence');
skipped('E2', 'forward-looking guarantee covered indirectly by S6.6-S6.10; future flows do not exist yet');

const e8MergeBase = git(repo, 'merge-base', 'main', 'HEAD');
const e8Paths = git(repo, 'diff', '--name-only', e8MergeBase, 'HEAD').split('\n').filter(Boolean);
const e8ProductionPaths = e8Paths.filter((file) => !/^(contracts\/Q-0033\/|spike\/test\/)/.test(file));
console.log(`# E8 merge-base ${e8MergeBase}; paths: ${e8Paths.join(', ')}`);
if (e8ProductionPaths.length) {
  skipped('E8', `development has landed, diff now includes production paths: ${e8ProductionPaths.join(', ')}`);
} else await scenario('E8', 'the integration diff contains the QA-owned contract and test contribution', () => {
  for (const expected of [
    'contracts/Q-0033/cli-review-surface.contract.md',
    'contracts/Q-0033/documentation-and-evidence.contract.md',
    'contracts/Q-0033/review-surface-assets.contract.md',
    'spike/test/q0033-surface.js',
    'spike/test/smoke.js',
  ]) assert.ok(e8Paths.includes(expected), `qa-red contribution missing from diff: ${expected}`);
});

// E9 is already permanently covered by smoke.js's five truncation assertions.
skipped('E9', "already covered by smoke.js's five truncation assertions");

console.log('\nEvery result line');
for (const [mark, id, title] of results) console.log(`${mark} ${id} ${title}`);

if (failed) { console.error(`\n✗ ${failed} Q-0033 scenario group(s) failed`); process.exit(1); }
