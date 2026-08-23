#!/usr/bin/env node
// harness — spike CLI. Commands:
//   harness init [dir]                      copy templates into <dir>/harness and create backlog/
//   harness ticket new "<title>" [--intent "..."] [--owner name]
//   harness board                           kanban of tickets by stage
//   harness run <flow> <ticket> [--auto] [--dry] [--adapter mock]
//   harness lint                            lint all flows
//   harness adapters [--probe] [--json]     CLIs installed + no API keys; --probe also proves login
//   harness validate <schema.json> <file…>  check artifacts against a contract; exit 1 on failure
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { Backlog, STAGES } from '../src/backlog.js';
import { loadFlow, loadFlowByName, runFlow, FlowError } from '../src/engine.js';
import { getAdapter, probeAdapter } from '../src/adapters/index.js';
import { validateFile } from '../src/contracts.js';

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
      let bad = 0;
      for (const f of dataFiles) {
        let r;
        try { r = validateFile(schemaFile, f); }
        catch (e) { console.log(c.red('✗') + ` ${f}: ${e.message}`); bad += 1; continue; }
        if (r.ok) console.log(c.green('✓') + ` ${f} matches ${r.schema}`);
        else { bad += 1; console.log(c.red('✗') + ` ${f} violates ${r.schema}:\n    ${r.errors.join('\n    ')}`); }
      }
      process.exit(bad ? 1 : 0);
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
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  }
}

function overrideAdapters(flow, name) {
  for (const s of flow.steps) for (const x of s.parallel ?? [s]) if (x.adapter) x.adapter = name;
}

main().catch((e) => die(e.stack ?? String(e)));
