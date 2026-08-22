// Codex CLI adapter: `codex exec` on the user's ChatGPT login (~/.codex/auth.json). Never an API key.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exec } from './claude.js';
import { extractJson } from './index.js';

export function codexAdapter(cfg = {}) {
  const bin = cfg.bin ?? 'codex';
  return {
    vendor: 'codex',
    async check() {
      const r = await exec(bin, ['--version'], { cwd: process.cwd() });
      if (r.code !== 0) throw new Error(`codex CLI not runnable: ${r.stderr || r.stdout}`);
      if (process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY) throw new Error('CODEX_API_KEY/OPENAI_API_KEY is set — unset it; Harness runs on subscription OAuth only');
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
        ...(model ? ['-m', model] : []),
        ...extraDirs.flatMap((d) => ['--add-dir', d]),
        ...(cfg.extraArgs ?? []),
        '-', // prompt on stdin
      ];
      const t0 = Date.now();
      onEvent?.({ type: 'spawn', vendor: 'codex', cmd: `${bin} ${args.join(' ')}` });
      const usage = { input_tokens: null, output_tokens: null, cost_usd: null };
      let session = null;
      const r = await exec(bin, args, {
        cwd, stdin: prompt,
        onLine: (l) => {
          onEvent?.({ type: 'stdout', line: l });
          // JSONL events: pick up usage / session where present, tolerate anything else.
          try {
            const ev = JSON.parse(l);
            const u = ev.usage ?? ev.payload?.usage ?? ev.item?.usage;
            if (u) { usage.input_tokens = u.input_tokens ?? usage.input_tokens; usage.output_tokens = u.output_tokens ?? usage.output_tokens; }
            session = ev.thread_id ?? ev.session_id ?? ev.payload?.thread_id ?? session;
          } catch { /* not JSON, ignore */ }
        },
      });
      if (r.code !== 0) throw new Error(`codex exited ${r.code}: ${r.stderr.slice(-2000)}`);
      const raw = fs.existsSync(lastPath) ? fs.readFileSync(lastPath, 'utf8') : r.stdout;
      let output; try { output = JSON.parse(raw); } catch { output = extractJson(raw); }
      fs.rmSync(tmp, { recursive: true, force: true });
      return { vendor: 'codex', output, raw, usage, session, ms: Date.now() - t0 };
    },
  };
}
