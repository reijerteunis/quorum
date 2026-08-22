// Mock adapter: runs flows without any CLI. Proves the engine, loops, gates, worktrees and integration.
// - A reviewer returns the failing verdict on its first call per role, the passing one afterwards
//   (MOCK_ALWAYS_FAIL=1 exhausts loops).
// - The architect writes a contract file; the "tasks" step emits a real tasks.yaml.
// - QA writes tests/check.sh that fails until every task's src file exists.
// - Developers write src/<task>.ts in their worktree. MOCK_DEV_FLAKY=1 makes the second task
//   skip its first attempt, so integration fails once and the fan-out re-runs scoped.
import fs from 'node:fs';
import path from 'node:path';

const calls = new Map();
const TASKS = `tasks:
  - id: "{id}.1"
    role: backend
    title: Proration service
    contracts: [contracts/ProrationService.ts]
    depends_on: []
  - id: "{id}.2"
    role: frontend
    title: Downgrade confirmation
    contracts: [contracts/ProrationService.ts]
    depends_on: ["{id}.1"]
`;

export function mockAdapter(cfg = {}) {
  return {
    vendor: 'mock',
    async check() { return 'mock 0.0.1'; },
    async run({ prompt, schema, model, cwd, allowWrite, onEvent }) {
      const role = (prompt.match(/^# Role: (.+)$/m) ?? [])[1] ?? 'agent';
      const ticketId = (prompt.match(/^# Ticket (T-\d+)/m) ?? [])[1] ?? 'T-0000';
      const task = (prompt.match(/^# Task (\S+) \((\w+)\)/m) ?? []);
      const key = task[1] ? `${role}:${task[1]}` : role;
      const n = (calls.get(key) ?? 0) + 1; calls.set(key, n);
      onEvent?.({ type: 'stdout', line: `[mock] ${key} call #${n} (model ${model ?? '-'}, cwd ${path.basename(cwd ?? '')}, write=${allowWrite})` });
      await new Promise((r) => setTimeout(r, cfg.delayMs ?? 20));

      const output = { summary: `mock ${key} #${n}` };
      const write = (rel, text) => { const f = path.join(cwd, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };

      if (allowWrite && role === 'principal-architect') write('contracts/ProrationService.ts', `export interface ProrationService { prorate(days: number): number } // mock call ${n}\n`);
      if (allowWrite && role === 'automation-qa') {
        write('tests/check.sh', `#!/bin/sh\nfor f in src/${ticketId}.1.ts src/${ticketId}.2.ts; do [ -f "$f" ] || { echo "MISSING $f"; exit 1; }; done\necho "all present"\n`);
      }
      if (allowWrite && task[1] && role.startsWith('developer-')) {
        const flaky = process.env.MOCK_DEV_FLAKY === '1' && task[1].endsWith('.2') && n === 1;
        if (flaky) output.summary += ' (flaky: wrote nothing)';
        else write(`src/${task[1]}.ts`, `// ${task[1]} by ${role} (mock call ${n})\nexport const ok = true;\n`);
      }

      if (schema.properties.document) {
        output.document = prompt.includes('Extract the Tasks section')
          ? TASKS.replaceAll('{id}', ticketId)
          : `# ${role} output (mock, call ${n})\n\nPrompt was ${prompt.length} chars and mentioned ${(prompt.match(/^## Input: /gm) ?? []).length} inputs.\n\n\`\`\`yaml\n${TASKS.replaceAll('{id}', ticketId)}\`\`\`\n`;
      }
      if (schema.properties.verdict) {
        const opts = schema.properties.verdict.enum;
        const fail = process.env.MOCK_ALWAYS_FAIL === '1' || n === 1;
        output.verdict = fail ? opts[opts.length - 1] : opts[0];
        output.findings = fail ? ['(mock) tighten acceptance criterion 2', '(mock) missing non-goal'] : [];
      }
      return { vendor: 'mock', output, raw: JSON.stringify(output), usage: { input_tokens: prompt.length / 4 | 0, output_tokens: 200, cost_usd: 0.01 }, session: null, ms: 20 };
    },
  };
}
