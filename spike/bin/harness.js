#!/usr/bin/env node
// harness — spike CLI. Commands:
//   harness init [dir]                      copy templates into <dir>/harness and create backlog/
//   harness ticket new "<title>" [--intent "..."] [--owner name] [--id Q-0081]
//   harness board                           kanban of tickets by stage
//   harness run <flow> <ticket> [--auto] [--dry] [--adapter mock] [--gate-answer advance|retry|abort]   exits 2 aborted, 3 gate unanswered
//   harness lint                            lint the whole flow directory (structure + cross-flow edges)
//   harness adapters [--probe] [--json]     CLIs installed + no API keys; --probe also proves login
//   harness validate <schema.json> <file…>  check artifacts against a contract; exit 1 on failure
//   harness runs [ticket|run-id] [--json]   run history: list, filter by ticket, or show one run
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { Backlog, STAGES, parseTicketId } from '../src/backlog.js';
import { loadFlow, loadFlowByName, runFlow, FlowError, GateUnansweredError, lintFlowDirectory } from '../src/engine.js';
import { getAdapter, probeAdapter } from '../src/adapters/index.js';
import { validateArtifact, readData } from '../src/contracts.js';
import { IntegrationError } from '../src/fanout.js';
import { containment } from '../src/git.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const k = args[i].slice(2);
    const v = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
    // Only --gate-answer accumulates: a non-interactive run may cross several gates in one
    // invocation and each needs its own answer, in order. Every other flag stays last-wins,
    // which is what the rest of the CLI (and its existing consumers) already expect. See Q-0033.
    if (k === 'gate-answer') flags[k] = [...(flags[k] ?? []), v];
    else flags[k] = v;
  }
  else positional.push(args[i]);
}
const [cmd, ...rest] = positional;
// Consumed one per gate, in the order they were passed on the command line.
const gateAnswers = [...(flags['gate-answer'] ?? [])];

const c = { dim: (s) => `\x1b[2m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m`, amber: (s) => `\x1b[33m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, teal: (s) => `\x1b[36m${s}\x1b[0m` };

function findProject(start = process.cwd()) {
  let d = start;
  while (true) {
    if (fs.existsSync(path.join(d, 'harness', 'harness.yaml'))) return d;
    const up = path.dirname(d); if (up === d) return null; d = up;
  }
}

function loadProject() {
  const repoDir = flags.project ? path.resolve(flags.project) : findProject();
  if (!repoDir) die('no harness/harness.yaml found — run `harness init` in your repo');
  const harnessDir = path.join(repoDir, 'harness');
  const config = YAML.parse(fs.readFileSync(path.join(harnessDir, 'harness.yaml'), 'utf8')) ?? {};
  const backlogRoot = path.resolve(repoDir, config.backlog?.path ?? 'backlog');
  return { repoDir, harnessDir, config, backlog: new Backlog(backlogRoot) };
}

const ui = {
  info: (m) => console.log(c.dim('·') + ' ' + m),
  warn: (m) => console.log(c.amber('!') + ' ' + m),
  step: (id, m) => console.log(c.teal('▸') + ' ' + c.bold(id) + ' ' + c.dim(m)),
  done: (id, m) => console.log(c.green('✓') + ' ' + c.bold(id) + ' ' + c.dim(m)),
  trace: (id, e) => {
    if (flags.verbose && e.type === 'stdout') console.log(c.dim(`  [${id}] ${e.line.slice(0, 160)}`));
    if (e.type === 'spawn') console.log(c.dim(`  [${id}] $ ${e.cmd}`));
    // Always shown, verbose or not: a run that goes quiet for 30s should say why.
    if (e.type === 'retry') console.log(c.amber('↻') + ` ${id}: ${e.reason} — attempt ${e.attempt}/${e.of} failed, retrying in ${Math.round(e.delayMs / 1000)}s` + c.dim(`\n    ${e.message}`));
  },
  gate: async ({ kind, reason, ticketDir, retry }) => {
    console.log('\n' + c.amber('■ GATE') + ` (${kind}) ${reason}`);
    console.log(c.dim(`  inspect: ${ticketDir}`));
    const opts = retry ? 'advance / retry / abort' : 'advance / abort';
    const allowed = retry ? ['advance', 'retry', 'abort'] : ['advance', 'abort'];
    // A scripted gate answer is exact and consumed once, in order — no prefixes, no falling
    // through to the next queued answer. A gate is never silently invented, so an answer that
    // is not valid for THIS gate is an error, not a skip. See Q-0033.
    if (gateAnswers.length) {
      const raw = gateAnswers.shift();
      const answer = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
      if (!allowed.includes(answer)) {
        throw new FlowError(`gate (${kind}) "${reason}" received --gate-answer "${typeof raw === 'string' ? raw.trim() : String(raw)}" — expected exactly one of: ${opts} (no abbreviations)`);
      }
      console.log(c.dim(`  ${opts} > ${answer}  (from --gate-answer)`));
      return answer;
    }
    // Explicit answers are exhausted. A non-interactive run has nowhere left to get a decision
    // from, so it stops here rather than reading whatever happens to be sitting on stdin (which
    // used to resolve as an accidental answer, or as '' → advance) or hanging forever. See
    // Q-0011 / Q-0033. Typed rather than plain since Q-0040: nobody was there, which the engine
    // classifies `undecided` — the wording below is unchanged and is still what the operator reads.
    if (!process.stdin.isTTY) {
      throw new GateUnansweredError(`gate (${kind}) "${reason}" needs an answer and stdin closed without one — pass --gate-answer ${retry ? 'advance|retry|abort' : 'advance|abort'} (repeatable, consumed in order), or run interactively`, { kind, reason, condition: 'answers-exhausted' });
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // On a TTY, readline swallows Ctrl-C and emits 'SIGINT' on itself; without this the engine's
    // handler never runs and the interrupted run leaves no record. See Q-0004.
    rl.on('SIGINT', () => { rl.close(); process.kill(process.pid, 'SIGINT'); });
    // A gate is a decision, so it is never defaulted and never waits forever. Closed stdin used to
    // resolve as '' → advance, which is how a human-locked gate got walked through by a suite that
    // supplied no input; and once that defaulting was removed the same gate blocked a run for 24
    // minutes with no output. Both are errors now, and both say which gate. See Q-0011.
    const answer = await new Promise((resolve, reject) => {
      let answered = false;
      rl.question(`  ${opts} > `, (a) => { answered = true; resolve(a); });
      rl.on('close', () => {
        if (!answered) reject(new GateUnansweredError(`gate (${kind}) "${reason}" needs an answer and stdin closed without one — run it interactively, or answer it on stdin`, { kind, reason, condition: 'stdin-closed' }));
      });
    });
    rl.close();
    const a = answer.trim().toLowerCase();
    if (!a) throw new FlowError(`gate (${kind}) "${reason}" was given an empty answer — say advance, retry or abort; a gate is never assumed`);
    if (a.startsWith('ad')) return 'advance';
    if (a.startsWith('r') && retry) return 'retry';
    if (a.startsWith('ab')) return 'abort';
    throw new FlowError(`gate (${kind}) "${reason}" did not understand "${answer.trim()}" — expected ${opts}`);
  },
};

function die(m) { console.error(c.red('✗ ') + m); process.exit(1); }

// --- Q-0011 run history: reader ----------------------------------------
// Reads .quorum/runs/ back for a human. Never repairs or infers persisted state — see
// contracts/Q-0011/runs-cli.contract.md. Deliberately not in spike/src: the reader is scheduled
// to be replaced during the M2 TypeScript port and would otherwise be a cross-role dependency.
// The ticket-id grammar it resolves a token against is parseTicketId in spike/src/backlog.js — one
// spelling per tree, so the token `harness runs` resolves and the id `ticket new` allocates cannot
// drift apart. See Q-0080.

// Resolves symlinks and returns null when the path does not exist or cannot be resolved. Used for
// confinement checks, where a lexical comparison is not enough. See Q-0034.
function realPath(p) { try { return fs.realpathSync(p); } catch { return null; } }

// Parsing is not validity. A manifest of `{}` parses, so it used to render as a run with every
// field blank, and a type mismatch deeper in could throw during formatting and take the whole
// listing — including its valid siblings — down with it. The listing needs only enough shape to
// sort and render; full conformance is `harness validate`'s job against the contract schema.
// See Q-0034; found by Q-0011 review round 2.
function manifestShapeError(m) {
  if (m === null || typeof m !== 'object' || Array.isArray(m)) return 'manifest.json is not an object';
  const missing = ['run_id', 'ticket_id', 'status'].filter((k) => typeof m[k] !== 'string');
  if (missing.length) return `manifest.json is missing or mistyped: ${missing.join(', ')}`;
  if (!Array.isArray(m.steps)) return 'manifest.json steps is not an array';
  if (!Array.isArray(m.rollup)) return 'manifest.json rollup is not an array';
  return null;
}

function readRunsDir(runsRoot) {
  if (!fs.existsSync(runsRoot)) return { runs: [], warnings: [] };
  const entries = fs.readdirSync(runsRoot, { withFileTypes: true }).filter((d) => d.isDirectory());
  const runs = [];
  const warnings = [];
  for (const entry of entries) {
    const runId = entry.name;
    const manifestPath = path.join(runsRoot, runId, 'manifest.json');
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const shape = manifestShapeError(manifest);
      if (shape) warnings.push({ runId, message: shape });
      else runs.push({ runId, manifestPath, manifest });
    } catch (e) {
      warnings.push({ runId, message: e.code === 'ENOENT' ? 'missing manifest.json' : `malformed manifest.json (${e.message})` });
    }
  }
  return { runs, warnings };
}

function sortRuns(runs) {
  return [...runs].sort((a, b) => {
    const sa = a.manifest.started_at ?? '';
    const sb = b.manifest.started_at ?? '';
    if (sa !== sb) return sa < sb ? 1 : -1; // started_at descending
    const ra = a.manifest.run_id ?? a.runId;
    const rb = b.manifest.run_id ?? b.runId;
    return ra < rb ? -1 : ra > rb ? 1 : 0; // run_id ascending, plain string order
  });
}

function isIncomplete(manifest) { return manifest.status === 'running' || manifest.ended_at == null; }

function occurrenceSeq(occurrenceDir) {
  const m = /^steps\/(\d+)-/.exec(occurrenceDir ?? '');
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

// Input totals already include EVERY vendor-reported cache component, cache-write as well as
// cache-read: adapters/claude.js folds both cache_creation_input_tokens and cache_read_input_tokens
// into input_tokens. Adding cache_write_input_tokens back here counted it twice — roughly a 35%
// overstatement on the M0 figures, in the one number Q-0011 exists to report. The previous comment
// asserted cache-write was "a genuinely separate spend" and was simply wrong about the mapping.
// run-history-writer.contract.md settles it verbatim: "Input totals already include vendor-reported
// cache components; readers do not add them again." The cache fields stay on the row as a
// breakdown for anyone who wants the split; they are not summands. See Q-0034.
function vendorTokenTotal(row) {
  const parts = [row.input_tokens, row.output_tokens].filter((v) => v != null);
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}

// Three decimals, matching formatCost everywhere else in the product. At two, a real $0.004 step
// renders as $0.00 and becomes indistinguishable from a vendor that reported zero — the same
// confusion the tokens-only decision bans at $0.000, reached one digit earlier. See Q-0034.
const formatMoney = (v) => (v == null ? 'n/a' : `$${v.toFixed(3)}`);
const formatTokens = (v) => (v == null ? 'n/a' : String(v));

// Never a combined cross-vendor total — the tokens-only decision means one blended number would
// be fiction the moment a token-only vendor is in the mix.
function formatVendorSummary(row) {
  return `${row.vendor}: cost=${formatMoney(row.cost_usd)} tokens=${formatTokens(vendorTokenTotal(row))} unpriced_steps=${row.unpriced_steps}`;
}

// One occurrence's own usage, which is a different thing from a roll-up row and is now rendered as
// one. This line used to call formatVendorSummary with an `unpriced_steps` synthesised from the
// occurrence's own cost, printing a roll-up field over a single step where it can only be 0 or 1
// and says nothing the status does not; and it collapsed four separately measured fields into
// vendorTokenTotal's single sum, on the line whose whole job is to show what one step reported.
// The four measures stay separate here, each through formatTokens, so a null reads n/a and never
// 0 — and the cache pair is visible as the breakdown it is rather than folded away. Summing is
// still the roll-up's business, where formatVendorSummary does it. See Q-0037.
function formatOccurrenceUsage(u) {
  return `${u.vendor}: cost=${formatMoney(u.cost_usd)} input_tokens=${formatTokens(u.input_tokens)} `
    + `output_tokens=${formatTokens(u.output_tokens)} cached_input_tokens=${formatTokens(u.cached_input_tokens)} `
    + `cache_write_input_tokens=${formatTokens(u.cache_write_input_tokens)}`;
}

function statusLabel(status) {
  const paint = status === 'completed' ? c.green : status === 'running' ? c.amber : c.dim;
  return paint(status);
}

function runHeaderLine(m) {
  const stage = `${m.stage?.before ?? '?'} -> ${m.stage?.after ?? '?'}`;
  const duration = m.duration_ms == null ? 'duration=n/a' : `duration=${(m.duration_ms / 1000).toFixed(1)}s`;
  return `${c.bold(m.run_id)} ${c.dim(m.ticket_id)} ${m.flow} ${c.dim(stage)} ${statusLabel(m.status)} ${c.dim(duration)}`;
}

function printRunsListHuman(runs, warnings) {
  if (!runs.length) console.log(c.dim('· no runs found'));
  for (const { manifest: m } of runs) {
    console.log(runHeaderLine(m) + (isIncomplete(m) ? ' ' + c.amber('(incomplete)') : ''));
    for (const v of m.rollup ?? []) console.log('  ' + c.dim(formatVendorSummary(v)));
  }
  for (const w of warnings) console.log(c.amber('!') + ` ${w.runId}: ${w.message}`);
}

function runsListJSON(runs, warnings) {
  return {
    mode: 'list',
    runs: runs.map(({ manifest: m }) => ({
      run_id: m.run_id, ticket_id: m.ticket_id, flow: m.flow, stage: m.stage, status: m.status,
      started_at: m.started_at, ended_at: m.ended_at, duration_ms: m.duration_ms,
      incomplete: isIncomplete(m), rollup: m.rollup ?? [],
    })),
    warnings: warnings.map((w) => `${w.runId}: ${w.message}`),
  };
}

function printRunDetailHuman(runId, manifest, manifestPath, repoDir) {
  console.log(runHeaderLine(manifest));
  if (isIncomplete(manifest)) console.log(c.amber('! incomplete') + c.dim(` — ${path.relative(repoDir, manifestPath)}`));
  const steps = [...(manifest.steps ?? [])].sort((a, b) => occurrenceSeq(a.occurrence_dir) - occurrenceSeq(b.occurrence_dir));
  for (const s of steps) {
    const rel = path.join('.quorum', 'runs', runId, s.occurrence_dir).split(path.sep).join('/');
    console.log('  ' + c.teal(s.step_id) + ' ' + c.dim(rel));
    console.log('    ' + [
      `kind=${s.kind}`, `adapter=${s.adapter ?? 'n/a'}`, `model=${s.model ?? 'n/a'}`, statusLabel(s.status),
      `started_at=${s.started_at}`, `duration_ms=${s.duration_ms ?? 'n/a'}`, `attempts=${s.attempts}`, `verdict=${s.verdict ?? 'n/a'}`,
    ].join(' '));
    console.log('    usage: ' + (s.usage ? formatOccurrenceUsage(s.usage) : 'n/a'));
    if (s.error) console.log('    error: ' + `${s.error.category}: ${s.error.message}`);
  }
}

function runDetailJSON(manifest, manifestPath, repoDir) {
  return { mode: 'detail', run: manifest, incomplete: isIncomplete(manifest), manifest_path: path.relative(repoDir, manifestPath), warnings: [] };
}

// `git branch --show-current` names the current branch even on an unborn HEAD (a fresh
// `git init -b <name>` before the first commit), and prints an empty string — not an error —
// for detached HEAD. Both are "cannot name a branch" outcomes for our purposes, so both fall
// through to the caller's default. Outside a repository, or with a broken GIT_DIR, the command
// itself fails; stderr is never surfaced, so a stranger's first `harness init` never prints a
// raw `fatal:` line. See Q-0033.
function currentBranch(dir) {
  try {
    const name = execFileSync('git', ['branch', '--show-current'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return name || null;
  } catch { return null; }
}

// Whole-directory flow validation, shared by `lint` and the `run` preflight so the two report
// the identical diagnostic for the identical defect. The actual walk (target resolution, return
// chains, dead ends, ambiguity, cycles) lives once in src/lint.js's lintFlowDirectory; this only
// renders its per-file records into the CLI's colorized report. See
// contracts/Q-0006/review-lint.contract.md and Q-0033.
function lintDirectory(flowsDir) {
  const records = lintFlowDirectory(flowsDir);
  const report = records.map((record) => {
    const filename = path.basename(record.file);
    if (!record.problems.length) return c.green('✓') + ' ' + filename;
    const bullets = record.problems.flatMap((err) => {
      const parts = String(err).split('\n').map((l) => l.trim()).filter(Boolean);
      return parts.length > 1 && /invalid:$/.test(parts[0]) ? parts.slice(1) : parts;
    });
    return c.red('✗') + ' ' + filename + '\n' + bullets.map((l) => `  - ${l.replace(/^-+\s*/, '')}`).join('\n');
  });
  return { ok: records.every((record) => !record.problems.length), report };
}

function printReport(report) { for (const line of report) console.log(line); }

async function main() {
  switch (cmd) {
    case 'init': {
      const dir = path.resolve(rest[0] ?? '.');
      const dst = path.join(dir, 'harness');
      if (fs.existsSync(dst)) die(`${dst} already exists`);
      fs.cpSync(path.join(here, '..', 'templates', 'harness'), dst, { recursive: true });
      fs.mkdirSync(path.join(dir, 'backlog'), { recursive: true });
      // Best-effort: a nameable branch (including a fresh, unborn `git init -b <name>`) replaces
      // the template's default. Anything else — no repo, detached HEAD, a branch Git cannot name
      // — leaves the template's `main` untouched. Never fails init either way. See Q-0033.
      const branch = currentBranch(dir);
      if (branch) {
        const configFile = path.join(dst, 'harness.yaml');
        try {
          // parseDocument + setIn + toString edits only the one scalar and keeps every comment
          // and the rest of the file's formatting intact — a parse/stringify round trip would not.
          const doc = YAML.parseDocument(fs.readFileSync(configFile, 'utf8'));
          doc.setIn(['repo', 'base_branch'], branch);
          fs.writeFileSync(configFile, doc.toString());
        } catch { /* best-effort: the template's default base_branch remains valid */ }
      }
      console.log(c.green('✓') + ` harness/ and backlog/ created in ${dir}\n  next: harness adapters · harness ticket new "…" · harness run requirements T-0001`);
      return;
    }
    case 'ticket': {
      const { backlog } = loadProject();
      if (rest[0] !== 'new') die('usage: harness ticket new "<title>" --intent "..." [--id Q-0081]');
      const title = rest[1]; if (!title) die('title required');
      // An id the backlog refuses to allocate, or a folder it refuses to overwrite, is a sentence
      // and an exit code — not the Node stack the catch on the last line of this file would print.
      let t;
      try {
        t = backlog.create({ title, intent: flags.intent ?? title, owner: flags.owner, id: flags.id === undefined ? undefined : String(flags.id) });
      } catch (e) { die(e.message); }
      console.log(c.green('✓') + ` ${t.meta.id} created at ${path.relative(process.cwd(), t.dir)} (stage: draft)`);
      return;
    }
    case 'board': {
      const { backlog, harnessDir, repoDir, config } = loadProject();
      const tickets = backlog.list();
      const flows = fs.existsSync(path.join(harnessDir, 'flows')) ? fs.readdirSync(path.join(harnessDir, 'flows')).filter((f) => f.endsWith('.yaml')).map((f) => { try { return loadFlow(path.join(harnessDir, 'flows', f)); } catch { return null; } }).filter(Boolean) : [];
      // Stage and containment are different facts and the board shows both: the stage is the
      // ticket's position in the state machine, containment is where the code actually is, read
      // from git on every invocation and never persisted. Outside a git repository `where` is
      // null and every row renders exactly as before. See Q-0036.
      const base = config.repo?.base_branch ?? 'main';
      const where = containment(repoDir, base);
      // Every ticket names a branch from creation (backlog.js:64) and only an integrate step ever
      // creates one, so most name a ref that does not exist — 22 of this repository's 24 such
      // tickets are draft or abandoned. Reporting all of them would drown the column. An absent
      // branch is worth saying exactly where the stage claims the work is done and the branch is
      // the evidence for that claim: there it separates code nobody can locate from a ticket
      // nobody has started. Q-0070, whose own work was done by hand and reached no branch.
      const BRANCH_EXPECTED = new Set(['solutioned', 'red', 'green', 'reviewed', 'qa-passed', 'deployed']);
      let anyIndeterminate = false;
      for (const stage of STAGES) {
        const col = tickets.filter((t) => t.meta.stage === stage);
        if (!col.length && !['draft', 'requirements', 'solutioned'].includes(stage)) continue;
        const next = flows.find((f) => f.consumes === stage);
        console.log(c.bold(stage.padEnd(14)) + c.dim(next ? `→ harness run ${next.name} <id>` : ''));
        for (const t of col) {
          const cost = (t.meta.history ?? []).reduce((s, h) => s + (h.cost ?? 0), 0);
          const found = where?.stateOf(t.meta.branch);
          const spot = found?.reason === 'no branch' && !BRANCH_EXPECTED.has(t.meta.stage) ? null : found;
          if (spot?.state === 'indeterminate') anyIndeterminate = true;
          const token = spot == null ? ''
            : spot.state === 'contained' ? ` ${base}:contained`
              : spot.state === 'not-contained' ? ` ${base}:not-contained(+${spot.ahead})`
                : ` ${base}:indeterminate(${spot.reason})`;
          console.log(`  ${c.teal(t.meta.id)} ${t.meta.title}  ${c.dim(`owner=${t.meta.owner} cost=$${cost.toFixed(2)} iter=${JSON.stringify(t.meta.iterations ?? {})}${token}`)}`);
        }
      }
      // The roll-up can only see vendors that report a price. Saying so is the whole point of the
      // tokens-only decision (2026-08-22); an unlabelled total reads as the cost of the run.
      if (tickets.some((t) => (t.meta.history ?? []).length)) {
        console.log(c.dim('· cost = billed cost where the vendor reports one; steps on token-only vendors (codex) are not included'));
      }
      // Indeterminate means git could not answer here, not that the code is missing — a fresh or
      // shallow clone legitimately cannot say. Only printed when a row actually reads it.
      if (anyIndeterminate) {
        console.log(c.dim(`· indeterminate = the board cannot say whether that branch is contained in ${base} — git could not answer (missing ref, shallow clone, a failed git command), or the ticket's branch does not exist (no branch) — it does not mean the code is missing`));
      }
      return;
    }
    case 'lint': {
      const { harnessDir } = loadProject();
      const { ok, report } = lintDirectory(path.join(harnessDir, 'flows'));
      printReport(report);
      process.exit(ok ? 0 : 1);
    }
    case 'adapters': {
      const { config, repoDir } = loadProject();
      const report = [];
      for (const name of ['claude', 'codex']) {
        const adapter = getAdapter(name, config.adapters);
        let version = null;
        try { version = await adapter.check(); console.log(c.green('✓') + ` ${name}: ${version}`); }
        catch (e) { console.log(c.red('✗') + ` ${name}: ${e.message}`); report.push({ adapter: name, installed: false, error: e.message }); continue; }

        if (!flags.probe) { report.push({ adapter: name, installed: true, version, login: 'unverified' }); continue; }
        // check() only proves the binary exists. Only a real request proves the subscription answers.
        const p = await probeAdapter(adapter, { cwd: repoDir });
        if (p.ok) console.log('  ' + c.green('✓') + c.dim(` login verified — round-trip ${p.ms}ms${p.cost_usd != null ? `, $${p.cost_usd.toFixed(4)}` : ''}${p.tokens ? `, ${p.tokens} tokens` : ''}`));
        else console.log('  ' + c.red('✗') + ` ${c.bold('login not usable')}: ${p.error}`);
        report.push({ adapter: name, installed: true, version, login: p.ok ? 'verified' : 'failed', ...p });
      }
      if (!flags.probe) console.log(c.dim('· presence only — logins NOT verified; run `harness adapters --probe` before a real run'));
      if (flags.json) console.log(JSON.stringify({ probed: Boolean(flags.probe), adapters: report }, null, 2));
      return;
    }
    case 'validate': {
      // Runs from a qa-red `type: script` step, so a contract failure is a red test rather than
      // prose in a review. Exits non-zero on the first invalid file.
      const [schemaFile, ...dataFiles] = rest;
      if (!schemaFile || !dataFiles.length) die('usage: harness validate <schema.json> <file…>');
      // Read once here purely so an unreadable schema dies with its own message before any artifact
      // is opened. Selection itself is validateArtifact's, and is annotation-driven rather than
      // filename/$id-driven — see the "contracts are executable" decision and
      // contracts/Q-0011/runs-cli.contract.md. An absent or unrecognised annotation still runs
      // structural validation; it just never earns a run-manifest-specific green tick.
      try { readData(schemaFile); } catch (e) { die(`cannot read schema ${schemaFile}: ${e.message}`); }
      let bad = 0;
      for (const f of dataFiles) {
        let r;
        try { r = validateArtifact(schemaFile, f); }
        catch (e) { console.log(c.red('✗') + ` ${f}: ${e.message}`); bad += 1; continue; }
        // Derived from the outcome rather than from a boolean computed before the loop, and it
        // leads with WHY no pass applies. The old wording opened "run-manifest semantic checks
        // skipped", which over an unrelated contract reads as a check that was owed and missed —
        // sending an author looking for an annotation their schema was never supposed to carry.
        // It still says in as many words that run-manifest semantic checks were skipped and that
        // none ran, which is what contracts/Q-0011/runs-cli.contract.md:46-48 requires of it, and
        // it never says any passed: a skip is not a pass (DECISIONS 2026-08-25). See Q-0037.
        //
        // "no RECOGNISED annotation" rather than "no annotation": this one outcome covers an absent
        // annotation and a present-but-unsupported value alike — the reason is named for the
        // annotation being unrecognised, not for it being missing — so a notice claiming absence is
        // false over `x-quorum-contract: unknown-v1`. Q-0037 review round 1.
        if (!r.semantic.ran && r.semantic.reason === 'unrecognised-annotation') {
          console.log(c.dim('·') + ` ${f}: no recognised x-quorum-contract annotation, so no semantic contract applies — no run-manifest semantic checks ran; they were skipped as inapplicable, and run-manifest-v1 is the only contract defined`);
        }
        if (r.ok) console.log(c.green('✓') + ` ${f} matches ${r.schema}`);
        else { bad += 1; console.log(c.red('✗') + ` ${f} violates ${r.schema}:\n    ${r.errors.join('\n    ')}`); }
      }
      process.exit(bad ? 1 : 0);
    }
    case 'runs': {
      const { repoDir } = loadProject();
      const runsRoot = path.join(repoDir, '.quorum', 'runs');
      const token = rest[0];
      const jsonMode = Boolean(flags.json);
      // readRunsDir parses EVERY sibling manifest. Detail mode needs exactly one run directory, and
      // AC-13 requires reading only the selected run — calling this up front coupled a single-run
      // request to the health and size of its siblings, which is a real cost on a repository with a
      // year of history. Read lazily, in the two branches that genuinely list. See Q-0034.
      const listRuns = () => readRunsDir(runsRoot);

      if (token) {
        // A run id names a directory *directly inside* .quorum/runs and nothing else. Joining the
        // raw token let "..", a leading "/" or an absolute path walk out of the runs root: any
        // directory on the filesystem containing a manifest.json was accepted as a run, and --json
        // then echoed the parsed document to stdout. Require a single path segment and prove the
        // resolved parent IS the runs root before reading anything. See Q-0034 / AC-13.
        // Lexical confinement is necessary and NOT sufficient: path.resolve does no filesystem
        // work, and statSync follows links, so a single-segment symlink inside .quorum/runs/ passes
        // every string test and still reads a manifest anywhere on disk. Resolve both sides for
        // real and compare the results. See Q-0034 / AC-13; the lexical-only version was found by
        // Q-0011 review round 2.
        const realRoot = realPath(runsRoot);
        const exactDir = path.resolve(path.resolve(runsRoot), token);
        const realDir = realPath(exactDir);
        const confined = token === path.basename(token)
          && !['', '.', '..'].includes(token)
          && realRoot != null && realDir != null
          && path.dirname(realDir) === realRoot;
        if (confined && fs.existsSync(realDir) && fs.statSync(realDir).isDirectory()) {
          const manifestPath = path.join(realDir, 'manifest.json');
          let manifest;
          try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
          catch (e) {
            const message = `run "${token}": malformed manifest.json (${e.message})`;
            if (jsonMode) console.log(JSON.stringify({ error: message }));
            else console.error(c.red('✗ ') + message);
            process.exitCode = 1;
            return;
          }
          if (jsonMode) console.log(JSON.stringify(runDetailJSON(manifest, manifestPath, repoDir)));
          else printRunDetailHuman(token, manifest, manifestPath, repoDir);
          return;
        }
        if (parseTicketId(token)) {
          // A syntactically valid ticket id with zero matches exits 0; rendered warnings are a
          // separate question. runs-cli.contract.md states both rules and did not say which governs
          // when both apply, which is why the implementation and its test read it one way and both
          // round-2 panellists read it the other. Settled by erratum E-4
          // (backlog/Q-0011-…/solution/errata.md, 2026-08-24) in favour of store health: warnings
          // force a non-zero exit whatever the selection matched. See Q-0034.
          const { runs: allRuns, warnings } = listRuns();
          const filtered = sortRuns(allRuns.filter((r) => r.manifest.ticket_id === token));
          if (jsonMode) console.log(JSON.stringify(runsListJSON(filtered, warnings)));
          else printRunsListHuman(filtered, warnings);
          if (warnings.length) process.exitCode = 1;
          return;
        }
        const message = `unknown run or ticket: ${token}`;
        if (jsonMode) console.log(JSON.stringify({ error: message }));
        else console.error(c.red('✗ ') + message);
        process.exitCode = 1;
        return;
      }

      const { runs: allRuns, warnings } = listRuns();
      const sorted = sortRuns(allRuns);
      if (jsonMode) console.log(JSON.stringify(runsListJSON(sorted, warnings)));
      else printRunsListHuman(sorted, warnings);
      if (warnings.length) process.exitCode = 1;
      return;
    }
    case 'run': {
      const [flowName, ticketId] = rest;
      if (!flowName || !ticketId) die('usage: harness run <flow> <ticket> [--auto] [--dry] [--base <ref>] [--adapter mock] [--verbose] [--gate-answer advance|retry|abort]');
      // `--base <ref>` with no value parses to `true` in the generic flag parser: it names no
      // revision, so it is refused rather than coerced into the string "true" and interpolated into
      // a diff range. Checked here, with the other argument validation, so a malformed command
      // fails before anything is read from disk. See Q-0077.
      if (flags.base === true) die('--base needs a revision: harness run <flow> <ticket> --base <ref>');
      const proj = loadProject();
      // Reads the flow files fresh from disk, before the ticket is loaded, before anything is
      // written, and before `--adapter mock` rewrites any step's adapter in memory — a directory
      // that declares a legitimate cross-vendor panel must not appear single-vendor because
      // execution later overrides every step to the same adapter. See Q-0033.
      const { ok, report } = lintDirectory(path.join(proj.harnessDir, 'flows'));
      if (!ok) { printReport(report); process.exit(1); }
      const flow = loadFlowByName(flowName, proj.harnessDir);
      if (flags.adapter) { overrideAdapters(flow, flags.adapter); proj.config.adapterOverride = flags.adapter; }
      const ticket = proj.backlog.read(ticketId);
      try {
        const r = await runFlow({ flow, ticket, ...proj, ui, auto: Boolean(flags.auto), dry: Boolean(flags.dry), base: flags.base ?? null });
        // A run nobody answered is neither: 0 would tell a caller the gate was decided, and 1 is
        // what a genuine error returns, so a script wrapping this command could not tell them
        // apart. 0, 1, 2 and 130 were taken; 3 was free. See Q-0040.
        process.exit(r.status === 'aborted' ? 2 : r.status === 'undecided' ? 3 : 0);
      } catch (e) { if (e instanceof FlowError || e instanceof IntegrationError) die(e.message); throw e; }
    }
    default:
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 10).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  }
}

function overrideAdapters(flow, name) {
  for (const s of flow.steps) for (const x of s.parallel ?? [s]) if (x.adapter) x.adapter = name;
}

main().catch((e) => die(e.stack ?? String(e)));
