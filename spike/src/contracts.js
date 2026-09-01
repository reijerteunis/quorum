// Contract validation. Solutioning emits JSON Schema contracts; qa-red writes tests that must
// fail against them before development starts. That only works if something in the repository can
// actually execute a schema — see the "contracts must be executable" decision, 2026-08-22.
//
// Deliberately separate from checkAgainstSchema() in adapters/: that one is minimal on purpose,
// because it guards vendor output and must tolerate variance between CLIs. This one is strict,
// because a contract that bends is not a contract.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// ajv-formats because contracts use `format: date-time` (ticket history timestamps) and ajv
// ignores unknown formats by default — a contract that declares a check nobody performs is worse
// than one that declares nothing.
const ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }));

// Returns { ok, errors: [ "path: message", … ] }. Never throws on invalid data — only on a
// schema that does not compile, which is an authoring bug and must be loud.
export function validate(schema, data) {
  const check = ajv.compile(schema);
  if (check(data)) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: (check.errors ?? []).map((e) => `${e.instancePath || '/'}: ${e.message}${e.params?.additionalProperty ? ` ("${e.params.additionalProperty}")` : ''}`),
  };
}

// Read a .json or .yaml/.yml file. Contracts are JSON Schema; the artifacts under test may be
// either, and tasks.yaml is YAML, so accept both rather than making callers care.
export function readData(file) {
  const text = fs.readFileSync(file, 'utf8');
  return /\.ya?ml$/i.test(file) ? YAML.parse(text) : JSON.parse(text);
}

export function validateFile(schemaFile, dataFile) {
  const schema = readData(schemaFile);
  const data = readData(dataFile);
  return { ...validate(schema, data), schema: path.basename(schemaFile), data: path.basename(dataFile) };
}

// --- Q-0011 run-manifest semantic validation ----------------------------
// Structural JSON Schema cannot tell a genuinely reported zero cost from an unpriced vendor's
// roll-up mutated null -> 0 (errata E-2). Recomputing the roll-up from occurrence usage can.
//
// These three moved here from bin/harness.js unchanged, so that validateArtifact below can run the
// pass it reports on rather than claiming a pass a caller performs. packages/core keeps them in
// contracts/run-manifest.ts and re-exports them through contracts.ts, which is the same shape.

export const TERMINAL_STATUSES = ['completed', 'failed', 'aborted', 'regressed', 'exhausted', 'interrupted'];

// The one x-quorum-contract value that selects a semantic pass.
const RUN_MANIFEST_CONTRACT = 'run-manifest-v1';

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

export function checkRunManifestSemantics(data) {
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

// Structural validation, then the product-level semantic pass the schema's x-quorum-contract
// annotation selects — in that order, because the pass assumes a well-formed document.
//
// Each file is read ONCE here and reused for both passes. The CLI used to call validateFile and
// then readData(dataFile) again a line later, so an artifact was parsed twice and the two reads
// could disagree if the file changed between them. Reading once removes that race and changes no
// verdict. See Q-0037.
//
// `semantic` is three states and not two: `ran: true` is the only value that may be read as "the
// semantic checks were performed", and no caller may infer it from `ok` — a skip is not a pass
// (DECISIONS 2026-08-25). validateFile is kept beside this, unchanged and still called by
// spike/test/q0034-review-fixes.js; this function's structural half returns exactly what it does.
export function validateArtifact(schemaFile, dataFile) {
  const schema = readData(schemaFile);
  const data = readData(dataFile);
  const structural = { ...validate(schema, data), schema: path.basename(schemaFile), data: path.basename(dataFile) };
  if (schema?.['x-quorum-contract'] !== RUN_MANIFEST_CONTRACT) {
    return { ...structural, semantic: { contract: null, ran: false, reason: 'unrecognised-annotation' } };
  }
  if (!structural.ok) {
    return { ...structural, semantic: { contract: RUN_MANIFEST_CONTRACT, ran: false, reason: 'structurally-invalid' } };
  }
  const errors = checkRunManifestSemantics(data);
  return { ...structural, ok: errors.length === 0, errors, semantic: { contract: RUN_MANIFEST_CONTRACT, ran: true } };
}
