// Q-0006 contract and asset tests. These tests intentionally avoid a JSON Schema
// validator for the review artifact clauses: the clauses below are the executable
// acceptance tests, not a second opaque validator invocation.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const spike = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(spike, '..');
const contractDir = path.join(repo, 'contracts', 'Q-0006');
let failures = 0;
const check = (condition, message) => {
  if (condition) console.log(`✓ ${message}`);
  else { failures += 1; console.error(`✗ ${message}`); }
};
const text = (file) => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sameYaml = (a, b) => {
  if (!fs.existsSync(a) || !fs.existsSync(b)) return false;
  const clean = (v) => { const x = structuredClone(v); delete x.file; return x; };
  return JSON.stringify(clean(YAML.parse(text(a)))) === JSON.stringify(clean(YAML.parse(text(b))));
};

const flowContract = path.join(contractDir, 'review-flow.contract.yaml');
const review = path.join(repo, 'harness', 'flows', 'review.yaml');
const reviewTemplate = path.join(spike, 'templates', 'harness', 'flows', 'review.yaml');
const role = path.join(repo, 'harness', 'roles', 'code-reviewer.md');
const roleTemplate = path.join(spike, 'templates', 'harness', 'roles', 'code-reviewer.md');

// AC-1, AC-3, AC-4, AC-6, AC-7, AC-13, AC-16, AC-30, EDGE-15.
check(sameYaml(review, flowContract), 'AC-1/3/4/6/7/13/16: shipped review flow equals its frozen contract');
check(fs.existsSync(review) && fs.existsSync(reviewTemplate) && text(review) === text(reviewTemplate), 'AC-1: review flow and template are byte-identical');
if (fs.existsSync(review)) {
  const f = YAML.parse(text(review));
  const panel = f.steps?.[0]?.parallel ?? [];
  const verdict = f.steps?.find((s) => s.id === 'verdict');
  check(f.name === 'review' && f.consumes === 'green' && f.produces === 'reviewed' && f.cross_vendor === 'required', 'AC-1: review flow declares its stage and vendor contract');
  check(panel.length === 2 && new Set(panel.map((s) => s.adapter)).size === 2 && panel.some((s) => s.adapter === 'claude') && panel.some((s) => s.adapter === 'codex'), 'AC-4/26: panel spans claude and codex');
  check(panel.every((s) => !('worktree' in s) && !('instructions' in s)), 'AC-5/EDGE-15: reviewers are read-only and carry no local instructions');
  check(panel.every((s) => s.input?.diff === '{base}...harness/{id}/integration'), 'AC-10/11/EDGE-5: panel uses the three-dot configured-base range');
  check(verdict && !('diff' in (verdict.input ?? {})) && verdict.output?.writes?.includes('review/verdict.md'), 'AC-6/9: verdict excludes the diff and writes the stable latest path');
  check(verdict?.on_fail?.goto === 'flow:development' && verdict.on_fail.counter === 'review' && verdict.on_fail.max_iterations === 3 && verdict.on_fail.on_exhausted === 'gate', 'AC-13/15/16/17: bounded cross-flow edge uses an unprefixed counter');
  check(/nits alone approve/i.test(verdict?.instructions ?? '') && /blocker or major/i.test(verdict?.instructions ?? ''), 'AC-7/EDGE-15: verdict owns the literal severity threshold');
  check(!/type:\s*judge|on_fail:\s*[\s\S]*?\bwith:|\bfindings:\s*true|\btasks:\s*true/.test(text(review)), 'AC-3: flow contains no invented engine fields');
}

// AC-2 and EDGE-14.
check(fs.existsSync(role) && text(role) === text(roleTemplate), 'AC-2: code-reviewer role and template are byte-identical');
const roleBody = text(role);
check(/read.only/i.test(roleBody) && /blocker/i.test(roleBody) && /major/i.test(roleBody) && /nit/i.test(roleBody) && /file:line/i.test(roleBody), 'AC-2: reviewer persona specifies read-only severity and citations');
check(!/^\s*model:/m.test(roleBody), 'AC-2: reviewer role pins no model');
const architecture = text(path.join(repo, 'harness', 'architecture.md'));
const backendRole = text(path.join(repo, 'harness', 'roles', 'developer-backend.md'));
const starterBackend = text(path.join(spike, 'templates', 'harness', 'roles', 'developer-backend.md'));
check(/backend.*`spike\/`, `harness\/`, `docs\/`, `backlog\/`/.test(architecture) && /spike\//.test(backendRole) && !/contracts\//.test((backendRole.match(/allowed[\s\S]{0,500}/i) ?? [''])[0]), 'EDGE-14: backend allow-list agrees and excludes contracts');
check(/services\/api/.test(starterBackend) && /packages\/domain/.test(starterBackend) && !/\bspike\//.test(starterBackend), 'EDGE-14: adopter backend role retains adopter paths');

// EDGE-2: execute every review-artifact clause directly, with no validator dependency.
const artifactSchema = json(path.join(contractDir, 'review-artifacts.schema.json'));
const verdictBranch = artifactSchema.oneOf.find((x) => x.title === 'Verdict output');
const findingPattern = new RegExp(verdictBranch.properties.findings.items.pattern);
function validVerdict(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.keys(value).some((k) => !['summary', 'document', 'verdict', 'findings'].includes(k))) return false;
  if (!['summary', 'document', 'verdict', 'findings'].every((k) => Object.hasOwn(value, k))) return false;
  if (typeof value.summary !== 'string' || !value.summary || typeof value.document !== 'string' || !value.document) return false;
  if (!verdictBranch.properties.verdict.enum.includes(value.verdict) || !Array.isArray(value.findings)) return false;
  if (!value.findings.every((f) => typeof f === 'string' && findingPattern.test(f))) return false;
  return value.verdict === 'approve' ? value.findings.length === 0 : value.findings.length > 0;
}
const shaped = [
  [{ summary: 'ok', document: 'review', verdict: 'approve', findings: [] }, true, 'approve with no findings'],
  [{ summary: 'bad', document: 'review', verdict: 'changes-requested', findings: ['major: src/a.js:12 explain the defect'] }, true, 'real-vendor-shaped rejection'],
  [{ summary: 'bad', document: 'review', verdict: 'approve', findings: ['nit: a.js:1 no'] }, false, 'approve with findings'],
  [{ summary: 'bad', document: 'review', verdict: 'changes-requested', findings: [] }, false, 'rejection without findings'],
  [{ summary: 'bad', document: 'review', verdict: 'changes-requested', findings: ['major: missing-line explain'] }, false, 'malformed citation'],
  [{ summary: 'bad', document: 'review', verdict: 'maybe', findings: [] }, false, 'unknown verdict enum'],
  [{ summary: 'bad', document: 'review', verdict: 'approve', findings: [], extra: true }, false, 'additional key'],
];
for (const [value, expected, label] of shaped) check(validVerdict(value) === expected, `EDGE-2/AC-23 schema clause: ${label}`);

// EDGE-11: the additive ticket schema accepts legacy and current shapes.
const ticketSchema = json(path.join(contractDir, 'ticket-review-state.schema.json'));
const { validate } = await import('../src/contracts.js');
const legacy = { stage: 'green', iterations: {}, history: [{ stage: 'green', run: 1, flow: 'development', at: '2026-08-22T00:00:00Z', cost: 1 }] };
const current = { stage: 'green', iterations: { review: 4 }, history: [{ stage: 'green', run: 2, flow: 'review', status: 'exhausted', stage_before: 'green', stage_after: 'green', at: '2026-08-22T00:00:00Z', cost: 0 }] };
check(validate(ticketSchema, legacy).ok, 'EDGE-11: legacy history validates without migration');
check(validate(ticketSchema, current).ok, 'AC-22/EDGE-12: current exhausted event validates');
check(!validate(ticketSchema, { ...current, history: [{ ...current.history[0], cost: 1 }] }).ok, 'EDGE-12: exhaustion presentation cost must be zero');

// This deliberately exposes a frozen-contract contradiction instead of weakening EDGE-1:
// scenarios require retry to persist 3, while the current runtime contract says 2.
const runtimeContract = text(path.join(contractDir, 'review-runtime.contract.md'));
check(/retry sets only[\s\S]{0,120}max_iterations(?!\s*-\s*1)[\s\S]{0,120}persisted value `3`/i.test(runtimeContract), 'EDGE-1: runtime contract requires retry to persist exactly max_iterations (3)');

// AC-30 documentation, AC-29 dependency freeze, EDGE-13 contract freeze/parsing.
const docs = ['README.md', 'docs/02-sdlc-pipeline-spec.md', 'docs/06-development-plan.md', 'docs/DECISIONS.md', 'docs/GLOSSARY.md'].map((p) => text(path.join(repo, p))).join('\n');
for (const [needle, label] of [
  ['harness run review', 'README review command'], ['{round}', 'round variable'], ['counter: review', 'counter spelling'],
  ['three-dot', 'three-dot diff'], ['exhaust', 'exhaustion gate'], ['derived', 'derived regression'],
]) check(docs.toLowerCase().includes(needle.toLowerCase()), `AC-30 docs include ${label}`);
const pkg = json(path.join(spike, 'package.json'));
check(Object.keys(pkg.dependencies ?? {}).sort().join(',') === 'ajv,ajv-formats,yaml', 'AC-29/EDGE-2: no new npm dependency was added');
check(fs.readdirSync(contractDir).length === 7 && artifactSchema.$id === 'Q-0006/review-artifacts' && ticketSchema.$id === 'Q-0006/ticket-review-state', 'EDGE-13: frozen contract set remains present and parseable');
let contractDiff = '';
try { contractDiff = execFileSync('git', ['diff', '--', 'contracts/Q-0006'], { cwd: repo, encoding: 'utf8' }); } catch { contractDiff = 'git diff failed'; }
check(contractDiff === '', 'EDGE-13: contracts/Q-0006 is byte-identical to the checked-in contracts commit');

if (failures) {
  console.error(`\n✗ ${failures} Q-0006 contract/asset assertion(s) failed`);
  process.exit(1);
}
