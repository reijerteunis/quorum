// Codex CLI adapter: `codex exec` on the user's ChatGPT login (~/.codex/auth.json). Never an API key.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exec } from './claude.js';
import { extractJson, authError } from './index.js';

// Codex nests the vendor's JSON error inside the message string of its own error event.
// Dig out the human sentence; fall back to the original text.
function unwrapCodexError(msg) {
  try { const inner = JSON.parse(msg); return inner?.error?.message ?? inner?.message ?? msg; }
  catch { return msg; }
}

export function codexAdapter(cfg = {}) {
  const bin = cfg.bin ?? 'codex';
  return {
    vendor: 'codex',
    async check() {
      // BYOS guard first: a missing CLI must not mask an API key in the environment.
      if (process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY) throw new Error('CODEX_API_KEY/OPENAI_API_KEY is set — unset it; Harness runs on subscription OAuth only');
      const r = await exec(bin, ['--version'], { cwd: process.cwd() });
      if (r.code !== 0) throw new Error(`codex CLI not runnable: ${r.stderr || r.stdout}`);
      return r.stdout.trim();
    },
    async run({ prompt, schema, model, cwd, extraDirs = [], allowWrite = false, onEvent }) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-codex-'));
      const schemaPath = path.join(tmp, 'schema.json');
      const lastPath = path.join(tmp, 'last.txt');
      fs.writeFileSync(schemaPath, JSON.stringify(schema));
      // Codex sandboxes to cwd; extra dirs are surfaced in the prompt (see engine) and via --add-dir if supported.
      const args = [
        'exec',
        '--json',
        '--output-schema', schemaPath,
        '-o', lastPath,
        '-C', cwd,
        '--sandbox', allowWrite ? 'workspace-write' : 'read-only',
        '--skip-git-repo-check',
        '--ephemeral',
        // The flow file is the source of truth, not the machine Quorum happens to run on:
        // ~/.codex/config.toml can pin a model that a ChatGPT subscription cannot use, and it
        // wins even when we pass no -m. Omitting -m entirely lets the CLI pick a model its own
        // auth supports, which also survives model renames. See Q-0001 and DECISIONS.
        '--ignore-user-config',
        ...(model ? ['-m', model] : []),
        ...extraDirs.flatMap((d) => ['--add-dir', d]),
        ...(cfg.extraArgs ?? []),
        '-', // prompt on stdin
      ];
      const t0 = Date.now();
      onEvent?.({ type: 'spawn', vendor: 'codex', cmd: `${bin} ${args.join(' ')}` });
      // Codex reports no cost, only tokens (verified 0.149.0, Q-0001).
      const usage = { input_tokens: null, output_tokens: null, cost_usd: null, cached_input_tokens: null };
      let session = null;
      const errors = [];   // codex puts failures on stdout as JSONL, not on stderr
      const r = await exec(bin, args, {
        cwd, stdin: prompt,
        onLine: (l) => {
          onEvent?.({ type: 'stdout', line: l });
          // JSONL events: pick up usage / session / errors where present, tolerate anything else.
          try {
            const ev = JSON.parse(l);
            const u = ev.usage ?? ev.payload?.usage ?? ev.item?.usage;
            if (u) {
              usage.input_tokens = u.input_tokens ?? usage.input_tokens;
              // reasoning tokens are billed as output; counting only output_tokens undercounts.
              usage.output_tokens = (u.output_tokens ?? 0) + (u.reasoning_output_tokens ?? 0) || usage.output_tokens;
              usage.cached_input_tokens = u.cached_input_tokens ?? usage.cached_input_tokens;
            }
            session = ev.thread_id ?? ev.session_id ?? ev.payload?.thread_id ?? session;
            const msg = ev.type === 'error' ? ev.message : ev.type === 'turn.failed' ? ev.error?.message : ev.item?.type === 'error' ? ev.item.message : null;
            if (msg) errors.push(unwrapCodexError(msg));
          } catch { /* not JSON, ignore */ }
        },
      });
      if (r.code !== 0) {
        fs.rmSync(tmp, { recursive: true, force: true });
        const reported = [...new Set(errors)].join('; ');
        const all = `${r.stderr}\n${r.stdout}`;
        const err = new Error(authError('codex', all) ?? `codex exited ${r.code}: ${reported || all.trim().slice(-2000) || 'no output on stderr or stdout'}`);
        err.usage = usage;   // whatever the stream reported before it died — the tokens were spent
        throw err;
      }
      const raw = fs.existsSync(lastPath) ? fs.readFileSync(lastPath, 'utf8') : r.stdout;
      let output; try { output = JSON.parse(raw); } catch { output = extractJson(raw); }
      fs.rmSync(tmp, { recursive: true, force: true });
      return { vendor: 'codex', output, raw, usage, session, ms: Date.now() - t0 };
    },
  };
}
