// Adapter contract (see docs/ADAPTER-CONTRACT.md).
//
//   run({ prompt, schema, model, cwd, extraDirs, maxTurns, allowWrite, onEvent }) -> Promise<AdapterResult>
//
//   AdapterResult = {
//     output:   object            // validated against `schema` (the "structured tail")
//     raw:      string            // the agent's final message as text
//     usage:    { input_tokens, output_tokens, cost_usd }   // any field may be null
//     session:  string | null
//     vendor:   'claude' | 'codex' | 'mock'
//     ms:       number
//   }
//
// Every adapter MUST end up with `output` as parsed JSON. Native structured output
// (claude --json-schema, codex --output-schema) is the primary path; the fallback
// is extractJson() on the final message: last ```json fence or last {...} block.

import { claudeAdapter } from './claude.js';
import { codexAdapter } from './codex.js';
import { mockAdapter } from './mock.js';

const registry = { claude: claudeAdapter, codex: codexAdapter, mock: mockAdapter };

export function getAdapter(name, config = {}) {
  const a = registry[name];
  if (!a) throw new Error(`unknown adapter "${name}" (known: ${Object.keys(registry).join(', ')})`);
  return a(config[name] ?? {});
}

export function extractJson(text) {
  if (!text) return null;
  const fences = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g)];
  for (let i = fences.length - 1; i >= 0; i--) {
    try { return JSON.parse(fences[i][1]); } catch { /* keep looking */ }
  }
  const start = text.lastIndexOf('\n{');
  if (start >= 0) { try { return JSON.parse(text.slice(start + 1)); } catch { /* fallthrough */ } }
  try { return JSON.parse(text.trim()); } catch { return null; }
}

// Minimal schema check: required keys present, enums honoured. Not a full validator on purpose.
export function checkAgainstSchema(obj, schema) {
  const problems = [];
  if (!obj || typeof obj !== 'object') return ['output is not an object'];
  for (const k of schema.required ?? []) if (!(k in obj)) problems.push(`missing "${k}"`);
  for (const [k, def] of Object.entries(schema.properties ?? {})) {
    if (k in obj && def.enum && !def.enum.includes(obj[k])) problems.push(`"${k}" must be one of ${def.enum.join('|')}, got ${JSON.stringify(obj[k])}`);
  }
  return problems;
}
