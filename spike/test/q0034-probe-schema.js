// Every schema Quorum sends to a vendor must list every property in `required`.
//
// OpenAI strict structured outputs reject anything else, so a schema that breaks the rule does not
// produce a bad answer — it produces a vendor error that looks exactly like a broken login. That is
// how `adapters --probe` reported "login not usable" for codex while the login was fine: PROBE_SCHEMA
// declared `summary` and required only `ok`. The rule was written in a comment above the schema and
// nothing checked it, so the one command that exists to prove a login before a paid run had never
// been able to prove codex at all. See Q-0034.
import assert from 'node:assert/strict';
import { PROBE_SCHEMA } from '../src/adapters/index.js';
import { schemaFor } from '../src/engine.js';

let n = 0;
const check = (name, fn) => { fn(); n += 1; console.log(`  ✓ ${name}`); };

function assertStrict(schema, label) {
  assert.equal(schema.additionalProperties, false, `${label}: additionalProperties must be false`);
  const props = Object.keys(schema.properties ?? {});
  const required = schema.required ?? [];
  assert.deepEqual(
    props.filter((p) => !required.includes(p)), [],
    `${label}: every property must appear in required (codex rejects the schema otherwise)`,
  );
}

console.log('q0034 probe schema');

check('PROBE_SCHEMA requires every property it declares', () => {
  assertStrict(PROBE_SCHEMA, 'PROBE_SCHEMA');
});

check('schemaFor() is strict for every step shape it emits', () => {
  const steps = [
    { output: {} },
    { output: { writes: ['requirements/merged.md'] } },
    { output: { verdict: 'approve|changes-requested' } },
    { output: { writes: ['review.md'], verdict: 'ready|needs-input' } },
  ];
  for (const step of steps) assertStrict(schemaFor(step), `schemaFor(${JSON.stringify(step.output)})`);
});

console.log(`\n✓ ${n} checks passed`);
