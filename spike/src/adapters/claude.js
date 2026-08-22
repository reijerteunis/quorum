// Claude Code adapter: `claude -p` on the user's subscription login. Never an API key.
import { spawn } from 'node:child_process';
import { extractJson, authError } from './index.js';

export function claudeAdapter(cfg = {}) {
  const bin = cfg.bin ?? 'claude';
  return {
    vendor: 'claude',
    async check() {
      // Guard the BYOS rule first: an API key in the environment would silently bypass subscription
      // auth, and that is true whether or not the CLI is installed — a missing CLI must not mask it.
      if (process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is set — unset it; Harness runs on subscription OAuth only');
      const r = await exec(bin, ['--version'], { cwd: process.cwd() });
      if (r.code !== 0) throw new Error(`claude CLI not runnable: ${r.stderr || r.stdout}`);
      return r.stdout.trim();
    },
    // maxTurns is part of the common adapter contract but Claude Code has no turn-budget flag
    // (verified against 2.1.220, 2026-08-22) — accepted and ignored here, like the codex adapter.
    async run({ prompt, schema, model, cwd, extraDirs = [], maxTurns, allowWrite = false, onEvent }) {
      void maxTurns;
      const args = [
        '-p',
        '--output-format', 'json',
        '--json-schema', JSON.stringify(schema),
        '--permission-mode', allowWrite ? 'acceptEdits' : 'plan',
        ...(model ? ['--model', model] : []),
        ...extraDirs.flatMap((d) => ['--add-dir', d]),
        ...(cfg.extraArgs ?? []),
      ];
      const t0 = Date.now();
      onEvent?.({ type: 'spawn', vendor: 'claude', cmd: `${bin} ${args.map(q).join(' ')}` });
      const r = await exec(bin, args, { cwd, stdin: prompt, onLine: (l) => onEvent?.({ type: 'stdout', line: l }) });
      if (r.code !== 0) {
        const auth = authError('claude', r.stderr + r.stdout);
        throw new Error(auth ?? `claude exited ${r.code}: ${r.stderr.slice(-2000)}`);
      }
      let env;
      try { env = JSON.parse(r.stdout); } catch { env = null; }
      const raw = env?.result ?? r.stdout;
      const output = env?.structured_output ?? extractJson(raw);
      return {
        vendor: 'claude', output, raw,
        usage: {
          // input_tokens excludes cache traffic, which is most of a real prompt: a probe that
          // cost $0.39 reported 65 tokens. Count the cache fields or every roll-up is fiction.
          input_tokens: env?.usage ? (env.usage.input_tokens ?? 0) + (env.usage.cache_creation_input_tokens ?? 0) + (env.usage.cache_read_input_tokens ?? 0) : null,
          output_tokens: env?.usage?.output_tokens ?? null,
          cost_usd: env?.total_cost_usd ?? null,
        },
        session: env?.session_id ?? null,
        ms: Date.now() - t0,
      };
    },
  };
}

const q = (s) => (/[\s"']/.test(s) ? `'${s.replace(/'/g, "'\\''").slice(0, 80)}${s.length > 80 ? '…' : ''}'` : s);

export function exec(bin, args, { cwd, stdin, onLine } = {}) {
  return new Promise((resolve) => {
    const p = spawn(bin, args, { cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', buf = '';
    p.stdout.on('data', (d) => {
      const s = d.toString(); stdout += s; buf += s;
      let i; while ((i = buf.indexOf('\n')) >= 0) { onLine?.(buf.slice(0, i)); buf = buf.slice(i + 1); }
    });
    p.stderr.on('data', (d) => { stderr += d.toString(); });
    p.on('error', (e) => resolve({ code: -1, stdout, stderr: String(e) }));
    p.on('close', (code) => { if (buf) onLine?.(buf); resolve({ code, stdout, stderr }); });
    if (stdin != null) p.stdin.end(stdin); else p.stdin.end();
  });
}
