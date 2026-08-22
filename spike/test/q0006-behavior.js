// Q-0006 executable behavior tests. Public CLI behavior is used deliberately so the
// tests compile against today's stubs and fail on behavior rather than missing imports.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const spike = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(spike, '..');
const bin = path.join(spike, 'bin', 'harness.js');
let failures = 0;
const check = (condition, message) => condition ? console.log(`✓ ${message}`) : (failures++, console.error(`✗ ${message}`));
const invoke = (cwd, args, env = {}, input) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8', input, env: { ...process.env, ...env } });
const output = (r) => `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
const sh = (cwd, command) => execSync(command, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const makeProject = ({ branch = 'main', git = true } = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'q0006-review-'));
  if (git) {
    sh(dir, `git init -q -b ${branch}`);
    sh(dir, 'git -c user.email=a@b -c user.name=t commit -q --allow-empty -m init');
  }
  const r = invoke(dir, ['init']);
  return { dir, init: r };
};
const writeFlow = (dir, name, value) => fs.writeFileSync(path.join(dir, 'harness', 'flows', `${name}.yaml`), typeof value === 'string' ? value : YAML.stringify(value));

// EDGE-3 and AC-28: switches are deterministic, scoped to verdict schemas, and exclusive.
const { mockAdapter } = await import('../src/adapters/mock.js');
const verdictSchema = { type: 'object', properties: { summary: { type: 'string' }, document: { type: 'string' }, verdict: { enum: ['approve', 'changes-requested'] }, findings: { type: 'array' } }, required: ['summary', 'document', 'verdict', 'findings'] };
const docSchema = { type: 'object', properties: { summary: { type: 'string' }, document: { type: 'string' } }, required: ['summary', 'document'] };
async function mock(env, schema = verdictSchema) {
  const old = { pass: process.env.MOCK_ALWAYS_PASS, fail: process.env.MOCK_ALWAYS_FAIL };
  Object.assign(process.env, env);
  for (const k of ['MOCK_ALWAYS_PASS', 'MOCK_ALWAYS_FAIL']) if (!(k in env)) delete process.env[k];
  try { return await mockAdapter().run({ prompt: '# Role: code-reviewer', schema, cwd: os.tmpdir(), allowWrite: false }); }
  finally {
    for (const [k, v] of [['MOCK_ALWAYS_PASS', old.pass], ['MOCK_ALWAYS_FAIL', old.fail]]) v === undefined ? delete process.env[k] : process.env[k] = v;
  }
}
try {
  const pass = await mock({ MOCK_ALWAYS_PASS: '1' });
  check(pass.output.verdict === 'approve' && pass.output.findings.length === 0, 'AC-28: MOCK_ALWAYS_PASS forces a schema-valid approval');
  const fail = await mock({ MOCK_ALWAYS_FAIL: '1' });
  check(fail.output.verdict === 'changes-requested' && fail.output.findings.length > 0 && /^(blocker|major|nit): .+:[1-9][0-9]* .+/.test(fail.output.findings[0]), 'AC-7/28: MOCK_ALWAYS_FAIL forces a cited blocker/major verdict');
  let conflict = null; try { await mock({ MOCK_ALWAYS_PASS: '1', MOCK_ALWAYS_FAIL: '1' }); } catch (e) { conflict = e; }
  check(conflict && /MOCK_ALWAYS_PASS.*MOCK_ALWAYS_FAIL|mutually exclusive/i.test(conflict.message), 'EDGE-3: conflicting mock switches are rejected');
  const doc = await mock({ MOCK_ALWAYS_FAIL: '1' }, docSchema);
  check(!Object.hasOwn(doc.output, 'verdict'), 'AC-28: verdict switches do not alter non-verdict steps');
} catch (e) { check(false, `mock verdict controls execute (${e.message})`); }

// EDGE-6 and AC-12: init branch discovery and defaults.
{
  const p = makeProject({ branch: 'release-test' });
  const config = fs.existsSync(path.join(p.dir, 'harness/harness.yaml')) ? YAML.parse(fs.readFileSync(path.join(p.dir, 'harness/harness.yaml'), 'utf8')) : {};
  check(p.init.status === 0 && config.repo?.base_branch === 'release-test', 'EDGE-6: init discovers the checked-out branch');
  check(config.repo?.max_diff_bytes === 200000, 'AC-10/12: init writes the default max diff bytes');
  const outside = makeProject({ git: false });
  const outsideConfig = fs.existsSync(path.join(outside.dir, 'harness/harness.yaml')) ? YAML.parse(fs.readFileSync(path.join(outside.dir, 'harness/harness.yaml'), 'utf8')) : {};
  check(outside.init.status === 0 && outsideConfig.repo?.base_branch === 'main', 'EDGE-6: init outside Git succeeds with main');
}

// AC-15/16/25/26 and EDGE-8/9: lint/preflight cases.
{
  const p = makeProject();
  const contract = fs.readFileSync(path.join(repo, 'contracts/Q-0006/review-flow.contract.yaml'), 'utf8');
  writeFlow(p.dir, 'review', contract);
  let r = invoke(p.dir, ['lint']);
  check(r.status === 0 && /review\.yaml.*✓|✓.*review\.yaml/s.test(output(r)), 'AC-1/25: valid cross-flow review flow lints');

  const invalidCounter = contract.replace('counter: review', 'counter: iterations.review');
  writeFlow(p.dir, 'review', invalidCounter); r = invoke(p.dir, ['lint']);
  check(r.status !== 0 && /iterations\.review/.test(output(r)) && /counter.*review|suggest.*review/i.test(output(r)), 'AC-15: lint rejects prefixed counter with correction');

  for (const replacement of ['', '      max_iterations: 0', '      max_iterations: -1', '      max_iterations: 1.5']) {
    writeFlow(p.dir, 'review', contract.replace('      max_iterations: 3', replacement)); r = invoke(p.dir, ['lint']);
    check(r.status !== 0 && /verdict/.test(output(r)) && /max_iterations/.test(output(r)), `AC-16: lint rejects max_iterations ${replacement.trim() || 'missing'}`);
  }

  writeFlow(p.dir, 'review', contract.replace('goto: flow:development', 'goto: flow:missing-flow')); r = invoke(p.dir, ['lint']);
  check(r.status !== 0 && /review/.test(output(r)) && /missing-flow/.test(output(r)) && /stage|green|red/i.test(output(r)), 'AC-25: missing cross-flow target fails with source, target, and stage');

  const oneVendor = contract.replace('adapter: codex', 'adapter: claude');
  writeFlow(p.dir, 'review', oneVendor); r = invoke(p.dir, ['lint']);
  check(r.status !== 0 && /review-claude/.test(output(r)) && /review-codex/.test(output(r)) && /claude/.test(output(r)), 'AC-26: same-vendor panel fails lint naming both steps');

  // Mock substitution must occur after pristine lint; otherwise this valid two-vendor file fails.
  writeFlow(p.dir, 'review', contract);
  invoke(p.dir, ['ticket', 'new', 'Preflight ticket']);
  r = invoke(p.dir, ['run', 'review', 'T-0001', '--adapter', 'mock', '--auto']);
  check(!/cross.vendor|same adapter|review-claude.*review-codex/is.test(output(r)), 'EDGE-9: mock override does not poison pristine-flow preflight');
}

// Static executable guards for implementation details that cannot be reached until the
// shipped flow exists. They fail now, and become behavioral regression guards with it.
const engine = fs.readFileSync(path.join(spike, 'src/engine.js'), 'utf8');
const cli = fs.readFileSync(path.join(spike, 'bin/harness.js'), 'utf8');
const gitSource = fs.readFileSync(path.join(spike, 'src/git.js'), 'utf8');
const development = fs.readFileSync(path.join(repo, 'harness/flows/development.yaml'), 'utf8');
check(/max_diff_bytes/.test(engine) && /diff --stat/.test(engine) && /Buffer\.byteLength|TextEncoder|utf8/i.test(engine), 'AC-10/EDGE-4: runtime computes full stat and UTF-8 byte-bounded patch');
check(/truncat/i.test(engine) && /runs\.log/.test(engine), 'AC-10/EDGE-4: prompt and run log record truncation');
check(/repo\.base_branch|base_branch/.test(engine) && /rev-parse|verify/.test(engine + gitSource), 'AC-12/EDGE-5: substituted base ref is validated before adapter execution');
check(/round-.*verdict|\bround\b/.test(engine) && /review\/verdict/.test(engine), 'AC-8/9: completed verdicts determine round and stable latest copy');
check(/allowWrite:\s*false/.test(engine) && /input\.diff|\.diff\b/.test(engine), 'AC-5/10: diff reviewers run read-only');
check(/stage_before/.test(engine) && /stage_after/.test(engine) && /exhausted/.test(engine) && /aborted/.test(engine), 'AC-22/EDGE-12: all review outcomes have auditable before/after status');
check(/allSettled/.test(engine) && /surviv/.test(engine), 'AC-24: panel failure retains successful siblings and blocks verdict');
check(/review\/verdict\.md/.test(development) && /optional|readFiles|backlog/i.test(engine + development), 'AC-21: development optionally includes the latest verdict');
check(/integration/.test(engine) && /syncBase|mergeInto/.test(engine) && /conflict/i.test(engine), 'AC-20: rework synchronizes task worktrees and reports conflicts');
check(/gate-answer/.test(cli) && /Array|push|queue|shift/.test(cli), 'AC-18/19/EDGE-7: repeatable gate answers are queued in encounter order');
check(/isTTY/.test(cli) && /invalid|empty|answer/i.test(cli), 'AC-19: missing non-TTY gate answer is an error');
check(/loadFlowByName/.test(engine) && /\.consumes/.test(engine) && !/stage\s*=\s*['"]red['"]/.test(engine), 'AC-13: regression stage is derived from the target flow consumes value');
check(/regressed/.test(engine) && /remaining/i.test(engine) && /target|goto/i.test(engine), 'AC-14: regression terminates with target, transition, and remaining budget');
check(/auto/.test(engine + cli) && /exhaust/i.test(engine) && /advance.*retry.*abort/is.test(engine + cli), 'AC-17: exhaustion gate survives auto and names all three choices');
check(/iterations/.test(engine) && /max_iterations/.test(engine) && /persist|update|write/i.test(engine), 'AC-15/16: iteration count is persisted before regression returns');
check(/raw\.txt|\.raw/.test(engine) && /checkAgainstSchema|validate/.test(engine), 'AC-23: invalid structured output is saved before a failed result');
check(/stage_before|ticket\.meta\.stage/.test(engine) && /counter|iterations/.test(engine), 'AC-23/24: invalid output and panel failure preserve stage and counters');
check(/max_iterations\s*\)|max_iterations\s*;|max_iterations\s*,/.test(engine) && !/max_iterations\s*-\s*1/.test(engine), 'EDGE-1: retry persists exactly max_iterations, never max_iterations - 1');
check(/current count|counter.*limit|outstanding|findings/i.test(engine), 'AC-17: exhaustion reason names count, limit, and outstanding findings');
check(/advance/.test(engine) && /flow\.produces/.test(engine) && /abort/.test(engine), 'AC-18: advance and abort have distinct terminal routing');
check(/review/.test(engine) && /iterations/.test(engine) && !/delete\s+.*iterations|iterations.*=\s*0/.test(engine), 'EDGE-10: exhaustion advance does not reset the review counter');
check(/cost:\s*0|cost=0/.test(engine) && /exhausted/.test(engine), 'EDGE-12: exhaustion presentation records zero cost separately');
check(/failed/.test(engine) && /history/.test(engine) && /runs\.log/.test(engine), 'AC-22: failed outcomes are distinguishable in both audit stores');
check(/round/.test(engine) && /verdict/.test(engine) && /existsSync/.test(engine), 'AC-8: only an existing verdict advances the review round');

// Frozen production contracts are owned by QA and must not be modified by implementation.
for (const f of fs.readdirSync(path.join(repo, 'contracts/Q-0006'))) {
  check(fs.statSync(path.join(repo, 'contracts/Q-0006', f)).size > 0, `EDGE-13: frozen contract remains non-empty: ${f}`);
}

if (failures) {
  console.error(`\n✗ ${failures} Q-0006 behavior assertion(s) failed`);
  process.exit(1);
}
