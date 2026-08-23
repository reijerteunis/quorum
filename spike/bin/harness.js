#!/usr/bin/env node
// harness — spike CLI. Commands:
//   harness init [dir]                      copy templates into <dir>/harness and create backlog/
//   harness ticket new "<title>" [--intent "..."] [--owner name]
//   harness board                           kanban of tickets by stage
//   harness run <flow> <ticket> [--auto] [--dry] [--adapter mock]
//   harness lint                            lint all flows
//   harness adapters [--probe] [--json]     CLIs installed + no API keys; --probe also proves login
//   harness validate <schema.json> <file…>  check artifacts against a contract; exit 1 on failure
//   harness runs [ticket|run-id] [--json]   run history: list, filter by ticket, or show one run
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { Backlog, STAGES } from '../src/backlog.js';
import { loadFlow, loadFlowByName, runFlow, FlowError } from '../src/engine.js';
import { getAdapter, probeAdapter } from '../src/adapters/index.js';
import { validateFile, readData } from '../src/contracts.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) { const k = args[i].slice(2); const v = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true; flags[k] = v; }
  else positional.push(args[i]);
}
const [cmd, ...rest] = positional;

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
        if (!answered) reject(new FlowError(`gate (${kind}) "${reason}" needs an answer and stdin closed without one — run it interactively, or answer it on stdin`));
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

const TICKET_ID_PATTERN = /^[A-Z]+-[0-9]{4}$/;
const TERMINAL_STATUSES = ['completed', 'failed', 'aborted', 'regressed', 'exhausted', 'interrupted'];

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
      runs.push({ runId, manifestPath, manifest });
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

// cached_input_tokens is already counted inside input_tokens (writer contract); cache-write
// tokens are a genuinely separate spend, so they're added rather than double-counting cache reads.
function vendorTokenTotal(row) {
  const parts = [row.input_tokens, row.output_tokens, row.cache_write_input_tokens].filter((v) => v != null);
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}

const formatMoney = (v) => (v == null ? 'n/a' : `$${v.toFixed(2)}`);
const formatTokens = (v) => (v == null ? 'n/a' : String(v));

// Never a combined cross-vendor total — the tokens-only decision means one blended number would
// be fiction the moment a token-only vendor is in the mix.
function formatVendorSummary(row) {
  return `${row.vendor}: cost=${formatMoney(row.cost_usd)} tokens=${formatTokens(vendorTokenTotal(row))} unpriced_steps=${row.unpriced_steps}`;
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
    console.log('    usage: ' + (s.usage ? formatVendorSummary({ ...s.usage, unpriced_steps: s.usage.cost_usd == null ? 1 : 0 }) : 'n/a'));
    if (s.error) console.log('    error: ' + `${s.error.category}: ${s.error.message}`);
  }
}

function runDetailJSON(manifest, manifestPath, repoDir) {
  return { mode: 'detail', run: manifest, incomplete: isIncomplete(manifest), manifest_path: path.relative(repoDir, manifestPath), warnings: [] };
}

// --- Q-0011 run-manifest semantic validation ----------------------------
// Structural JSON Schema cannot tell a genuinely reported zero cost from an unpriced vendor's
// roll-up mutated null -> 0 (errata E-2). Recomputing the roll-up from occurrence usage can.

function computeManifestRollup(steps) {
  const groups = new Map();
  for (const s of steps ?? []) {
    if (!s.usage) continue;
    const vendor = s.usage.vendor;
    if (!groups.has(vendor)) groups.set(vendor, []);
    groups.get(vendor).push(s.usage);
  }
  const sum = (usages, key) => {
    const vals = usages.map((u) => u[key]).filter((v) => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };
  const rows = new Map();
  for (const [vendor, usages] of groups) {
    rows.set(vendor, {
      vendor,
      step_count: usages.length,
      unpriced_steps: usages.filter((u) => u.cost_usd == null).length,
      input_tokens: sum(usages, 'input_tokens'),
      output_tokens: sum(usages, 'output_tokens'),
      cached_input_tokens: sum(usages, 'cached_input_tokens'),
      cache_write_input_tokens: sum(usages, 'cache_write_input_tokens'),
      cost_usd: sum(usages, 'cost_usd'),
    });
  }
  return rows;
}

function checkRunManifestSemantics(data) {
  const errors = [];

  const seenDirs = new Set();
  for (const s of data.steps ?? []) {
    if (seenDirs.has(s.occurrence_dir)) errors.push(`steps: duplicate occurrence_dir "${s.occurrence_dir}"`);
    seenDirs.add(s.occurrence_dir);
  }

  const seenVendors = new Set();
  for (const r of data.rollup ?? []) {
    if (seenVendors.has(r.vendor)) errors.push(`rollup: duplicate vendor "${r.vendor}"`);
    seenVendors.add(r.vendor);
  }

  const terminal = TERMINAL_STATUSES.includes(data.status);
  if (terminal && (data.ended_at == null || data.duration_ms == null)) {
    errors.push(`run: terminal status "${data.status}" requires non-null ended_at and duration_ms`);
  }
  if (data.status === 'running' && (data.ended_at != null || data.duration_ms != null)) {
    errors.push('run: status "running" requires null ended_at and duration_ms');
  }
  if (data.started_at && data.ended_at && data.duration_ms != null) {
    const computed = Date.parse(data.ended_at) - Date.parse(data.started_at);
    if (computed !== data.duration_ms) errors.push(`run: duration_ms ${data.duration_ms} does not match ended_at - started_at (${computed})`);
  }

  for (const s of data.steps ?? []) {
    if (s.kind === 'adapter') {
      if (s.adapter == null) errors.push(`steps[${s.step_id}]: kind "adapter" requires non-null adapter`);
    } else {
      if (s.adapter != null) errors.push(`steps[${s.step_id}]: kind "${s.kind}" requires null adapter, got "${s.adapter}"`);
      if (s.model != null) errors.push(`steps[${s.step_id}]: kind "${s.kind}" requires null model`);
      if (s.usage != null) errors.push(`steps[${s.step_id}]: kind "${s.kind}" requires null usage`);
    }
    const stepTerminal = TERMINAL_STATUSES.includes(s.status);
    if (stepTerminal && s.duration_ms == null) errors.push(`steps[${s.step_id}]: terminal status "${s.status}" requires non-null duration_ms`);
    if (s.status === 'running' && s.duration_ms != null) errors.push(`steps[${s.step_id}]: status "running" requires null duration_ms`);
  }

  const computedRollup = computeManifestRollup(data.steps);
  const persistedByVendor = new Map((data.rollup ?? []).map((r) => [r.vendor, r]));
  const fields = ['step_count', 'unpriced_steps', 'input_tokens', 'output_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'cost_usd'];
  for (const [vendor, computed] of computedRollup) {
    const persisted = persistedByVendor.get(vendor);
    if (!persisted) { errors.push(`rollup: missing row for vendor "${vendor}" (occurrences report usage but rollup has no entry)`); continue; }
    for (const field of fields) {
      if (persisted[field] !== computed[field]) {
        errors.push(`rollup: vendor "${vendor}" field "${field}" is ${JSON.stringify(persisted[field])}, recomputed from occurrence usage is ${JSON.stringify(computed[field])}`);
      }
    }
  }
  for (const vendor of persistedByVendor.keys()) {
    if (!computedRollup.has(vendor)) errors.push(`rollup: vendor "${vendor}" has a row but no occurrence reported its usage`);
  }

  return errors;
}

async function main() {
  switch (cmd) {
    case 'init': {
      const dir = path.resolve(rest[0] ?? '.');
      const dst = path.join(dir, 'harness');
      if (fs.existsSync(dst)) die(`${dst} already exists`);
      fs.cpSync(path.join(here, '..', 'templates', 'harness'), dst, { recursive: true });
      fs.mkdirSync(path.join(dir, 'backlog'), { recursive: true });
      console.log(c.green('✓') + ` harness/ and backlog/ created in ${dir}\n  next: harness adapters · harness ticket new "…" · harness run requirements T-0001`);
      return;
    }
    case 'ticket': {
      const { backlog } = loadProject();
      if (rest[0] !== 'new') die('usage: harness ticket new "<title>" --intent "..."');
      const title = rest[1]; if (!title) die('title required');
      const t = backlog.create({ title, intent: flags.intent ?? title, owner: flags.owner });
      console.log(c.green('✓') + ` ${t.meta.id} created at ${path.relative(process.cwd(), t.dir)} (stage: draft)`);
      return;
    }
    case 'board': {
      const { backlog, harnessDir } = loadProject();
      const tickets = backlog.list();
      const flows = fs.existsSync(path.join(harnessDir, 'flows')) ? fs.readdirSync(path.join(harnessDir, 'flows')).filter((f) => f.endsWith('.yaml')).map((f) => { try { return loadFlow(path.join(harnessDir, 'flows', f)); } catch { return null; } }).filter(Boolean) : [];
      for (const stage of STAGES) {
        const col = tickets.filter((t) => t.meta.stage === stage);
        if (!col.length && !['draft', 'requirements', 'solutioned'].includes(stage)) continue;
        const next = flows.find((f) => f.consumes === stage);
        console.log(c.bold(stage.padEnd(14)) + c.dim(next ? `→ harness run ${next.name} <id>` : ''));
        for (const t of col) {
          const cost = (t.meta.history ?? []).reduce((s, h) => s + (h.cost ?? 0), 0);
          console.log(`  ${c.teal(t.meta.id)} ${t.meta.title}  ${c.dim(`owner=${t.meta.owner} cost=$${cost.toFixed(2)} iter=${JSON.stringify(t.meta.iterations ?? {})}`)}`);
        }
      }
      // The roll-up can only see vendors that report a price. Saying so is the whole point of the
      // tokens-only decision (2026-08-22); an unlabelled total reads as the cost of the run.
      if (tickets.some((t) => (t.meta.history ?? []).length)) {
        console.log(c.dim('· cost = billed cost where the vendor reports one; steps on token-only vendors (codex) are not included'));
      }
      return;
    }
    case 'lint': {
      const { harnessDir } = loadProject();
      const dir = path.join(harnessDir, 'flows');
      let bad = 0;
      for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.yaml'))) {
        try { loadFlow(path.join(dir, f)); console.log(c.green('✓') + ' ' + f); } catch (e) { bad++; console.log(c.red('✗') + ' ' + f + '\n  ' + e.message.split('\n').slice(1).join('\n  ')); }
      }
      process.exit(bad ? 1 : 0);
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
      let schemaObj;
      try { schemaObj = readData(schemaFile); } catch (e) { die(`cannot read schema ${schemaFile}: ${e.message}`); }
      // Annotation-driven, not filename/$id-driven — see the "contracts are executable" decision
      // and contracts/Q-0011/runs-cli.contract.md. An absent/unrecognised annotation still runs
      // structural validation; it just never earns a run-manifest-specific green tick.
      const isRunManifestContract = schemaObj['x-quorum-contract'] === 'run-manifest-v1';
      let bad = 0;
      for (const f of dataFiles) {
        let r;
        try { r = validateFile(schemaFile, f); }
        catch (e) { console.log(c.red('✗') + ` ${f}: ${e.message}`); bad += 1; continue; }
        if (!isRunManifestContract) {
          console.log(c.dim('·') + ` ${f}: run-manifest semantic checks skipped (schema has no recognised x-quorum-contract annotation)`);
        } else if (r.ok) {
          let data;
          try { data = readData(f); } catch (e) { console.log(c.red('✗') + ` ${f}: ${e.message}`); bad += 1; continue; }
          const semanticErrors = checkRunManifestSemantics(data);
          if (semanticErrors.length) r = { ok: false, errors: semanticErrors, schema: r.schema, data: r.data };
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
      const { runs: allRuns, warnings } = readRunsDir(runsRoot);

      if (token) {
        const exactDir = path.join(runsRoot, token);
        if (fs.existsSync(exactDir) && fs.statSync(exactDir).isDirectory()) {
          const manifestPath = path.join(exactDir, 'manifest.json');
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
        if (TICKET_ID_PATTERN.test(token)) {
          // A syntactically valid ticket id with zero matches is always exit 0 — see
          // contracts/Q-0011/runs-cli.contract.md — regardless of unrelated malformed siblings
          // elsewhere in .quorum/runs/, which this filter cannot even attribute to a ticket.
          const filtered = sortRuns(allRuns.filter((r) => r.manifest.ticket_id === token));
          if (jsonMode) console.log(JSON.stringify(runsListJSON(filtered, warnings)));
          else printRunsListHuman(filtered, warnings);
          return;
        }
        const message = `unknown run or ticket: ${token}`;
        if (jsonMode) console.log(JSON.stringify({ error: message }));
        else console.error(c.red('✗ ') + message);
        process.exitCode = 1;
        return;
      }

      const sorted = sortRuns(allRuns);
      if (jsonMode) console.log(JSON.stringify(runsListJSON(sorted, warnings)));
      else printRunsListHuman(sorted, warnings);
      if (warnings.length) process.exitCode = 1;
      return;
    }
    case 'run': {
      const [flowName, ticketId] = rest;
      if (!flowName || !ticketId) die('usage: harness run <flow> <ticket> [--auto] [--dry] [--adapter mock] [--verbose]');
      const proj = loadProject();
      const flow = loadFlowByName(flowName, proj.harnessDir);
      if (flags.adapter) { overrideAdapters(flow, flags.adapter); proj.config.adapterOverride = flags.adapter; }
      const ticket = proj.backlog.read(ticketId);
      try {
        const r = await runFlow({ flow, ticket, ...proj, ui, auto: Boolean(flags.auto), dry: Boolean(flags.dry) });
        process.exit(r.status === 'aborted' ? 2 : 0);
      } catch (e) { if (e instanceof FlowError) die(e.message); throw e; }
    }
    default:
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 10).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  }
}

function overrideAdapters(flow, name) {
  for (const s of flow.steps) for (const x of s.parallel ?? [s]) if (x.adapter) x.adapter = name;
}

main().catch((e) => die(e.stack ?? String(e)));
